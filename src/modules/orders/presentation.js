export const orderDate = (value) => value ? new Intl.DateTimeFormat("es-CL", { timeZone: "America/Santiago", dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : "Sin registrar";

export const HISTORY_LABELS = {
  "order.created": "Pedido ingresado",
  "payment.status_changed": "Estado de pago actualizado",
  "delivery.status_changed": "Estado de entrega actualizado",
  "comment.added": "Comentario interno agregado",
  "order.operations_updated": "Datos de entrega corregidos",
  "order.cancelled": "Pedido cancelado",
  "order.archived": "Pedido archivado",
};

export const FIELD_LABELS = { "recipient.name": "Nombre del destinatario", "recipient.phone": "Teléfono del destinatario", "shippingAddress.street": "Dirección", "shippingAddress.commune": "Comuna", "shippingAddress.apartment": "Departamento", "shippingAddress.reference": "Referencias", deliveryInstructions: "Indicaciones" };
