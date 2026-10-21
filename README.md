# Casa Miel — React + Vite

Plataforma comercial construida con React y Vite, API en Vercel y persistencia/autenticación en Supabase. Incluye carrito, pedidos, equipo, entregas y audiencias de marketing. Mercado Pago y el proveedor de correos siguen pendientes de habilitación; el registro interno de ventas no emite documentos tributarios.

La revisión de textos, propuestas de conversión y plan de SEO orgánico están en [PLAN_CONTENIDOS_CONVERSION_SEO.md](./PLAN_CONTENIDOS_CONVERSION_SEO.md). La base técnica y su mantenimiento están en [SEO.md](./SEO.md).

## Ejecutar

```powershell
npm.cmd install
npm.cmd run dev
```

## Compilar

```powershell
npm.cmd run build
```

La compilación genera HTML por ruta, metadatos, sitemap y robots. Los productos se cargan desde el fallback local `src/data/products.js` en ambos modos, sin consultar la base de datos ni el endpoint de catálogo durante la compilación o la navegación. El servidor usa esa misma fuente para calcular los importes de nuevos pedidos y las selecciones guardadas. Para cambiar fichas, formatos o precios, editar ese archivo y volver a desplegar. Pedidos, sesiones y demás operaciones en modo API mantienen su conexión al backend.

Las dependencias nativas de Rolldown y Lightning CSS son opcionales y se seleccionan según el sistema operativo. No se deben añadir sus paquetes `win32` como dependencias obligatorias: el despliegue de Vercel usa Linux. El lockfile incluye las variantes de plataforma y permite instalar con `npm ci`; en Vercel, la compilación es `npm run build` y el directorio de salida es `dist`.

## Estructura

En PowerShell se usa `npm.cmd` para evitar el bloqueo de `npm.ps1` sin cambiar la política de ejecución del sistema. Vite excluye del seguimiento el perfil `.preview-browser` y las cachés locales para evitar errores `EBUSY` por archivos bloqueados.

- `src/data/products.js`: fallback de catálogo y precios compartido por tienda, servidor y SEO; incluye miel clásica, multifloral, cerezo y avellano, polen y jalea real.
- `src/modules/store/`: catálogo y rutas de la tienda existente.
- `src/modules/purchase/`: checkout, validación, borrador y resultado de compra.
- `src/modules/cart/` y `payments/`: carrito persistente y consulta/simulación de pagos.
- `src/modules/AppProviders.jsx`: composición de contextos según la ruta.
- `src/modules/staff/`: login, sesión, rutas por rol, panel admin y estado compartido de búsquedas.
- `src/modules/orders/`, `sales/` y `deliveries/`: puntos de entrada de cada módulo operativo.
- `src/services/index.js`: contrato y selección del adaptador de datos.
- `src/services/ServicesContext.jsx`: inyección del adaptador para todos los módulos.
- `src/services/mock.js`: datos simulados; sin persistencia de pedidos ni cuentas reales.
- `src/shared/ui.jsx`: botones, tarjetas, filtros, listas, detalle, campos, confirmaciones y estados compartidos.
- `src/pages/`: vistas de presentación de la tienda.
- `src/components/`: elementos compartidos.
- `src/styles.css`: sistema visual.
- `src/router.js`: navegación ligera basada en History API.

## Rutas

- `/`
- `/productos`
- `/productos/:slug`
- `/nosotros`
- `/contacto`
- `/carrito`
- `/checkout`
- `/checkout/resultado`
- `/staff`
- `/staff/admin`
- `/staff/admin/pedidos`
- `/staff/admin/pedidos/:id`
- `/staff/admin/ventas`
- `/staff/admin/ventas/:id`
- `/staff/admin/despachos`
- `/staff/admin/despachos/:id`
- `/staff/admin/equipo`
- `/staff/delivery`
- `/staff/delivery/:id`

El pie de página incluye “Acceso equipo”. En `/staff` puedes iniciar sesión con `admin@casamiel.demo` o `delivery@casamiel.demo`, contraseña pública ficticia `demo1234`. Cada cuenta abre su panel y las rutas ajenas muestran acceso denegado. La sesión dura 30 minutos y se mantiene en memoria al navegar, incluso al salir y volver a staff; recargar reinicia la demostración. El botón Cerrar sesión limpia la sesión y sus filtros. Estas restricciones son de interfaz; la autorización real se implementará en el backend.

## Servicios y comprobación de estructura

Las pantallas consumen los contextos de sus módulos. Solo los contextos consultan `useServices()`; los componentes de presentación no importan los adaptadores. El contrato expone `catalog.list`, `auth.getSession/login/logout`, `orders.list/listAssigned/getById/create/update`, `payments.getForOrder` y `staff.list`; el adaptador demo añade `payments.simulate` y cuentas de prueba. `createServices(adapter)` valida la implementación, y `<AppProviders adapter={adapter}>` permite sustituirla para toda la aplicación sin reescribir pantallas.

Los hooks disponibles son `useCatalog`, `useCart`, `usePurchase`, `usePayment`, `useSession`, `useOrders` y `useTeam`. Ventas y despachos consultan la fuente compartida de pedidos, sin listas de negocio duplicadas. La API base y las operaciones pendientes de cada contexto están detalladas en el plan.

Los contextos de tienda se mantienen al pasar de productos a carrito y checkout; pagos se monta solo en checkout y resultado. Staff usa sesión y pedidos, con equipo en el panel admin, Equipo y Despachos. Los pedidos se cargan tras autenticar; equipo se consulta solo con rol admin. El delivery usa `orders.listAssigned()`: recibe únicamente asignaciones propias activas, con productos, destinatario y datos de entrega, sin comprador, precios ni importes de pagos. El carrito guarda la selección en localStorage y resuelve precios desde el catálogo actual. El checkout crea pedidos simulados y permite reintentar el pago; el admin gestiona esos pedidos con historial. Borrador y pedidos siguen en memoria. Autenticación y cobros reales siguen pendientes.

```powershell
npm.cmd run check:structure
npm.cmd run test:domain
npm.cmd run test:cart
npm.cmd run test:checkout
npm.cmd run test:staff
npm.cmd run test:orders
npm.cmd run test:sales
npm.cmd run test:deliveries
npm.cmd run test:team
npm.cmd run test:review
npm.cmd run test:validation
npm.cmd run test:api
npm.cmd run test:mercadopago
npm.cmd run check:staff-browser
npm.cmd run check:orders-browser
npm.cmd run check:sales-browser
npm.cmd run check:deliveries-browser
npm.cmd run check:team-browser
npm.cmd run check:review-browser
npm.cmd run check:api-browser
npm.cmd run check:mercadopago-browser
```

Esta comprobación valida los servicios, la inyección de adaptadores, los ámbitos de los contextos, la fuente compartida de pedidos, los precios acordados y el renderizado inicial de las rutas. No sustituye una revisión visual en el navegador ni las futuras pruebas de compra, autenticación y permisos reales.

`check:staff-browser` abre Edge en modo headless con un perfil de prueba en `.preview-browser/staff-check`, sirve la app localmente en el puerto 5179 y usa el puerto 9231 para comprobar login, logout, rutas por rol, contadores, navegación, búsquedas y vencimiento. Requiere Edge instalado en Windows; puedes indicar otra ruta con `EDGE_PATH`.

`check:orders-browser` usa el mismo entorno para recorrer la gestión completa de un pedido, verificar importes e historial y capturar la vista móvil en `.preview-browser/orders-mobile.png`. `check:sales-browser` revisa períodos, búsquedas, totales/reembolsos, detalle compartido, comentarios, entrega actualizada y errores de consulta; captura `.preview-browser/sales-mobile.png`. Ejecuta las pruebas de navegador de forma secuencial porque comparten puertos y perfil.

`check:deliveries-browser` recorre compra invitada, pago simulado, preparación/asignación admin y entrega delivery, incluidos motivos, correcciones, comentarios, ámbito de datos, contactos y sincronización con Pedidos/Ventas. Captura `.preview-browser/delivery-mobile.png`.

El avance y los siguientes pasos se registran en [PLAN_IMPLEMENTACION_COMERCIAL.md](./PLAN_IMPLEMENTACION_COMERCIAL.md).

`check:team-browser` comprueba altas, validación, duplicados, roles, desactivación/reactivación, historial, protección del último admin y revocación de la sesión propia. Captura `.preview-browser/team-mobile.png`. La suite de módulos reúne 92 pruebas.

`check:review-browser` inyecta siete escenarios ficticios exclusivos de prueba y verifica estados de consulta, formularios, teclado y foco, confirmaciones, almacenamiento y avisos de simulación. Captura dashboards y formularios a 1280/390 px, además de Checkout a 360 px. El alcance y los resultados están en [REVISION_FRONTEND.md](./REVISION_FRONTEND.md).

Equipo permite crear cuentas admin o delivery con la contraseña ficticia `demo1234`. Los cambios de rol y estado invalidan el acceso anterior; se exige iniciar sesión nuevamente. El último admin activo está protegido. Desactivar un delivery conserva sus asignaciones para revisión del admin, pero bloquea su acceso y nuevas asignaciones. Las cuentas y cambios se reinician al recargar; no se envían invitaciones.

El [Modelo comercial compartido](./src/modules/MODELO_COMERCIAL.md) documenta comprador y destinatario, productos e importes congelados, pagos, entregas, comentarios, historial, equipo y calendario chileno.

Para publicar una SPA, el hosting debe redirigir las rutas desconocidas a `index.html`.

## Probar una compra simulada

Agrega una miel desde su ficha, abre el carrito y continúa al checkout. Completa los datos de comprador y entrega; puedes indicar otro destinatario. El resumen incluye un despacho ficticio de $3.000 CLP para cualquier comuna de prueba, sin representar cobertura real. Al continuar se crea un pedido pendiente y se abre el simulador que representa el paso a Mercado Pago; permite aprobar, dejar pendiente, rechazar o simular error de conexión.

El resultado muestra el número, productos, importes y datos de entrega. Reintentar conserva el pedido y registra otro intento si el anterior fue rechazado. No se envían datos a Mercado Pago ni se cobran fondos. Pedidos y borrador se mantienen en memoria y se reinician al recargar; únicamente el carrito persiste en localStorage. Los estados de pago se consultan al servicio, nunca se aprueban por parámetros de URL.

## Gestionar pedidos de demostración

Después de crear una compra, navega a `/staff` sin recargar, inicia sesión como admin y abre Pedidos. Puedes filtrar pendientes, entregados o todos, buscar por número/comprador y consultar archivados. El detalle permite corregir destinatario, dirección e indicaciones, agregar comentarios, confirmar estados de entrega, cancelar o archivar. Las correcciones y acciones importantes se confirman y guardan autor, fecha, motivo y datos anteriores en el historial. Los productos, comprador y montos cobrados se conservan.

Cancelar no efectúa un reembolso. Solo los registros con marca explícita de prueba pueden eliminarse. Las acciones del adaptador demo requieren su sesión admin; esto no sustituye la autorización del futuro backend. No hay pedidos precargados: se crean desde el checkout de prueba.

## Consultar ventas

En el panel admin abre Ventas / Facturación y elige Hoy, Esta semana, Este mes, Elegir fecha o período o Buscar venta. Puedes consultar fechas anteriores, combinar un período con búsqueda o buscar por pedido, ID de pago/transacción y contacto del comprador en todo el historial. Solo se muestran pagos que llegaron a aprobarse, con reembolsos separados; las fechas se calculan por aprobación en Chile. Los reembolsos corresponden a las ventas originales del período y pueden haberse efectuado en otra fecha.

Abre una venta para revisar sus datos, agregar comentarios internos o ir al pedido relacionado. Los comentarios y fechas de entrega son los mismos de Pedidos; al volver se conserva la consulta. Un pedido cancelado o archivado conserva su registro de pago. Este módulo no emite documentos tributarios.

## Preparar y entregar

Como admin, abre Despachos, elige Por preparar y abre un pedido pagado. Confirma Marcar listo para despacho, selecciona un delivery activo y confirma su asignación. Puedes buscar destinatario o comuna y consultar los demás estados. Solo se asignan pedidos listos; una reasignación exige motivo.

Cierra la sesión e ingresa como delivery. En Pendientes de entrega abre tu asignación: incluye productos, cantidades, destinatario, teléfono, dirección, referencias e indicaciones, con enlaces para llamar y abrir el mapa. Puedes agregar comentarios y marcar En reparto, Entregado o Entrega no realizada. Los fallos y las correcciones de entregas completadas requieren motivo; la fecha y autor anteriores permanecen en el historial. Las entregas completadas pasan a Historial. El admin ve los cambios en Pedidos y Ventas desde el mismo registro. Todos estos flujos usan datos simulados en memoria.

## Backend conectado

La etapa 11 incorpora API Node, adaptador HTTP, sesiones de servidor y migraciones para Supabase/PostgreSQL. Dominio de referencia: [honey-d164.vercel.app/staff](https://honey-d164.vercel.app/staff), proyecto Vercel `honey-d164`. La base real y el primer administrador están creados; 40 verificaciones HTTP con PostgreSQL y Auth reales completadas. Vercel Production y Development tienen `VITE_DATA_MODE=api`; sin esa variable se mantiene demo por defecto. Consultar [BACKEND.md](./BACKEND.md) para configuración y evidencias. El modo API no habilita pagos ni usa el simulador. Tarifa inicial: $3.000; sin comunas configuradas el checkout permanece bloqueado, fuera del sprint actual de endpoints.

## Carritos abandonados y Marketing

En modo API, `/carrito` y `/checkout` permiten guardar voluntariamente una selección con correo y permisos separados para recuperación y promociones. El admin dispone de `/staff/admin/marketing` para consultar carritos, gestionar bajas y exportar listas de recuperación, catálogo y recompra. Abandono: una hora; recuperación: 30 días. No se envían correos todavía. Documentación y comprobaciones en [MARKETING.md](./MARKETING.md).

## Mercado Pago preparado

La primera iteración de la etapa 12 deja preparado Checkout Pro, webhook firmado, registro idempotente y panel de pago. Sigue desactivado: las credenciales, variables, base de datos y pruebas con el proveedor se abordarán en la segunda iteración. No se realizaron cobros. Ver [MERCADOPAGO.md](./MERCADOPAGO.md).

## Validación de operación preparada

`npm.cmd run check:operation` reúne las 92 pruebas de módulos, estructura, compilaciones API/demo y ocho recorridos de navegador. Genera `.preview-browser/operation-report.json` con resultados locales y producción pendiente. También están disponibles `npm.cmd run test:operation` y `npm.cmd run check:build-modes` por separado. Ver [OPERACION_INICIAL.md](./OPERACION_INICIAL.md) para las evidencias y la secuencia de puesta en marcha de la segunda iteración.
