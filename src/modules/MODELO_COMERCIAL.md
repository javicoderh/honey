# Modelo comercial compartido

Base implementada en la etapa 2 y conectada a compra, pedidos, ventas y despachos en las etapas 4, 6, 7 y 8. Los servicios continúan en modo demostración y no reciben pagos reales.

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
| Ventas | `sales/model.js` | Períodos de consulta y totales separados de pagos aprobados/reembolsados. |
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

La búsqueda incluye número de pedido, ID interno del pago, ID de transacción y contacto del comprador. `summarizeSales()` suma por separado los pagos actualmente aprobados y los reembolsados. Un reembolso pertenece al período de aprobación de su venta original, aunque se haya devuelto en otro período; la consulta no constituye un reporte de movimientos de caja. Cancelación y archivo no excluyen una venta con pago aprobado. `resolveSalesPeriod()` traduce la selección de día/semana/mes/rango al calendario compartido y rechaza rangos invertidos o meses inválidos.

`SalesPage` y `SaleDetailPage` consumen `useOrders()`, sin un almacén independiente de ventas. El detalle y el formulario de comentarios se comparten con Pedidos; agregar un comentario o cambiar una entrega actualiza el mismo registro. La consulta aplicada y su borrador se conservan en `useSession().views.Ventas` al navegar.

Estas funciones organizan los datos: no verifican una transacción en Mercado Pago. Esa verificación y la protección ante concurrencia se implementan en el backend.

## Entrega e historial

Cada despacho tiene `id`, `orderId`, `assignedTo`, `assignedName` (al asignar), `assignedAt`, `status`, `createdAt`, `updatedAt`, `deliveredAt`, `deliveredBy` y `failureReason`.

Estados: `pending` (pendiente), `ready` (listo para despacho), `in_transit` (en reparto), `delivered` (entregado) y `failed` (entrega no realizada).

`canPrepareOrder()` requiere un pago aprobado y que el pedido no esté cancelado ni archivado. `recordDeliveryUpdate()` aplica esta condición antes de avanzar la entrega y registra la fecha efectiva al marcarla como entregada. La entrega fallida requiere un motivo.

Corregir una entrega ya completada requiere motivo. La fecha efectiva y `deliveredBy` actuales vuelven a `null` si deja de estar entregada; el evento conserva fecha y autor anteriores. No se borra la entrega previamente registrada.

`assignOrderDelivery()` requiere admin, pago aprobado, pedido activo, estado listo y un destinatario de asignación con rol delivery activo. Al reasignar exige motivo y conserva la asignación anterior. No permite reasignar directamente pedidos en reparto o completados. `recordDeliveryUpdate()` permite al delivery solo En reparto, Entregado y Entrega no realizada en sus asignaciones preparadas; exige asignación antes de iniciar reparto. El admin puede preparar pendientes o fallidos, y conserva las correcciones operativas de Pedidos. Los comentarios de delivery también requieren una asignación propia, pagada y activa.

`orders.listAssigned()` deriva la sesión delivery y proyecta `deliveryView()` sobre sus pedidos pagados, no cancelados ni archivados. La proyección incluye productos sin precios, destinatario, dirección, indicaciones, entrega, comentarios e historial operativo. Omite comprador, pagos, importes e historial de pago. Las mutaciones delivery devuelven la misma proyección; los cambios se aplican al pedido completo original. Pedidos y Ventas muestran nombre y fecha de asignación, autor de entrega y cualquier motivo de fallo desde ese registro compartido.

`addOrderComment()` agrega comentarios internos del equipo sin modificar las indicaciones del comprador. Las operaciones devuelven un nuevo pedido y no mutan el registro original. El backend aplicará los permisos de sesión y asignación: un rol suministrado desde el navegador no constituye autorización.

`updateOrderOperations()` admite únicamente destinatario, dirección e indicaciones. Requiere rol admin y motivo, guarda los valores anteriores/nuevos y conserva indicaciones originales. Rechaza campos financieros, productos y comprador, además de cambios sobre pedidos cancelados o archivados. `changeOrderLifecycle()` registra cancelación o archivo con motivo, autor y fecha, sin alterar pagos ni representar un reembolso. Los comentarios internos siguen permitidos tras cerrar el pedido. Los pedidos cancelados o archivados no admiten cambios de entrega.

`orders.update(id, { type, payload })` permite `operations`, `comment`, `delivery`, `assign`, `cancel`, `archive` y `delete`. El adaptador obtiene autor y fecha a partir de su sesión y reloj; el formulario no los define. `assign` busca el integrante real de su lista de equipo usando `deliveryId`, sin confiar en un objeto de usuario suministrado desde la interfaz. Delivery solo puede usar `delivery` y `comment` para sus asignaciones activas; el adaptador demo le rechaza consultas generales de pedidos, pagos y equipo. `delete` exige `isTest === true`; los demás registros se conservan. Las referencias de creación no generan un reemplazo si su pedido se borró y los números no se reutilizan. Estas reglas de demostración aún requieren validación real en el servidor.

## Equipo y acceso de demostración

`createTeamMember()` valida nombre, correo único y rol admin/delivery. `updateTeamMember()` permite únicamente rol y estado activo; impide desactivar o degradar al último admin activo. Ambos registran autor, fecha e historial. Las actualizaciones sin cambios no agregan eventos.

`staff.list/create/update` exigen una sesión admin activa. El registro interno mantiene una versión de acceso que cambia al modificar rol o estado; una sesión con versión anterior queda invalidada. Los datos públicos y la sesión omiten esa versión y no contienen contraseñas. La contraseña ficticia común es `demo1234`, también para cuentas creadas durante la prueba. Reactivar una cuenta no recupera su sesión anterior.

Las asignaciones de pedidos se conservan al desactivar una cuenta. El admin puede revisarlas en Despachos; nuevas asignaciones solo admiten delivery activo. Todo permanece en memoria y necesita autorización y persistencia del servidor antes de operar con usuarios reales.

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

Verificación: `npm.cmd run test:domain` ejecuta las pruebas de importes, copias, datos, estados, duplicación, historial, entrega, reembolsos y calendario chileno. `npm.cmd run test:orders` verifica correcciones, conservación de importes e indicaciones, ciclo de vida, autor de sesión, borrado restringido y filtros. `npm.cmd run test:sales` comprueba períodos, límites horarios, búsqueda y totales separados, y referencias compartidas. Las pruebas `check:orders-browser` y `check:sales-browser` recorren sus acciones en el navegador. Los importes de despacho de prueba no establecen una tarifa comercial.

`npm.cmd run test:deliveries` verifica preparación, asignación/reasignación, ámbito por delivery, proyección de datos, motivos, conservación de fecha/autor y actualización compartida de ventas. `npm.cmd run check:deliveries-browser` recorre compra invitada, pago simulado, asignación y entrega con ambas sesiones.
