export const CART_STATUS_LABELS = { active: 'Activo', abandoned: 'Abandonado', ordered: 'Pedido creado', converted: 'Compra pagada', unsubscribed: 'Baja registrada', expired: 'Vencido', cleared: 'Vaciado' };

// Las celdas siempre se citan; los prefijos de fórmula no se ejecutan al abrir Excel.
export function csvCell(value) {
  let text = String(value ?? '');
  if (/^[\s]*[=+\-@]/.test(text)) text = "'" + text;
  return `"${text.replaceAll('"', '""')}"`;
}

export function campaignCsv(rows, segment) {
  const recovery = segment === 'recovery';
  const header = recovery ? ['correo','nombre','productos','subtotal_clp','ultima_actividad','consentimiento_recuperacion','version_consentimiento','recuperar_carrito','darse_de_baja']
    : ['correo','nombre','consentimiento_promociones','compras_pagadas','total_comprado_clp','ultima_compra','darse_de_baja'];
  const values = rows.map(row => recovery ? [row.email,row.name,row.items.map(item => `${item.name} ${item.format} x${item.quantity}`).join(' | '),row.subtotal,row.updatedAt,row.recoveryConsentAt,row.consentVersion,row.recoveryUrl,row.unsubscribeUrl]
    : [row.email,row.name,row.marketingConsentAt,row.paidOrders,row.lifetimeTotal,row.lastPurchaseAt,row.unsubscribeUrl]);
  return '\uFEFF' + [header,...values].map(line => line.map(csvCell).join(',')).join('\r\n');
}
