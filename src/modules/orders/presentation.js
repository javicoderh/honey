export const orderDate = (value) => value ? new Intl.DateTimeFormat("es-CL", { timeZone: "America/Santiago", dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : "Sin registrar";

export const HISTORY_LABELS = {
  "order.created": "Pedido ingresado",
  "payment.status_changed": "Estado de pago actualizado",
  "payment.review_required": "Pago enviado a revisión",
  "delivery.status_changed": "Estado de entrega actualizado",
  "delivery.assigned": "Delivery asignado",
  "comment.added": "Comentario interno agregado",
  "order.operations_updated": "Datos de entrega corregidos",
  "order.cancelled": "Pedido cancelado",
  "order.archived": "Pedido archivado",
};

export const PAYMENT_REVIEW_LABELS = {
  partial_refund: 'Reembolso parcial informado por Mercado Pago.',
  refund_amount_mismatch: 'El reembolso informado requiere confirmar su importe.',
  multiple_approved_payments: 'Se informó más de un cobro para el mismo pedido.',
  closed_order_payment: 'Se recibió un pago de un pedido cancelado o archivado.',
  unexpected_transition: 'El cambio de estado del pago requiere revisión.',
  unsupported_status: 'Mercado Pago informó un estado que requiere revisión.',
};

export const FIELD_LABELS = { "recipient.name": "Nombre del destinatario", "recipient.phone": "Teléfono del destinatario", "shippingAddress.street": "Dirección", "shippingAddress.commune": "Comuna", "shippingAddress.apartment": "Departamento", "shippingAddress.reference": "Referencias", deliveryInstructions: "Indicaciones" };
