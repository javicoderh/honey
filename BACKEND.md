# Backend — etapa 11

Estado: base real provisionada el 17 de octubre de 2026; ambas migraciones y catálogo aplicados. **API HTTP y Supabase Auth validados contra servicios reales**. `VITE_DATA_MODE=api` configurado en Vercel Production y Development para el sprint de endpoints.

## Conexión preparada — 17 de octubre de 2026

- Supabase: proyecto `honey`, referencia `fkravaedfqbvkyrwfwkj`, organización `My Team` (`vercel_icfg_dx2aZzWHJRZhnpEhQufqfb22`), región São Paulo (`sa-east-1`). [Panel del proyecto](https://supabase.com/dashboard/project/fkravaedfqbvkyrwfwkj).
- Vercel: proyecto `honey` (`prj_mz7afFhjsuySBXjEmWt0VjKg5CQx`), equipo `my-team-d5e0a31d`. Origen de producción consultado: `https://honey-theta-five.vercel.app`.
- Aplicadas las migraciones `honey` y `mercadopago` mediante el complemento. Catálogo cargado con los seis productos del seed, pendiente de validación comercial.
- Verificado: 12 tablas con RLS, sin permisos SELECT para `anon` ni `authenticated`; sesión inexistente rechazada. Prueba transaccional real de creación idempotente de pedido, proyecciones y rate limit completada con rollback. No quedaron pedidos, staff ni límites de prueba. Las secuencias pueden avanzar aunque se revierta la transacción.
- `.env` local creado y excluido de Git, con URL y secreto aleatorio estable de pedidos. `SUPABASE_SECRET_KEY` completada por el usuario y guardada en Vercel. Configurados `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `ORDER_ACCESS_SECRET` y `APP_ORIGIN` para Production y Development. En Production la clave queda como Secret; Development usa Config según el comportamiento de Vercel. Preview permanece pendiente de una URL estable para validar el origen.
- La vinculación automática de Marketplace no se completó: Vercel devolvió `No resource honey found`. El complemento permite administrar la base, pero no ofrece una herramienta para obtener la clave privada. La clave se incorporó desde el panel del proyecto en `.env` y Vercel, sin publicarla ni usar prefijo `VITE_`.
- `db:check` completado contra Supabase real (6 productos activos y sesión inexistente rechazada). Primer administrador creado en Auth y staff; credenciales iniciales en `.vercel/admin-credentials.local.json`, excluido de Git. No se enviaron correos ni se habilitó Mercado Pago.
- Advisor de seguridad: solo avisos informativos [RLS sin políticas](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy), coherentes con el acceso exclusivo del servidor. Advisor de rendimiento: cinco [claves foráneas sin índice](https://supabase.com/docs/guides/database/database-linter?lint=0001_unindexed_foreign_keys) y dos índices todavía sin uso; revisión pendiente antes de aumentar carga.

Tarifa inicial confirmada por el usuario: $3.000 CLP, configurada localmente y en Vercel Production/Development. Cobertura pendiente de las comunas que indique el usuario. `check:operation` completado: 92 pruebas, estructura, compilaciones API/demo y ocho recorridos de navegador. Cambios preparados en `.vercel/github-publish`, una copia de `javicoderh/honey` que conserva el historial remoto; la carpeta principal tiene un repositorio Git local sin commits ni remoto.

### Sprint de endpoints conectados

Se completaron 40 verificaciones mediante HTTP y `api/index.js`, con PostgreSQL y Auth reales: catálogo, login/logout, cookies, sesiones entre solicitudes, consultas de admin, protección del último admin, rechazo de origen ajeno, referencias privadas, idempotencia, cálculo de precios, comentarios, historial, alta y desactivación de staff, revocación de sesiones y restricciones de delivery.

La cobertura `Prueba técnica` se habilitó únicamente dentro del proceso de prueba para comprobar creación y cotización a $3.000; no se guardó como cobertura comercial en `.env` ni Vercel. El pedido técnico quedó cancelado y archivado, sin cobros. El delivery técnico quedó desactivado. Informe local sin secretos: `.preview-browser/connected-api-report.json`. La comprobación remota del despliegue registra sus resultados en `.preview-browser/deployed-api-report.json`.

Por indicación del usuario, cobertura comercial y pagos quedan fuera de este sprint. Sin comunas configuradas, `quote` y `orders/create` responden 503; pagos informa `enabled: false`. El administrador puede iniciar sesión y consultar los registros persistidos. Acceso: `/staff` en `https://honey-theta-five.vercel.app`.

Antes de habilitar operación comercial siguen pendientes: desactivar altas públicas en Auth, definir cobertura, probar concurrencia entre procesos y validar el proveedor de pagos. Estas comprobaciones no cierran toda la etapa 11 ni habilitan cobros.

## Arquitectura

La API Node en `api/index.js` se ejecuta en Vercel o mediante `server/dev.mjs`. Usa PostgreSQL y Supabase Auth a través de REST, sin incorporar dependencias nuevas. El navegador consume únicamente esta API del mismo origen mediante `src/services/http.js`.

Las credenciales administrativas permanecen en el servidor, según la documentación de [creación administrativa de usuarios de Supabase](https://supabase.com/docs/reference/javascript/auth-admin-createuser). Las tablas tienen RLS habilitado, sin acceso directo de `anon` ni `authenticated`; solo la API privada accede con `service_role`. Las funciones SQL tienen los mismos permisos restringidos. Véase [RLS en Supabase](https://supabase.com/docs/guides/database/postgres/row-level-security).

Supabase valida correo/contraseña al ingresar. La aplicación entrega una sesión propia de 30 minutos mediante cookie HttpOnly/SameSite=Strict, con Secure en HTTPS; PostgreSQL guarda solo el hash del token. Cada petición valida cuenta activa y versión de acceso. Cambiar rol o estado revoca las sesiones anteriores. La contraseña de cuentas nuevas requiere 12–128 caracteres, no se devuelve ni se incluye en historial. No se envían invitaciones automáticas.

La API valida origen en escrituras, acepta JSON de hasta 32 KiB y usa límites persistidos de intentos de login, compra y alta de staff. El límite por IP presupone Vercel como proxy de confianza, donde [Vercel sobrescribe X-Forwarded-For](https://vercel.com/docs/headers/request-headers); adaptar esa frontera antes de alojar detrás de otro proxy.

## Preparación de Supabase

1. Crear un proyecto Supabase para pruebas. Desactivar el alta pública de usuarios; las cuentas de staff se crean desde administración. Configurar las políticas de contraseña de Auth y mantener desactivados proveedores que no se utilicen.
2. Ejecutar `supabase/migrations/202610170001_honey.sql` en ese proyecto. Crea staff, sesiones, catálogo, pedidos, productos congelados, pagos, asignaciones, comentarios, historial y límites de solicitudes. Las proyecciones del pedido se actualizan dentro de la misma transacción. El historial de asignaciones se conserva en los eventos del pedido.
3. Revisar `supabase/seed.sql` y ejecutarlo para cargar el catálogo. Se regenera con `npm.cmd run db:prepare`; ese comando solo escribe SQL local.
4. Crear el primer usuario en Supabase Auth con contraseña segura. Completar y ejecutar `supabase/bootstrap-admin.example.sql` con su correo. El bootstrap solo inserta cuando todavía no hay staff. Las cuentas siguientes se crean desde Equipo.
5. Copiar `.env.example` a `.env` y completar las variables de forma privada. No compartir claves en el chat ni versionar `.env`.

| Variable | Uso |
| --- | --- |
| `VITE_DATA_MODE` | `demo` por defecto; `api` para conectar con servidor. Requiere reconstruir el frontend al cambiarla. |
| `APP_ORIGIN` | Origen exacto, sin barra final; local: `http://localhost:5173`. Producción: dominio HTTPS real. |
| `SUPABASE_URL` | URL HTTPS del proyecto. |
| `SUPABASE_SECRET_KEY` | Clave privada de servidor de Supabase; también se admite la clave heredada `service_role`. Nunca llevar prefijo `VITE_`. |
| `ORDER_ACCESS_SECRET` | Secreto aleatorio estable de al menos 32 caracteres para referencias privadas. Conservarlo entre despliegues. |
| `SHIPPING_FEE_CLP` | Tarifa entera no negativa, definida comercialmente. Vacía bloquea compras. |
| `SHIPPING_COMMUNES` | Comunas cubiertas separadas por coma. Vacía bloquea compras. |

Las variables privadas deben configurarse en Vercel como variables de servidor. Solo `VITE_DATA_MODE` llega al bundle. No se reemplazan errores del servicio por datos demo.

## Desarrollo y despliegue

Usar Node 24. En dos terminales, ejecutar `npm.cmd run dev:api` y `npm.cmd run dev`. Vite deriva `/api` al puerto local 3001. El origen configurado debe coincidir con el que se abre en el navegador.

`npm.cmd run db:check` comprueba conexión, catálogo y función de sesión sin modificar datos. Requiere `.env` configurado y SQL aplicado; no muestra valores privados. No sustituye las pruebas de permisos ni concurrencia sobre PostgreSQL.

En Vercel, `api/index.js` usa el [runtime Node](https://vercel.com/docs/functions/runtimes/node-js). `vercel.json` mantiene las rutas profundas del frontend y `/api` sirve la API. Compilar con `npm run build`, salida `dist`.

## Pedidos y pagos

El servidor resuelve catálogo, precios, cantidades, comuna y tarifa; ignora importes enviados por el cliente. Los pedidos públicos usan UUID de solicitud y una referencia privada derivada en servidor. La base impide duplicar una solicitud; el número comercial no da acceso a los datos. La confirmación usa un fragmento privado de URL y una cabecera para consultar el pedido, sin guardar ese token en localStorage. Una recarga restaura el pedido sin retirar productos nuevos del carrito. El comprador no recibe comentarios internos, historial ni identidad del delivery.

El admin consulta y modifica registros con autor y fecha del servidor. Delivery solo consulta sus asignaciones activas, sin comprador ni importes, y solo registra estados de entrega/comentarios propios. Las mutaciones usan revisión optimista; los cambios concurrentes se rechazan para que el usuario actualice. Los cambios de equipo y confirmaciones de pedidos comparten bloqueo transaccional para volver a validar acceso. El último admin activo está protegido también en SQL.

El backend no expone un simulador ni permite aprobar pagos desde el navegador. Los pedidos quedan pendientes; la interfaz informa que el pago en línea aún no está habilitado. La integración verificada con Mercado Pago corresponde a la etapa 12. Los registros reales no se eliminan desde la API.

## Pruebas y cierre pendiente

`npm.cmd run test:api` cubre la API y el adaptador HTTP: origen, tamaño, cookies, revocación, permisos, precios, cobertura, referencias privadas, duplicados, proyecciones y errores del proveedor. `npm.cmd run check:api-browser` recorre login, alta, compra, cobertura, recarga del enlace privado y rechazo de una referencia alterada, con HTTP y la aplicación de servidor reales y un repositorio temporal de prueba.

La suite completa reúne 92 pruebas con dobles de base de datos/proveedor. Se complementa con las 40 verificaciones de conexión real documentadas arriba y las pruebas transaccionales SQL. Siguen pendientes carreras de escrituras (incluido el último admin), persistencia entre procesos independientes y pruebas con claves públicas a través de la Data API. La tarifa está definida en $3.000; la cobertura comercial permanece pendiente.

La preparación de Mercado Pago está documentada en [MERCADOPAGO.md](./MERCADOPAGO.md). Su segunda migración ya está aplicada; activación, credenciales y comprobación con el proveedor quedan pendientes. El pago sigue deshabilitado.
