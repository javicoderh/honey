# Backend — etapa 11

Estado: código y migraciones preparados; **falta provisionar y validar una base de datos real**. La aplicación sigue en modo demo por defecto. No se ha desplegado este avance ni ejecutado SQL sobre una cuenta externa.

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

La suite completa reúne 92 pruebas. Las pruebas de API usan un doble de base de datos; **no ejecutan ni validan las funciones SQL contra PostgreSQL**. No había proyecto Supabase configurado ni motor PostgreSQL local disponible durante esta implementación. Antes de cerrar la etapa 11 falta aplicar y probar las migraciones, Auth real, las políticas con claves públicas, la persistencia entre procesos y carreras de escrituras (incluido el último admin) contra una base de pruebas. Además falta definir cobertura/tarifa comercial antes de aceptar pedidos reales.

La preparación de Mercado Pago está documentada en [MERCADOPAGO.md](./MERCADOPAGO.md). Su segunda migración depende de levantar y validar esta base. La activación y las credenciales quedan para la segunda iteración; el pago sigue deshabilitado por defecto.
