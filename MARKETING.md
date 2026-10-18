# Carritos abandonados y audiencias

Implementado el 17 de octubre de 2026 como ampliación del alcance inicial. Usa la API de Vercel y Supabase del proyecto existente. No se contrató un proveedor de mailing ni se envían correos.

## Captura y recuperación

El carrito sigue funcionando sin correo y se conserva en localStorage. Para persistir una selección en Supabase, el visitante envía el formulario «Guardar para después» de `/carrito` o `/checkout`. Escribir un correo en checkout por sí solo no crea un contacto.

El formulario ofrece dos permisos separados, desmarcados inicialmente:

- «Quiero guardar este carrito y recibir un recordatorio para retomarlo»: necesario para guardar la selección con correo.
- «También quiero recibir catálogos, novedades y promociones de Casa Miel (opcional)»: permite incluir el contacto en campañas generales y recompra.

La versión `cart-recovery-v1` identifica esos textos y finalidades. El servidor guarda fechas, origen y eventos de consentimiento. El correo se considera proporcionado por el visitante; no se ha implementado verificación de dirección ni doble opt-in. La futura plataforma debe definir ese proceso antes de activar envíos.

Se guardan productos, formatos y cantidades; el servidor resuelve precios y subtotal. No se copian direcciones, teléfonos ni datos de pago al carrito guardado. El navegador conserva únicamente el identificador y la capacidad privada, además de su selección local; no guarda el correo en esta referencia.

Los cambios posteriores se sincronizan con debounce y solicitudes serializadas. Un carrito vacío deja de ser candidato a recuperación. Si falla la sincronización, la compra y la copia local siguen disponibles.

Los enlaces usan fragmentos (`/carrito#recuperar=…`), no parámetros de consulta. La recuperación requiere una acción explícita, consulta precios vigentes y combina la selección con el carrito actual usando la mayor cantidad por producto/formato, sin duplicarla al repetir el enlace. Si un producto deja de existir, el carrito lo identifica como no disponible.

## Estados

| Estado | Criterio |
| --- | --- |
| Activo | Selección con productos y actividad durante la última hora. |
| Abandonado | Una hora sin cambios, sin pedido asociado, sin baja y con enlace vigente. Se calcula al consultar; no requiere Cron. |
| Pedido creado | Checkout completado y pedido vinculado, aunque el pago siga pendiente. Ya no entra a recuperación. |
| Compra pagada | El pedido relacionado registra un pago aprobado. |
| Vaciado | El visitante retiró todos los productos. |
| Vencido | Han pasado 30 días desde su captura. El enlace de recuperación deja de funcionar. |
| Baja registrada | El correo fue excluido de comunicaciones; la baja afecta a todos sus carritos y campañas. |

La baja sigue disponible aunque el enlace de recuperación haya vencido o el carrito tenga pedido. Capturar otro carrito con el mismo correo no reactiva una baja. El vencimiento del enlace no elimina automáticamente contactos ni eventos; esa política de conservación debe completarse al integrar las campañas.

Crear el pedido con una referencia de carrito usa `honey_new_order_with_cart`: creación idempotente y vinculación ocurren en la misma transacción. Un carrito vinculado no puede crear otro pedido ni recuperarse como una nueva selección. Los errores de negocio usan `P4090`, separado de errores de serialización de PostgreSQL.

## Administración y exportaciones

Acceso exclusivo de admin: [Marketing](https://honey-d164.vercel.app/staff/admin/marketing), también desde el panel. Delivery no puede consultar ni exportar contactos.

- Carritos: filtros por estado, búsqueda, productos, subtotal, fechas y enlaces privados.
- Contactos: preferencias, bajas, compras pagadas y total comprado. Los pedidos `isTest` se excluyen de las métricas de recompra.
- Baja administrativa con confirmación, conservando un evento de la decisión.
- CSV de recuperación: solo carritos abandonados elegibles, un registro por correo, con enlace privado y baja.
- CSV de catálogo/promociones: solo contactos con permiso específico y sin baja.
- CSV de recompra: además requiere al menos una compra pagada no ficticia.

La lista se pagina de 50 en 50. Cada exportación vuelve a consultar su segmento en el servidor, sin depender de datos de pantalla que podrían estar desactualizados. Exporta el segmento completo hasta 5.000 registros y rechaza un conjunto mayor, en lugar de truncarlo silenciosamente. Los valores CSV se citan y neutralizan prefijos de fórmulas de hojas de cálculo. Los archivos contienen datos personales y enlaces privados: su uso corresponde a la gestión interna autorizada.

## Base y API

Migraciones: `20261018001856_abandoned_carts.sql` y `20261018003119_saved_cart_conflicts.sql`. Agregan contactos, carritos y eventos de consentimiento; vistas con `security_invoker`, RLS y permisos exclusivos de `service_role`. Las funciones administrativas vuelven a validar la sesión. No se agregan dependencias ni variables de entorno; `ORDER_ACCESS_SECRET` debe permanecer estable para conservar los enlaces.

| Ruta de API (`/api?route=…`) | Método | Acceso |
| --- | --- | --- |
| `carts/capture` | POST | Referencia privada, correo y permisos explícitos. |
| `carts/touch` | POST | Referencia privada; no modifica permisos ni identidad. |
| `carts/recover` | POST | Referencia privada y enlace vigente. Devuelve selección, sin correo. |
| `carts/unsubscribe` | POST | Referencia privada; no requiere sesión staff. |
| `marketing/list` | GET | Admin. `kind`, `segment`, `query`, `offset`. |
| `marketing/export` | GET | Admin. `segment=recovery/campaigns/repeat`. |
| `marketing/unsubscribe` | POST | Admin. `contactId`. |

Las escrituras conservan validación de origen y límites de solicitudes. El backend solo guarda hashes de capacidades. Los enlaces generados para admin se derivan por HMAC; no es necesario almacenar el token original en texto plano.

## Comprobaciones

`npm.cmd run test:marketing`: ocho pruebas de validación, permisos, precios, CSV, contrato HTTP y recuperación idempotente. La suite completa suma 100 pruebas.

`npm.cmd run check:operation`: estructura, ambos modos de compilación, las 100 pruebas y los ocho recorridos de navegador existentes. Al terminar, restaura `dist` con la configuración activa, para que las pruebas demo no dejen una vista previa local en modo demo.

`npm.cmd run check:marketing-connected`: 29 comprobaciones HTTP con PostgreSQL y Auth reales. Requiere `.env` y `.vercel/admin-credentials.local.json`. Incluye deduplicación de contactos, abandono, permisos, precios, recuperación con la capacidad generada para admin, expiración, baja persistente y checkout idempotente. Retira únicamente los contactos técnicos creados por la ejecución; el pedido técnico queda cancelado y archivado. Usa una comuna técnica solo en el proceso de prueba, sin cambiar la cobertura de producción.

`npm.cmd run check:marketing-browser`: navegador conectado a Supabase real, captura voluntaria, cambios de cantidad, panel admin, exportación descargada, recuperación, baja pública y revisión móvil. Retira su contacto técnico. Capturas e informes sin contraseñas en `.preview-browser/marketing-*` y `.preview-browser/cart-recovery-mobile.png`.

El advisor de seguridad no identifica problemas nuevos en tablas o vistas. Conserva los avisos informativos de [RLS sin políticas públicas](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy), coherentes con esta arquitectura, y el aviso existente de [protección de contraseñas filtradas desactivada en Auth](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).

Pendiente de una siguiente integración: elegir plataforma y dominio remitente, verificación de correos, plantillas, calendario de campañas, entrega real, registro de envíos y sincronización de bajas del proveedor. Antes de cada envío real se deben volver a consultar consentimiento, baja y estado de pedido; un CSV exportado representa el estado de su fecha de descarga.
