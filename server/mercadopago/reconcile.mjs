import { createHash } from 'node:crypto';
import { HttpError, insist } from '../errors.mjs';
import { paymentId } from './client.mjs';
import { createPayment } from '../../src/modules/payments/model.js';
import { recordPaymentUpdate } from '../../src/modules/orders/model.js';
import { timestamp } from '../../src/shared/domain.js';

const author = { id: 'mercadopago', name: 'Mercado Pago verificado', role: 'system' };
const statusMap = { pending: 'pending', in_process: 'pending', authorized: 'pending', approved: 'approved', rejected: 'rejected', cancelled: 'rejected', refunded: 'refunded' };

export function reconcilePayment(order, remote, checkout, config, at) {
  const id = paymentId(remote.id);
  insist(id && remote.external_reference === checkout.attempt_id && checkout.order_id === order.id, 422, 'El pago no corresponde al pedido.');
  insist(remote.currency_id === 'CLP' && remote.transaction_amount === order.total && Number.isSafeInteger(remote.transaction_amount), 422, 'El importe o la moneda no corresponden al pedido.');
  insist(paymentId(remote.collector_id) === config.collectorId && remote.live_mode === (config.environment === 'production'), 422, 'La cuenta receptora o el entorno del pago no corresponden.');
  const updated = timestamp(remote.date_last_updated);
  const created = timestamp(remote.date_created);
  insist(Date.parse(created) >= Date.parse(order.createdAt) && created <= updated, 422, 'La fecha de creación del pago no es válida.');
  insist(Date.parse(updated) <= Date.parse(at) + 60000, 422, 'La fecha del proveedor no es válida.');
  const refunded = remote.transaction_amount_refunded ?? 0;
  insist(Number.isSafeInteger(refunded) && refunded >= 0 && refunded <= order.total, 422, 'El importe reembolsado no es válido.');
  const event = { paymentId: id, checkoutAttemptId: checkout.attempt_id, providerStatus: remote.status, providerUpdatedAt: updated, amount: order.total, refundedAmount: refunded, collectorId: config.collectorId, liveMode: remote.live_mode };
  event.id = createHash('sha256').update(JSON.stringify(event)).digest('hex'); event.receivedAt = at;
  const existing = order.payments.find(payment => payment.providerTransactionId === id);
  if (existing?.providerUpdatedAt && updated < existing.providerUpdatedAt) return { order, event, ignored: true };
  let next = structuredClone(order);
  let local = existing ? next.payments.find(payment => payment.id === existing.id) : createPayment({ id: `${order.id}:mp:${id}`, orderId: order.id, amount: order.total, createdAt: created });
  if (!existing) next.payments.push(local);
  const mapped = statusMap[remote.status];
  let review = !mapped ? 'unsupported_status' : refunded > 0 && refunded < order.total ? 'partial_refund' : null;
  if (remote.status === 'refunded' && refunded !== order.total) review = 'refund_amount_mismatch';
  const anotherPaid = next.payments.some(payment => payment.id !== local.id && payment.approvedAt);
  const impliesApproval = ['approved','refunded','charged_back'].includes(remote.status);
  if (impliesApproval && anotherPaid) review = 'multiple_approved_payments';
  if (impliesApproval && (next.cancelledAt || next.archivedAt)) review = 'closed_order_payment';
  local.providerTransactionId = id;
  local.providerStatus = remote.status;
  local.providerUpdatedAt = updated;
  local.providerRefundedAmount = refunded;
  if (impliesApproval) {
    const approvedAt = timestamp(remote.date_approved);
    insist(approvedAt >= created && approvedAt <= updated && Date.parse(approvedAt) <= Date.parse(at), 422, 'La fecha de aprobación no es válida.');
    local.providerApprovedAt = approvedAt;
  }
  const approve = () => {
    const approvedAt = timestamp(remote.date_approved);
    insist(Date.parse(approvedAt) >= Date.parse(created) && Date.parse(approvedAt) <= Date.parse(at), 422, 'La fecha de aprobación no es válida.');
    next = recordPaymentUpdate(next, { paymentId: local.id, status: 'approved', transactionId: id, at: approvedAt, author });
    local = next.payments.find(payment => payment.id === local.id);
  };
  if (impliesApproval && !anotherPaid && local.status === 'pending') approve();
  if (mapped === 'rejected' && local.status === 'pending') next = recordPaymentUpdate(next, { paymentId: local.id, status: 'rejected', transactionId: id, at, author });
  else if (mapped === 'refunded' && refunded === order.total && local.status === 'approved') next = recordPaymentUpdate(next, { paymentId: local.id, status: 'refunded', transactionId: id, at, author });
  else if (mapped && local.status !== mapped && !(impliesApproval && anotherPaid)) review ??= 'unexpected_transition';
  if (review) {
    next.paymentReviewRequired = true; next.paymentReviewReason = review;
    if (!next.history.some(entry => entry.action === 'payment.review_required' && entry.details.eventId === event.id)) next.history.push({ id: `${order.id}:mp-review:${event.id}`, action: 'payment.review_required', at, author, details: { eventId: event.id, paymentId: id, reason: review } });
  }
  next.updatedAt = at > next.updatedAt ? at : next.updatedAt;
  return { order: next, event, ignored: false };
}
