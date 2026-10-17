# Casa Miel — React + Vite

Plataforma comercial construida con React y Vite. Estructura, modelo, carrito, compra simulada, acceso staff y gestión de pedidos del admin implementados (etapas 1–6, con cobertura/tarifa comercial aún pendiente en la etapa 4). El próximo desarrollo es Ventas / Facturación como registro interno (etapa 7). Todavía no hay backend, autenticación real, cobros reales ni emisión tributaria.

## Ejecutar

```powershell
npm.cmd install
npm.cmd run dev
```

## Compilar

```powershell
npm.cmd run build
```

Las dependencias nativas de Rolldown y Lightning CSS son opcionales y se seleccionan según el sistema operativo. No se deben añadir sus paquetes `win32` como dependencias obligatorias: el despliegue de Vercel usa Linux. El lockfile incluye las variantes de plataforma y permite instalar con `npm ci`; en Vercel, la compilación es `npm run build` y el directorio de salida es `dist`.

## Estructura

En PowerShell se usa `npm.cmd` para evitar el bloqueo de `npm.ps1` sin cambiar la política de ejecución del sistema. Vite excluye del seguimiento el perfil `.preview-browser` y las cachés locales para evitar errores `EBUSY` por archivos bloqueados.

- `src/data/products.js`: catálogo y precios simulados.
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
- `/staff/admin/despachos`
- `/staff/admin/equipo`
- `/staff/delivery`

El pie de página incluye “Acceso equipo”. En `/staff` puedes iniciar sesión con `admin@casamiel.demo` o `delivery@casamiel.demo`, contraseña pública ficticia `demo1234`. Cada cuenta abre su panel y las rutas ajenas muestran acceso denegado. La sesión dura 30 minutos y se mantiene en memoria al navegar, incluso al salir y volver a staff; recargar reinicia la demostración. El botón Cerrar sesión limpia la sesión y sus filtros. Estas restricciones son de interfaz; la autorización real se implementará en el backend.

## Servicios y comprobación de estructura

Las pantallas consumen los contextos de sus módulos. Solo los contextos consultan `useServices()`; los componentes de presentación no importan los adaptadores. El contrato expone `catalog.list`, `auth.getSession/login/logout`, `orders.list/getById/create/update`, `payments.getForOrder` y `staff.list`; el adaptador demo añade `payments.simulate` y cuentas de prueba. `createServices(adapter)` valida la implementación, y `<AppProviders adapter={adapter}>` permite sustituirla para toda la aplicación sin reescribir pantallas.

Los hooks disponibles son `useCatalog`, `useCart`, `usePurchase`, `usePayment`, `useSession`, `useOrders` y `useTeam`. Ventas y despachos se construirán sobre la fuente compartida de pedidos, sin listas de negocio duplicadas. La API base y las operaciones pendientes de cada contexto están detalladas en el plan.

Los contextos de tienda se mantienen al pasar de productos a carrito y checkout; pagos se monta solo en checkout y resultado. Staff usa sesión y pedidos, con equipo en el panel admin y su sección. Los pedidos se cargan tras autenticar; equipo se consulta solo con rol admin. El delivery recibe en su contexto únicamente pedidos asignados. El carrito guarda la selección en localStorage y resuelve precios desde el catálogo actual. El checkout crea pedidos simulados y permite reintentar el pago; el admin gestiona esos pedidos con historial. Borrador y pedidos siguen en memoria. Autenticación y cobros reales siguen pendientes.

```powershell
npm.cmd run check:structure
npm.cmd run test:domain
npm.cmd run test:cart
npm.cmd run test:checkout
npm.cmd run test:staff
npm.cmd run test:orders
npm.cmd run check:staff-browser
npm.cmd run check:orders-browser
```

Esta comprobación valida los servicios, la inyección de adaptadores, los ámbitos de los contextos, la fuente compartida de pedidos, los precios acordados y el renderizado inicial de las rutas. No sustituye una revisión visual en el navegador ni las futuras pruebas de compra, autenticación y permisos reales.

`check:staff-browser` abre Edge en modo headless con un perfil de prueba en `.preview-browser/staff-check`, sirve la app localmente en el puerto 5179 y usa el puerto 9231 para comprobar login, logout, rutas por rol, contadores, navegación, búsquedas y vencimiento. Requiere Edge instalado en Windows; puedes indicar otra ruta con `EDGE_PATH`.

`check:orders-browser` usa el mismo entorno para recorrer la gestión completa de un pedido, verificar importes e historial y capturar la vista móvil en `.preview-browser/orders-mobile.png`. Ejecuta ambas pruebas de navegador de forma secuencial porque comparten puertos y perfil.

El avance y los siguientes pasos se registran en [PLAN_IMPLEMENTACION_COMERCIAL.md](./PLAN_IMPLEMENTACION_COMERCIAL.md).

El [Modelo comercial compartido](./src/modules/MODELO_COMERCIAL.md) documenta comprador y destinatario, productos e importes congelados, pagos, entregas, comentarios, historial y calendario chileno. Los formularios de compra y gestión de pedidos ya consumen estas reglas; consultas de ventas, asignación de despachos y gestión del equipo siguen en sus etapas posteriores.

Para publicar una SPA, el hosting debe redirigir las rutas desconocidas a `index.html`.

## Probar una compra simulada

Agrega una miel desde su ficha, abre el carrito y continúa al checkout. Completa los datos de comprador y entrega; puedes indicar otro destinatario. El resumen incluye un despacho ficticio de $3.000 CLP para cualquier comuna de prueba, sin representar cobertura real. Al continuar se crea un pedido pendiente y se abre el simulador que representa el paso a Mercado Pago; permite aprobar, dejar pendiente, rechazar o simular error de conexión.

El resultado muestra el número, productos, importes y datos de entrega. Reintentar conserva el pedido y registra otro intento si el anterior fue rechazado. No se envían datos a Mercado Pago ni se cobran fondos. Pedidos y borrador se mantienen en memoria y se reinician al recargar; únicamente el carrito persiste en localStorage. Los estados de pago se consultan al servicio, nunca se aprueban por parámetros de URL.

## Gestionar pedidos de demostración

Después de crear una compra, navega a `/staff` sin recargar, inicia sesión como admin y abre Pedidos. Puedes filtrar pendientes, entregados o todos, buscar por número/comprador y consultar archivados. El detalle permite corregir destinatario, dirección e indicaciones, agregar comentarios, confirmar estados de entrega, cancelar o archivar. Las correcciones y acciones importantes se confirman y guardan autor, fecha, motivo y datos anteriores en el historial. Los productos, comprador y montos cobrados se conservan.

Cancelar no efectúa un reembolso. Solo los registros con marca explícita de prueba pueden eliminarse. Las acciones del adaptador demo requieren su sesión admin; esto no sustituye la autorización del futuro backend. No hay pedidos precargados: se crean desde el checkout de prueba.
