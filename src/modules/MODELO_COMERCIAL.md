# Modelo comercial compartido

Base implementada en la etapa 2 y conectada al checkout y gestión de pedidos en las etapas 4 y 6. Los servicios continúan en modo demostración y no reciben pagos reales.

## Organización

| Módulo | Archivo | Responsabilidad |
| --- | --- | --- |
| Compra | `purchase/model.js` | Borrador, combinación de campos, destinatario y datos del pedido. |
| Pedidos | `orders/model.js` | Creación, importes, copias de productos, comentarios e historial. |
| Pedidos | `orders/selectors.js` | Orden cronológico, fecha de ingreso, estado operativo, búsqueda y archivo. |
| Pagos | `payments/model.js` | Intentos de pago, estados, transacción y fechas. |
| Entregas | `deliveries/model.js` | Estado operativo, asignación, motivo y fecha efectiva de entrega. |
| Entregas | `deliveries/selectors.js` | Pedidos pagados y activos asignados a un delivery. |
| Ventas | `sales/selectors.js` | Ventas derivadas de pedidos y pagos, búsqueda y períodos. |
| Compartido | `../shared/businessDates.js` | Calendario de Chile y períodos. |

## Borrador de compra

`createPurchaseDraft()` devuelve comprador, destinatario, dirección e indicaciones vacíos. `recipientSameAsBuyer` comienza en `true`: el destinatario se obtiene del comprador y no se mantiene una copia que pueda quedar desactualizada durante la edición.

`updatePurchaseDraft()` combina los campos de cada grupo sin perder los demás. Permite indicar otro destinatario y volver a usar los datos del comprador. `purchaseSnapshot()` valida los datos necesarios y crea copias independientes al generar el pedido.

## Pedido

| Campo | Contenido |
| --- | --- |
| `id`, `number` | Identificador interno y número visible; el servicio los suministrará al crear el pedido. |
| `buyer` | Nombre, correo y teléfono del comprador invitado. |
| `recipient` | Nombre y teléfono de la persona que recibe. |
| `shippingAddress` | Dirección, comuna, departamento y referencia. |
| `deliveryInstructions` | Indicaciones operativas actuales; inicialmente las escritas por el comprador. |
| `originalDeliveryInstructions` | Indicaciones originales, conservadas a partir de la primera corrección. |
| `isTest` | Marca explícita establecida por el adaptador demo; solo `true` permite borrar el registro de prueba. |
| `items` | Producto, nombre, formato, cantidad, precio unitario y total de línea guardados al comprar. |
| `subtotal`, `shippingFee`, `total`, `currency` | Importes enteros en CLP; el despacho debe suministrarse expresamente, incluso si es cero. |
| `payments` | Intentos de pago asociados al pedido; inicialmente uno pendiente. |
| `delivery` | Despacho del pedido, inicialmente pendiente y sin delivery asignado. |
| `createdAt`, `updatedAt` | Fecha de ingreso y última actualización. |
| `cancelledAt`, `archivedAt` | Cancelación y archivo separados del pago y de la entrega. |
| `comments` | Comentarios internos con identificador, texto, autor y fecha. |
| `history` | Eventos con acción, autor, fecha y detalles del cambio. |

`createOrder()` toma las líneas solicitadas y consulta sus precios en el catálogo recibido; no acepta precios unitarios enviados por el comprador. Las copias del pedido no cambian al modificar posteriormente el catálogo o el borrador. En producción el mismo cálculo deberá ocurrir en el servidor.

## Pago y venta

Cada pago tiene `id`, `orderId`, `providerTransactionId`, `amount`, `currency`, `status`, `createdAt`, `updatedAt`, `approvedAt` y `refundedAt`.

Estados: `pending` (pendiente), `approved` (aprobado), `rejected` (rechazado) y `refunded` (reembolsado). Un intento pendiente puede aprobarse o rechazarse; uno aprobado puede reembolsarse. El checkout simulado agrega un nuevo intento después de un rechazo, conservando el anterior.

La aprobación exige identificador de transacción. Repetir el mismo estado no agrega otro evento ni otra venta; cambiar la transacción de un pago registrado se rechaza. Tampoco se permite registrar dos intentos aprobados para el mismo pedido.

`selectSales()` devuelve vistas que referencian el pedido y su pago aprobado. Incluye comprador, dirección, productos, indicaciones y comentarios a través del mismo pedido, además del monto pagado y fechas. Filtra por la fecha de aprobación, no por la fecha de creación del pedido. Un reembolso conserva la venta histórica y el importe original, mostrando importe neto cero.

Estas funciones organizan los datos: no verifican una transacción en Mercado Pago. Esa verificación y la protección ante concurrencia se implementan en el backend.

## Entrega e historial

Cada despacho tiene `id`, `orderId`, `assignedTo`, `status`, `createdAt`, `updatedAt`, `deliveredAt` y `failureReason`.

Estados: `pending` (pendiente), `ready` (listo para despacho), `in_transit` (en reparto), `delivered` (entregado) y `failed` (entrega no realizada).

`canPrepareOrder()` requiere un pago aprobado y que el pedido no esté cancelado ni archivado. `recordDeliveryUpdate()` aplica esta condición antes de avanzar la entrega y registra la fecha efectiva al marcarla como entregada. La entrega fallida requiere un motivo.

Corregir una entrega ya completada requiere motivo. La fecha efectiva actual vuelve a `null` si deja de estar entregada, pero el evento de corrección conserva la fecha anterior y el autor; no se borra la entrega previamente registrada.

`addOrderComment()` agrega comentarios internos del equipo sin modificar las indicaciones del comprador. Las operaciones devuelven un nuevo pedido y no mutan el registro original. El backend aplicará los permisos de sesión y asignación: un rol suministrado desde el navegador no constituye autorización.

`updateOrderOperations()` admite únicamente destinatario, dirección e indicaciones. Requiere rol admin y motivo, guarda los valores anteriores/nuevos y conserva indicaciones originales. Rechaza campos financieros, productos y comprador, además de cambios sobre pedidos cancelados o archivados. `changeOrderLifecycle()` registra cancelación o archivo con motivo, autor y fecha, sin alterar pagos ni representar un reembolso. Los comentarios internos siguen permitidos tras cerrar el pedido. Los pedidos cancelados o archivados no admiten cambios de entrega.

`orders.update(id, { type, payload })` permite `operations`, `comment`, `delivery`, `cancel`, `archive` y `delete`. El adaptador obtiene autor y fecha a partir de su sesión y reloj; el formulario no los define. `delete` exige `isTest === true`; los demás registros se conservan. Las referencias de creación no generan un reemplazo si su pedido se borró y los números no se reutilizan.

## Fechas y períodos

- Las fechas de eventos se guardan como instantes ISO en UTC; las suministrará el servicio al ejecutar la acción.
- La fecha comercial se calcula en `America/Santiago`, independientemente de la zona horaria del dispositivo.
- `createPeriod()` acepta `day`, `week`, `month` y `range`, con fechas de calendario `YYYY-MM-DD`.
- Las semanas van de lunes a domingo y los extremos de los períodos son inclusivos.
- La comparación usa el día local de cada instante, sin asumir días de 24 horas durante los cambios de horario.
- Pedidos filtra `createdAt`; ventas filtra `approvedAt`.

## Contextos, adaptador y pruebas

`usePurchase()` incorpora el borrador definido y el destinatario resuelto. `useOrders()` expone `getOrder`, `getOrdersForPeriod`, `getSales` y `getAssignedOrders` desde la misma fuente. `usePayment()` distingue el estado de consulta (`status`) del estado comercial (`paymentState`).

`createMockAdapter({ initialOrders })` permite usar pedidos de prueba y devuelve copias independientes en `orders.list()`, `orders.getById()` y `payments.getForOrder()`. El adaptador normal comienza vacío y recibe los pedidos creados desde el checkout simulado; no agrega ventas precargadas. Los cambios del admin actualizan esta misma fuente para pedidos, ventas y entregas.

Verificación: `npm.cmd run test:domain` ejecuta las pruebas de importes, copias, datos, estados, duplicación, historial, entrega, reembolsos y calendario chileno. `npm.cmd run test:orders` verifica correcciones, conservación de importes e indicaciones, ciclo de vida, autor de sesión, borrado restringido y filtros. `npm.cmd run check:orders-browser` recorre estas acciones en el navegador. Los importes de despacho de prueba no establecen una tarifa comercial.
