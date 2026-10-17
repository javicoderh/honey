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
| Pedidos (`useOrders`) | Modelo, lista compartida, consultas, edición operativa, comentarios, estados, cancelación, archivo y borrado de prueba | Preparación y asignaciones de despacho: etapa 8. |
| Equipo (`useTeam`) | Lista compartida y `refreshTeam` | Alta, roles y desactivación: etapa 9. |

Ventas y entregas son vistas derivadas del registro compartido de pedidos y sus pagos asociados, sin mantener copias independientes. El esquema y las consultas base están implementados en la etapa 2; las pantallas se completan en las etapas 7 y 8. La fuente de pedidos del backend deberá limitar sus resultados según la sesión y el rol.

Los servicios se inyectan mediante `ServicesProvider`. `AppProviders` monta catálogo, carrito y borrador en la tienda; pagos solamente en checkout y resultado; sesión y pedidos en staff; equipo en el panel admin (para el contador) y en su sección. Pedidos no se consultan sin sesión y equipo solo se consulta con rol admin. Carrito y borrador permanecen montados al navegar entre productos, carrito y checkout. El carrito persiste al recargar; el borrador, las sesiones y los pedidos simulados permanecen en memoria.

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

**Siguiente etapa:** etapa 7, consultas de Ventas / Facturación como registro interno.

## Etapa 7 — Implementar Ventas / Facturación

- [ ] Mostrar primero botones de consulta, sin desplegar todas las transacciones: **Hoy**, **Esta semana**, **Este mes**, **Elegir fecha o período** y **Buscar venta**.
- [ ] Permitir seleccionar un día, una semana, un mes o un rango de fechas, incluidos períodos anteriores.
- [ ] Buscar por número de pedido, identificador de pago o datos del comprador.
- [ ] Mostrar el total de ventas aprobadas del período y el listado correspondiente; identificar reembolsos por separado.
- [ ] Usar la fecha de aprobación del pago para contabilizar la venta del período.
- [ ] Abrir cada venta con detalle de productos, pago total, comprador, destinatario, dirección, ingreso del pedido, fecha de pago y fecha de entrega.
- [ ] Mostrar indicaciones de entrega y comentarios internos desde el mismo registro utilizado en Pedidos.
- [ ] Permitir acceder al pedido relacionado e incorporar comentarios sin duplicar la venta ni su información.

## Etapa 8 — Implementar despachos y dashboard delivery

- [ ] Mostrar al admin los pedidos pagados pendientes de preparar y los listos para despachar.
- [ ] Permitir marcar un pedido como listo y asignarlo a un delivery activo.
- [ ] Mostrar al delivery únicamente sus pedidos asignados, separados entre pendientes e historial.
- [ ] Incluir productos, cantidades, destinatario, teléfono, dirección e indicaciones del comprador en cada entrega.
- [ ] Dar acceso directo a llamar al destinatario y abrir la dirección en el mapa.
- [ ] Permitir marcar **En reparto**, **Entregado** o **Entrega no realizada**.
- [ ] Solicitar un motivo cuando la entrega no se realice y permitir agregar comentarios operativos.
- [ ] Registrar automáticamente autor y fecha al confirmar la entrega; reflejar el cambio en Pedidos y Ventas.
- [ ] Confirmar las acciones importantes y conservar el historial de correcciones.

## Etapa 9 — Implementar la gestión del equipo

- [ ] Mostrar los usuarios staff con nombre, correo, rol y estado activo o inactivo.
- [ ] Permitir al admin crear cuentas de admin o delivery, modificar roles y desactivar accesos.
- [ ] Mostrar al delivery solo su sesión, sin acceso a gestión del equipo ni a ventas generales.
- [ ] Evitar dejar el sistema sin ningún admin activo.

## Etapa 10 — Revisar el frontend completo

- [ ] Preparar datos simulados de pedidos con pagos pendientes, aprobados y rechazados; entregas pendientes, fallidas y completadas; comentarios e indicaciones especiales.
- [ ] Recorrer el flujo comprador → pago simulado → pedido del admin → asignación → entrega → venta actualizada.
- [ ] Comprobar formularios, estados vacíos, carga, errores, confirmaciones y navegación de regreso.
- [ ] Revisar dashboards y formularios desde móvil y escritorio, incluyendo teclado y foco visible.
- [ ] Verificar que el frontend no guarda credenciales reales ni presenta un pago simulado como real.

**Hito:** frontend funcional y revisado, listo para conectarse a servicios reales.

## Etapa 11 — Levantar backend, base de datos y permisos reales

- [ ] Elegir el backend, base de datos y servicio de autenticación que reemplazarán los servicios simulados.
- [ ] Crear los registros de staff, pedidos, productos del pedido, pagos, asignaciones, comentarios e historial.
- [ ] Implementar autenticación, sesiones, cierre de sesión y creación segura de cuentas staff.
- [ ] Validar permisos en cada operación del servidor: admin con gestión completa y delivery limitado a sus asignaciones y acciones de entrega.
- [ ] Implementar creación de pedidos públicos sin exigir una cuenta de consumidor.
- [ ] Validar precios, cantidades, cobertura y costo de despacho desde el servidor, sin confiar en importes enviados por el navegador.
- [ ] Proteger los datos personales: no permitir consultar pedidos ajenos adivinando su número; usar una referencia privada para la confirmación de compra.
- [ ] Conectar Pedidos, Ventas, Despachos y Equipo a los registros reales, manteniendo filtros y orden acordados.
- [ ] Registrar cambios de estado, comentarios y fechas en el servidor; aplicar restricciones para evitar ventas y pagos duplicados.

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

## Etapa 13 — Validar y habilitar la operación inicial

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
