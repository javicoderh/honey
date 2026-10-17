# Plan de implementación comercial — Casa Miel

## Objetivo y alcance

Permitir comprar sin cuenta, recibir el pago mediante Mercado Pago, registrar la venta, generar la orden de despacho y gestionar la entrega.

Implementaremos primero el frontend con datos simulados. Después conectaremos el backend, la base de datos, la autenticación y Mercado Pago. Los checkboxes marcados representan tareas implementadas; los restantes siguen pendientes.

El diseño conservará la estética actual y priorizará el uso desde el teléfono. Los dashboards serán modulares: primero se elige una sección, después un filtro y finalmente un registro.

## Arquitectura modular acordada

Cada pantalla consume la API interna de su contexto. Los contextos gestionan el estado y llaman a los servicios; el adaptador define si los datos son simulados o provienen del backend. No se hacen consultas de datos directamente desde componentes de presentación.

Flujo: **componente → contexto del módulo → servicio → adaptador simulado o API real**.

| Contexto | API base implementada | Operaciones que se agregarán en su etapa |
| --- | --- | --- |
| Catálogo (`useCatalog`) | Productos, carga/error, `getProduct`, `refreshProducts` | Disponibilidad según el backend. |
| Carrito (`useCart`) | Agregar, quitar, modificar, vaciar y persistir selección; precios del catálogo | Disponibilidad real según backend. |
| Compra (`usePurchase`) | Borrador, destinatario, creación de pedido con referencia de solicitud y nueva compra | Creación real desde servidor: etapa 11. |
| Pagos (`usePayment`) | Consulta por pedido, simulación, reintento, estado y errores | Conexión real: etapa 12. |
| Sesión (`useSession`) | Login/logout simulados, vencimiento, rol y estado de navegación por sección | Validación real: etapa 11. |
| Pedidos (`useOrders`) | Lista compartida, edición operativa, comentarios, estados, cancelación, archivo, preparación/asignación y consulta delivery acotada | Persistencia y autorización reales: etapa 11. |
| Equipo (`useTeam`) | Lista compartida, `refreshTeam`, `createMember`, `updateMember`, estados de mutación | Persistencia y permisos reales: etapa 11. |

Ventas y entregas son vistas derivadas del registro compartido de pedidos y sus pagos asociados, sin mantener copias independientes. Las pantallas de Ventas y Despachos están implementadas en las etapas 7 y 8. El adaptador demo usa `orders.listAssigned()` para delivery, con una proyección sin datos comerciales; el backend deberá aplicar ese mismo alcance según la sesión y el rol.

Los servicios se inyectan mediante `ServicesProvider`. `AppProviders` monta catálogo, carrito y borrador en la tienda; pagos solamente en checkout y resultado; sesión y pedidos en staff; equipo en el panel admin, Equipo y Despachos (incluido el detalle de asignación). Equipo no se monta en delivery y solo se consulta con rol admin. Pedidos no se consultan sin sesión; delivery usa su consulta acotada. Carrito y borrador permanecen montados al navegar entre productos, carrito y checkout. El carrito persiste al recargar; el borrador, las sesiones y los pedidos simulados permanecen en memoria.

Los componentes globales se encuentran en `src/shared/ui.jsx`; las etiquetas y la colección de mieles ya son compartidas. Un componente específico de pedidos, pagos o entregas permanece dentro de su módulo y se promueve a global si tiene uso común.

El contexto de pagos consulta al servicio y no aprueba pagos por parámetros de URL. Los permisos de los contextos serán una ayuda para la interfaz; la autorización real se valida en el servidor.

## Reglas acordadas

- El consumidor compra como invitado: no necesita cuenta ni login.
- Admin y delivery inician sesión exclusivamente desde `/staff`.
- El admin accede a toda la gestión; el delivery solo a sus entregas asignadas y los datos necesarios para realizarlas.
- Cada pedido ingresa como **pendiente de entrega**, con su pago inicialmente pendiente.
- Solo un pago aprobado habilita la preparación y asignación del despacho.
- Pedido, venta y despacho comparten información; no se vuelven a ingresar los datos manualmente.
- Los pedidos reales se cancelan o archivan, conservando su historial. La eliminación se reserva para datos de prueba.
- En este alcance, “Ventas / Facturación” significa registro interno de ventas y pagos. La emisión de boletas o facturas tributarias será una integración por definir y no se considerará resuelta por ese registro.

## Etapa 1 — Preparar la estructura del frontend

- [x] Mantener React + Vite y organizar módulos para tienda, compra, staff, pedidos, ventas y entregas.
- [x] Crear componentes compartidos: botones, tarjetas de acceso, filtros, listas, detalle, formularios, confirmaciones y mensajes de estado.
- [x] Definir rutas públicas: `/`, `/productos`, `/productos/:slug`, `/carrito`, `/checkout` y `/checkout/resultado`.
- [x] Definir rutas staff: `/staff`, `/staff/admin`, `/staff/admin/pedidos`, `/staff/admin/ventas`, `/staff/admin/despachos`, `/staff/admin/equipo` y `/staff/delivery`.
- [x] Separar el acceso a los datos de las pantallas mediante servicios intercambiables: primero simulados, después conectados a la API.
- [x] Mantener claramente identificado el modo de demostración en compra y staff mientras no exista conexión real.
- [x] Inyectar los servicios mediante un contexto global reemplazable, sin imports directos del adaptador en las pantallas.
- [x] Crear bases de contextos por módulo: catálogo, carrito, compra, pagos, sesión, pedidos y equipo.
- [x] Montar los contextos por ámbito y centralizar la fuente de pedidos para las vistas operativas.
- [x] Comprobar los ámbitos de los contextos y la sustitución del adaptador sin modificar componentes.

**Resultado esperado:** las pantallas se pueden desarrollar sin depender todavía de una base de datos.

**Verificación:** `npm.cmd run build` y `npm.cmd run check:structure` completados. Las rutas de compra y staff son estructuras de demostración; el carrito, login, permisos y operaciones se implementarán en las etapas siguientes. El catálogo existente ya se obtiene mediante el servicio intercambiable.

## Etapa 2 — Definir los datos y estados compartidos

- [x] Definir pedido: identificador, número visible, comprador, destinatario, productos, cantidades, precios, subtotal, despacho y total.
- [x] Separar comprador y destinatario, usando por defecto los mismos datos y permitiendo indicar otra persona para recibir.
- [x] Registrar nombre, correo y teléfono del comprador; nombre y teléfono del destinatario; dirección, comuna, departamento y referencias de entrega.
- [x] Incorporar un campo de indicaciones del comprador: “dejar con el conserje”, “solo entregar al destinatario” u otras precisiones.
- [x] Definir pago: identificador de transacción, pedido relacionado, monto, estado y fechas de creación y aprobación.
- [x] Definir despacho: pedido relacionado, delivery asignado, estado y fecha efectiva de entrega.
- [x] Definir comentarios internos e historial: texto o acción, autor y fecha; separados de las indicaciones originales del comprador.
- [x] Guardar los productos y precios cobrados como parte del pedido, aunque el catálogo cambie después.
- [x] Usar estados de pago: pendiente, aprobado, rechazado y reembolsado.
- [x] Usar estados operativos: pendiente, listo para despacho, en reparto, entregado y entrega no realizada; registrar la cancelación por separado.
- [x] Dejar la fecha de entrega vacía hasta confirmar la entrega y registrarla automáticamente al hacerlo.
- [x] Definir las consultas por día, semana y mes usando la zona horaria `America/Santiago`; considerar semanas de lunes a domingo.

**Resultado esperado:** todas las vistas trabajan con la misma información y distinguen pago de entrega.

**Organización:** definir los modelos compartidos dentro de sus módulos y consumirlos desde los contextos existentes; los datos de prueba y los futuros servicios reales usarán el mismo contrato.

**Verificación:** `npm.cmd run test:domain` (20 pruebas), `npm.cmd run check:structure` y `npm.cmd run build` completados. Esquema y reglas documentados en [Modelo comercial compartido](./src/modules/MODELO_COMERCIAL.md). No se implementaron todavía formularios de checkout, acciones del dashboard ni cobros reales.

## Etapa 3 — Construir el carrito

- [x] Habilitar agregar productos, modificar cantidades y retirarlos del carrito.
- [x] Mostrar producto, formato, cantidad, precio unitario, subtotal y total.
- [x] Mantener el carrito al recargar y ofrecer acceso al checkout.
- [x] Mostrar un estado vacío claro cuando no existan productos.
- [x] Usar los precios acordados: multifloral de 1 kg a $6.990; cerezo y avellana de 1 kg a $9.000, en CLP.

**Implementación:** ficha de producto con selector de cantidad, agregado y confirmación; contador compartido en el encabezado; edición, retiro y vaciado con confirmación; persistencia local de productos y cantidades. Precios y disponibilidad se resuelven desde el catálogo, bloqueando el checkout si un formato deja de estar disponible. El despacho se calcula en la etapa 4 y no se incluye aún en el total de productos.

**Verificación:** pruebas de carrito en `npm.cmd run test:cart`, además de dominio, estructura y compilación. Pendiente revisión visual interactiva en móvil y escritorio.

**Continuación implementada:** el checkout como invitado con pedido y pago simulados se detalla en la etapa 4. Cobertura y tarifa reales siguen pendientes de definición antes de habilitar cobros reales.

## Etapa 4 — Construir el checkout sin login

- [x] Crear el formulario de comprador, destinatario, dirección e indicaciones de entrega.
- [x] Validar los campos obligatorios y mostrar errores junto al campo correspondiente.
- [x] Mostrar un resumen con productos, cantidades, subtotal, costo de despacho y total antes de pagar.
- [ ] Definir la cobertura y el costo inicial de despacho antes de habilitar cobros reales; no dejar ese importe ambiguo al comprador.
- [x] Crear el pedido pendiente al iniciar el pago y simular el paso a Mercado Pago.
- [x] Evitar envíos repetidos del formulario mientras se procesa la solicitud.
- [x] Preparar la pantalla de resultado para pago aprobado, pendiente, rechazado y error de conexión.
- [x] Mostrar número de pedido y resumen cuando corresponda; permitir reintentar el pago sin duplicar el pedido.

**Implementación de demostración:** `/checkout` valida comprador, destinatario alternativo, correo, teléfonos y dirección; muestra cantidades, importes y despacho ficticio fijo de $3.000 CLP para cualquier comuna de prueba. No representa cobertura comercial. `/checkout/resultado` consulta el pago al servicio y permite elegir resultados de simulación, sin aprobar por parámetros de URL ni conectar con Mercado Pago. Los reintentos tras rechazo agregan un intento al mismo pedido; una referencia de solicitud evita crear pedidos repetidos. El carrito descuenta la selección comprada una sola vez tras aprobación, conservando productos añadidos después.

**Verificación:** `npm.cmd run test:checkout`, `npm.cmd run test:cart`, `npm.cmd run test:domain`, `npm.cmd run check:structure` y `npm.cmd run build`. Revisión interactiva en navegador pendiente. Pedidos y borrador siguen en memoria: recargar reinicia la demostración y se informa en el resultado.

**Pendiente comercial:** definir cobertura y tarifa reales antes de habilitar cobros; por eso ese checkbox continúa abierto. El acceso staff y la navegación por rol ya se detallan como implementados en la etapa 5.

**Resultado esperado:** se puede recorrer una compra completa como invitado usando una simulación identificada.

## Etapa 5 — Crear el acceso staff y la navegación por rol

- [x] Construir el login en `/staff`, cierre de sesión y mensajes de acceso denegado o sesión vencida.
- [x] Simular sesiones de admin y delivery con datos de demostración.
- [x] Redirigir cada rol a su dashboard y ocultar los accesos que no le corresponden.
- [x] Mostrar al admin los botones **Pedidos**, **Ventas / Facturación**, **Despachos** y **Equipo**, con contadores breves.
- [x] Mostrar al delivery los botones **Pendientes de entrega** e **Historial de entregas**.
- [x] Mantener las listas cerradas hasta elegir una sección y conservar los filtros al volver desde un detalle.

**Implementación:** cuentas públicas ficticias `admin@casamiel.demo` y `delivery@casamiel.demo`, contraseña `demo1234`. El formulario permite completar una cuenta de prueba y exige enviar el login. Sesiones en memoria con duración de 30 minutos; cierre y vencimiento eliminan la sesión y los filtros de interfaz. Las rutas staff muestran estados de carga, fallo de consulta, acceso requerido o denegado, sin renderizar la pantalla restringida. Admin abre sus cuatro secciones con contadores; delivery elige pendientes o historial de sus asignaciones. No se realizan consultas de pedidos sin sesión ni de equipo con rol delivery; el contexto de pedidos descarta resultados de otra identidad y expone solo asignaciones al delivery.

**Navegación:** búsquedas y selección del panel delivery permanecen en `useSession().views` mientras se navega dentro de staff. Se verificó volver al panel y reabrir Pedidos conservando la búsqueda. Los futuros detalles y filtros operativos de etapas 6–8 deberán consumir este estado compartido para conservarlo también al volver desde un registro.

**Verificación:** 31 pruebas de dominio/carrito/checkout/staff, `npm.cmd run check:structure`, `npm.cmd run build` y `npm.cmd run check:staff-browser`. La prueba interactiva cubre ambos roles, cierre, vencimiento, acceso directo denegado, listas cerradas y conservación de búsquedas. La gestión de registros y acciones operativas sigue en sus etapas correspondientes; la autorización real sigue pendiente del servidor.

**Continuación implementada:** gestión de pedidos del admin detallada en la etapa 6.

**Resultado esperado:** navegación funcional por rol. La protección real se implementa en el backend, en la etapa 11.

## Etapa 6 — Implementar la gestión de pedidos del admin

- [x] Mostrar pedidos ordenados cronológicamente, con los más recientes primero.
- [x] Incorporar filtros por pendientes, entregados y todos, además de búsqueda por número o comprador.
- [x] Mostrar en el listado: número, fecha de ingreso, comprador, total, estado de pago y estado de entrega.
- [x] Abrir el detalle con productos, cantidades, precios, total pagado, comprador, destinatario, dirección e indicaciones.
- [x] Mostrar fecha de ingreso, aprobación del pago, entrega efectiva y comentarios con autor y fecha.
- [x] Permitir corregir datos operativos e indicaciones, dejando constancia del cambio.
- [x] Impedir que editar un pedido pagado altere silenciosamente los productos o el monto cobrado.
- [x] Permitir marcar entregado, pendiente o entrega no realizada, con confirmación e historial; conservar las fechas anteriores si se corrige un estado.
- [x] Incorporar cancelar y archivar; permitir borrar únicamente registros de prueba, con confirmación.
- [x] Evitar que cancelar un pedido se muestre como un reembolso efectuado si ese movimiento de dinero no ocurrió.

**Implementación:** listado en `/staff/admin/pedidos` y detalle en `/staff/admin/pedidos/:id`. La búsqueda, filtro y opción de incluir archivados se conservan al volver. Pendientes excluye cancelados y entregados; Todos permite recuperar cancelados. Los archivados se muestran al activar su opción. Las fechas se presentan en `America/Santiago`.

El detalle comparte `OrderRecordDetails` para futuras vistas de ventas: productos e importes, datos de contacto, indicaciones originales y operativas, intentos de pago, fechas, comentarios e historial. Las correcciones requieren motivo y confirmación con valores anteriores/nuevos; rechazan cualquier modificación de productos, comprador o importes. Las entregas fallidas y correcciones de entregas completadas requieren motivo. Cancelar o archivar conserva el pago y el historial; no admite nuevas correcciones operativas. Los comentarios internos siguen disponibles.

El adaptador obtiene autor y fecha de su sesión admin de prueba; no los toma del formulario. Solo elimina registros con `isTest === true`, marcado al crear pedidos en modo demo. Los números no se reutilizan al borrar y una solicitud asociada a un pedido eliminado no crea silenciosamente otro. No hay persistencia ni autorización de servidor todavía.

**Verificación:** 37 pruebas de dominio/carrito/checkout/staff/pedidos, `npm.cmd run check:structure`, `npm.cmd run build`, `npm.cmd run check:staff-browser` y `npm.cmd run check:orders-browser`. El flujo interactivo verifica corrección, importes intactos, comentarios, entrega, corrección con fecha anterior, entrega fallida, filtros al volver, cancelación sin reembolso, archivo y borrado de prueba. Vista móvil de 390 px comprobada sin desbordamiento y captura revisada en `.preview-browser/orders-mobile.png`.

**Continuación implementada:** consultas de Ventas / Facturación detalladas en la etapa 7.

## Etapa 7 — Implementar Ventas / Facturación

- [x] Mostrar primero botones de consulta, sin desplegar todas las transacciones: **Hoy**, **Esta semana**, **Este mes**, **Elegir fecha o período** y **Buscar venta**.
- [x] Permitir seleccionar un día, una semana, un mes o un rango de fechas, incluidos períodos anteriores.
- [x] Buscar por número de pedido, identificador de pago o datos del comprador.
- [x] Mostrar el total de ventas aprobadas del período y el listado correspondiente; identificar reembolsos por separado.
- [x] Usar la fecha de aprobación del pago para contabilizar la venta del período.
- [x] Abrir cada venta con detalle de productos, pago total, comprador, destinatario, dirección, ingreso del pedido, fecha de pago y fecha de entrega.
- [x] Mostrar indicaciones de entrega y comentarios internos desde el mismo registro utilizado en Pedidos.
- [x] Permitir acceder al pedido relacionado e incorporar comentarios sin duplicar la venta ni su información.

**Implementación:** `/staff/admin/ventas` permanece sin resultados hasta elegir una consulta. Incluye consultas rápidas y formulario para día, semana (lunes a domingo), mes o rango inclusivo, con fechas anteriores y validación. La búsqueda admite número de pedido, ID interno del pago, transacción, nombre, correo o teléfono del comprador; puede consultar todo el historial o combinarse con un período. La selección, borrador de consulta y resultados aplicados se conservan en `useSession().views.Ventas` al volver desde el detalle.

Las consultas usan `approvedAt` y el calendario `America/Santiago`. Los pagos pendientes y rechazados no se cuentan como ventas; los aprobados vigentes y los reembolsados tienen contadores e importes separados. Un reembolso se agrupa por aprobación de la venta original, no por fecha de devolución: estos resultados no son un reporte de movimientos de caja. Cancelar o archivar un pedido no elimina su cobro de Ventas.

El detalle `/staff/admin/ventas/:id` usa `OrderRecordDetails` y el nuevo `OrderCommentForm`, compartido también con Pedidos. Muestra el pago, productos, destinatario, dirección, indicaciones originales y operativas, comentarios, fechas e historial. Permite abrir el pedido relacionado y agregar comentarios al mismo registro sin duplicar la venta. Los cambios de entrega hechos en Pedidos se reflejan en Ventas. Las rutas quedan limitadas al admin mediante la navegación de demostración; la autorización real se mantiene pendiente del servidor.

**Verificación:** 43 pruebas de dominio/carrito/checkout/staff/pedidos/ventas, `npm.cmd run check:structure`, `npm.cmd run build` y recorridos interactivos de staff, pedidos y ventas. `npm.cmd run check:sales-browser` verifica consultas cerradas, períodos actuales/anteriores, rangos inválidos, búsqueda por pago, totales/reembolsos separados, comentario compartido, entrega actualizada, filtros al volver, carga fallida y reintento, estado vacío y bloqueo de delivery. Vista móvil de 390 px revisada en `.preview-browser/sales-mobile.png`, sin desbordamiento horizontal.

**Continuación implementada:** preparación de despachos, asignación y gestión operativa del delivery en la etapa 8. No se incluye emisión tributaria en el registro de Ventas.

## Etapa 8 — Implementar despachos y dashboard delivery

- [x] Mostrar al admin los pedidos pagados pendientes de preparar y los listos para despachar.
- [x] Permitir marcar un pedido como listo y asignarlo a un delivery activo.
- [x] Mostrar al delivery únicamente sus pedidos asignados, separados entre pendientes e historial.
- [x] Incluir productos, cantidades, destinatario, teléfono, dirección e indicaciones del comprador en cada entrega.
- [x] Dar acceso directo a llamar al destinatario y abrir la dirección en el mapa.
- [x] Permitir marcar **En reparto**, **Entregado** o **Entrega no realizada**.
- [x] Solicitar un motivo cuando la entrega no se realice y permitir agregar comentarios operativos.
- [x] Registrar automáticamente autor y fecha al confirmar la entrega; reflejar el cambio en Pedidos y Ventas.
- [x] Confirmar las acciones importantes y conservar el historial de correcciones.

**Implementación admin:** `/staff/admin/despachos` filtra pedidos pagados y activos por Por preparar, Listos para despacho, En reparto, Entrega no realizada y Entregados. Admite búsqueda por pedido, destinatario o comuna, conservada al volver del detalle. `/staff/admin/despachos/:id` confirma la preparación y asignación a un integrante delivery activo consultado desde Equipo. Preparar requiere estado pendiente o fallido; asignar/reasignar requiere listo para despacho, y reasignar exige motivo. Un pedido en reparto o completado no se reasigna directamente; las correcciones operativas continúan disponibles desde Pedidos.

**Implementación delivery:** `/staff/delivery` conserva pendientes e historial cerrados hasta elegir una sección. `/staff/delivery/:id` solo presenta una asignación propia, pagada y activa; el historial reúne las que están entregadas dentro de ese alcance. Muestra productos sin precios, cantidades, destinatario, contacto, dirección, referencias, indicaciones y comentarios; no entrega comprador ni importes de pago. Permite llamar, abrir el mapa, agregar comentarios y confirmar En reparto, Entregado o Entrega no realizada. Los fallos y correcciones de entregas completadas exigen motivo; se conservan fecha y autor anteriores en el historial. El servicio registra automáticamente la fecha y el autor de la sesión, con `deliveredBy` al confirmar entrega.

`orders.listAssigned()` y las respuestas a mutaciones de delivery usan `deliveryView()`. El adaptador demo rechaza consultas generales de pedidos, pagos y equipo cuando hay una sesión delivery, además de cambios sobre pedidos ajenos o acciones de admin. El contexto usa esa fuente acotada y no carga Equipo en delivery. Estas reglas simuladas no sustituyen autenticación y autorización del servidor de la etapa 11.

**Verificación:** 50 pruebas de dominio y módulos, `npm.cmd run check:structure`, `npm.cmd run build` y recorridos de navegador de staff, pedidos, ventas y despachos. `npm.cmd run check:deliveries-browser` recorre una compra como invitado con pago simulado, preparación/asignación admin y entrega delivery, con contacto/mapa, comentario, fallo con motivo, corrección conservando fecha y autor, historial, filtros al volver y bloqueo de una entrega ajena. Comprueba que delivery no reciba datos comerciales y que Pedidos y Ventas reflejen el mismo registro. Vista móvil de 390 px revisada en `.preview-browser/delivery-mobile.png`, sin desbordamiento.

**Continuación implementada:** alta de usuarios, cambios de rol y desactivación del equipo en la etapa 9.

## Etapa 9 — Implementar la gestión del equipo

- [x] Mostrar los usuarios staff con nombre, correo, rol y estado activo o inactivo.
- [x] Permitir al admin crear cuentas de admin o delivery, modificar roles y desactivar accesos.
- [x] Mostrar al delivery solo su sesión, sin acceso a gestión del equipo ni a ventas generales.
- [x] Evitar dejar el sistema sin ningún admin activo.

**Implementación:** lista con búsqueda y filtros conservados al navegar; alta validada de cuentas de prueba, correo único incluso entre inactivos, cambios de rol, desactivación/reactivación y confirmaciones. Historial de creación y cambios con autor, fecha y valores anteriores/nuevos. El adaptador y la interfaz protegen al último admin activo. Toda gestión exige una sesión admin activa en el adaptador demo.

Las cuentas nuevas usan la contraseña pública ficticia `demo1234`; los cambios viven en memoria y no envían invitaciones. Cambiar rol o estado invalida el acceso anterior mediante una versión de acceso. La sesión se revalida al recuperar foco y periódicamente; los cambios propios la invalidan inmediatamente. Se requiere un nuevo login. Desactivar un delivery conserva sus asignaciones, muestra un aviso si tiene entregas pendientes y bloquea nuevas asignaciones hasta reactivarlo. La autorización real corresponde a la etapa 11.

**Verificación:** 58 pruebas de módulos, comprobación de estructura, compilación y recorridos de navegador de Equipo y los módulos anteriores. `check:team-browser` cubre altas, campos inválidos, duplicados, filtros, roles, historial, desactivación/reactivación, último admin y revocación propia con acceso denegado al nuevo rol delivery. Vista móvil de 390 px en `.preview-browser/team-mobile.png`, sin desbordamiento.

**Continuación implementada:** revisión integral del frontend en la etapa 10.

## Etapa 10 — Revisar el frontend completo

- [x] Preparar datos simulados de pedidos con pagos pendientes, aprobados y rechazados; entregas pendientes, fallidas y completadas; comentarios e indicaciones especiales.
- [x] Recorrer el flujo comprador → pago simulado → pedido del admin → asignación → entrega → venta actualizada.
- [x] Comprobar formularios, estados vacíos, carga, errores, confirmaciones y navegación de regreso.
- [x] Revisar dashboards y formularios desde móvil y escritorio, incluyendo teclado y foco visible.
- [x] Verificar que el frontend no guarda credenciales reales ni presenta un pago simulado como real.

**Implementación y revisión:** siete escenarios reproducibles exclusivos de pruebas, recorrido integral y capturas a 1280/390 px, con Checkout adicional a 360 px. Se corrigió el foco tras navegar y se respetó la preferencia de movimiento reducido. Se verificaron etiquetas, primer error enfocado, teclado dentro de confirmaciones, Escape y restauración del foco, estados de consulta y ausencia de contraseñas en almacenamiento web. Evidencia, alcance y limitaciones en [REVISION_FRONTEND.md](./REVISION_FRONTEND.md).

**Verificación:** 59 pruebas, `check:structure`, compilación y seis recorridos de navegador: staff, pedidos, ventas, despachos, equipo y `check:review-browser`. El recorrido de despachos confirma el flujo completo y sus cambios compartidos con Ventas.

**Siguiente etapa:** etapa 11, backend, base de datos y permisos reales. Cobertura/tarifa comercial de etapa 4 sigue pendiente; no se habilitan cobros reales con esta revisión.

**Hito:** frontend funcional y revisado, listo para conectarse a servicios reales.

## Etapa 11 — Levantar backend, base de datos y permisos reales

- [x] Elegir el backend, base de datos y servicio de autenticación que reemplazarán los servicios simulados.
- [ ] Crear los registros de staff, pedidos, productos del pedido, pagos, asignaciones, comentarios e historial.
- [ ] Implementar autenticación, sesiones, cierre de sesión y creación segura de cuentas staff.
- [ ] Validar permisos en cada operación del servidor: admin con gestión completa y delivery limitado a sus asignaciones y acciones de entrega.
- [ ] Implementar creación de pedidos públicos sin exigir una cuenta de consumidor.
- [ ] Validar precios, cantidades, cobertura y costo de despacho desde el servidor, sin confiar en importes enviados por el navegador.
- [ ] Proteger los datos personales: no permitir consultar pedidos ajenos adivinando su número; usar una referencia privada para la confirmación de compra.
- [ ] Conectar Pedidos, Ventas, Despachos y Equipo a los registros reales, manteniendo filtros y orden acordados.
- [ ] Registrar cambios de estado, comentarios y fechas en el servidor; aplicar restricciones para evitar ventas y pagos duplicados.

**En curso:** API Node para Vercel, adaptador HTTP y migraciones PostgreSQL/Supabase Auth preparados. Se implementaron permisos, sesiones revocables, alta de staff, referencias privadas, validación de importes/cobertura y escrituras con revisión. Las restantes casillas siguen abiertas hasta aplicar y validar la base real. 74 pruebas de módulos y recorrido HTTP de navegador con repositorio temporal; esto no valida SQL ni Auth alojado. Configuración y pendientes en [BACKEND.md](./BACKEND.md). No se activaron servicios externos.

## Etapa 12 — Conectar Mercado Pago

- [ ] Configurar Checkout Pro con la cuenta receptora y credenciales de prueba; mantener las credenciales privadas en el backend.
- [ ] Crear el inicio de pago desde el servidor y asociarlo al pedido mediante una referencia única.
- [ ] Configurar las URLs de regreso y el endpoint de notificaciones de pago.
- [ ] Validar la autenticidad de las notificaciones y consultar el pago a Mercado Pago para verificar estado, monto, moneda y pedido asociado.
- [ ] Registrar cada intento de pago y confirmar la venta solo al verificar un pago aprobado.
- [ ] Procesar notificaciones repetidas sin duplicar ventas, despachos ni cambios de estado.
- [ ] Mostrar “verificando pago” cuando el comprador regrese antes de recibir la confirmación; no aprobarlo a partir de parámetros de la URL.
- [ ] Habilitar la preparación y asignación del pedido después de confirmar el pago.
- [ ] Reflejar pagos rechazados, pendientes y reembolsados en el registro interno.

**Preparación de la primera iteración terminada:** cliente REST de Checkout Pro, reserva de preferencia, URLs de regreso, webhook HMAC con consulta posterior del recurso, conciliación de estados y escritura transaccional/idempotente preparados. Panel con consulta de estado y pago desactivado por defecto. 14 pruebas específicas y recorrido de navegador con respuestas locales; 88 pruebas de módulos en total. No se solicitaron credenciales ni se configuraron variables; no hubo cobros ni solicitudes a la API del proveedor.

**Segunda iteración pendiente:** levantar la base, validar ambas migraciones, captar credenciales, configurar variables y webhook, verificar regresos privados y probar el flujo real en sandbox. Las casillas de integración permanecen abiertas hasta esa validación. Detalles y límites en [MERCADOPAGO.md](./MERCADOPAGO.md).

## Etapa 13 — Validar y habilitar la operación inicial

**Primera iteración — preparación local:** incorporados cuatro escenarios de operación completos sobre API con dobles de base de datos y proveedor, y el comando `npm.cmd run check:operation` para reunir pruebas, estructura, compilaciones API/demo y ocho recorridos de navegador. La suite suma 92 pruebas de módulos. El informe local distingue explícitamente sus resultados de la habilitación de producción. Procedimiento y límites en [OPERACION_INICIAL.md](./OPERACION_INICIAL.md).

**Segunda iteración pendiente:** ejecutar la validación contra base de datos y proveedor reales, resolver las condiciones comerciales, emisión tributaria, respaldo y restauración, configurar producción y efectuar una compra controlada. Las casillas siguientes permanecen abiertas hasta obtener esa evidencia externa.

- [ ] Probar una compra aprobada, una rechazada, una pendiente y un reintento sobre el mismo pedido.
- [ ] Probar regreso tardío del comprador, notificación repetida e interrupción de conexión sin perder ni duplicar registros.
- [ ] Confirmar que un delivery no puede consultar ni modificar pedidos ajenos, pagos, ventas generales o usuarios.
- [ ] Comprobar los filtros por fecha y el detalle compartido entre venta y pedido, incluida la fecha de entrega y los comentarios.
- [ ] Validar cobertura, tarifa de despacho, cuenta receptora y precios antes de activar el pago real.
- [ ] Definir y resolver el mecanismo de emisión tributaria necesario para la puesta en marcha, como alcance específico separado del registro interno.
- [ ] Configurar el entorno de producción, credenciales reales y cuentas iniciales del equipo; retirar accesos y registros de demostración.
- [ ] Verificar respaldo de los registros y acceso del admin antes de comenzar a recibir pedidos reales.
- [ ] Ejecutar una compra real controlada y comprobar recepción del pago, venta, asignación y entrega de principio a fin.

**Criterio de cierre:** el comprador paga sin registrarse; el admin recibe un pedido con pago verificable; el delivery gestiona su entrega; la venta y el pedido conservan datos, comentarios, fechas e historial consistentes.

## Fuera del alcance inicial

No se incluyen cuentas de consumidores, fidelización, cupones, optimización de rutas, múltiples bodegas, reportes avanzados ni automatizaciones de marketing. La emisión tributaria se definirá por separado; no se desarrollará un motor tributario propio como parte de este plan.
