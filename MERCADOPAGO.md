# Mercado Pago — preparación de la etapa 12

Primera iteración terminada en código. La integración permanece desactivada: no se cargaron credenciales, no se configuraron variables de entorno, no se enviaron solicitudes a la API de Mercado Pago y no se realizaron cobros. La base de datos y su validación continúan pendientes de la etapa 11.

## Flujo preparado

1. El comprador crea un pedido con productos, precios y despacho calculados por el servidor.
2. Desde su referencia privada puede solicitar el inicio de Checkout Pro. La API reserva una preparación por pedido en PostgreSQL y crea una preferencia con los importes guardados. El cliente no define importes, moneda, URLs ni cuenta receptora.
3. La preferencia usa su UUID de intento como `external_reference`. Los tres regresos apuntan a la confirmación privada de la compra. El navegador solo acepta enlaces HTTPS de los hosts de Checkout de Mercado Pago Chile y del entorno seleccionado.
4. Al regresar, se consulta el pago registrado en el servidor. Los parámetros `status`, `collection_status` o `payment_id` de la URL nunca aprueban una venta. Se consulta periódicamente hasta dos minutos mientras el pago no sea terminal; después queda disponible la consulta manual.
5. El webhook verifica la firma, consulta el recurso en Mercado Pago y comprueba identificador, referencia, monto completo en CLP, receptor, entorno y fechas. Solo entonces registra el resultado.

Implementación en `server/mercadopago/`, rutas en `server/application.mjs`, adaptador HTTP y panel de pago en `src/modules/payments/`. No se agregó un SDK ni dependencias de plataforma.

Referencias oficiales: [crear preferencia de Checkout Pro](https://www.mercadopago.cl/developers/es/reference/online-payments/checkout-pro-preferences/create-preference/post), [URLs de regreso](https://www.mercadopago.com.uy/developers/en/docs/checkout-pro-preferences/configure-back-urls) y [esquema de webhooks de Mercado Pago](https://github.com/mercadopago/openapi/blob/main/schemas/webhooks.yaml). Las consultas se dirigen al host fijo `api.mercadopago.com`, sin usar una URL recibida en la notificación.

## Endpoints

| Operación | Acceso |
| --- | --- |
| `GET /api?route=payments%2Fcapabilities` | Devuelve únicamente si el pago está habilitado. Sin claves ni detalles de configuración. |
| `POST /api?route=payments%2Fstart` | JSON `{ "orderId": "…" }` y cabecera privada `X-Order-Token`. Valida origen; devuelve URL y entorno del checkout. Delivery no gestiona pagos. |
| `POST /api?route=payments%2Fwebhook` | Notificación servidor a servidor, sin cookie ni Origin obligatorio. Requiere firma válida y JSON acotado. |
| `GET /api?route=payment&id=…` | Consulta del estado registrado con la referencia privada o sesión admin. No acepta un estado enviado por el comprador. |

La firma utiliza el manifiesto documentado con `data.id`, `x-request-id` y `ts`, HMAC-SHA256 y comparación constante. Como política local, se exigen los tres valores, un único `data.id` y una ventana de cinco minutos; `ts` admite segundos o milisegundos. En la segunda iteración debe verificarse esta política con notificaciones y reintentos reales del proveedor. Solo se procesa el tema `payment`.

## Persistencia y casos especiales

La migración `supabase/migrations/202610170002_mercadopago.sql` agrega reservas de checkout y eventos de pago, protegidos con RLS y permisos exclusivos del servidor. Debe ejecutarse después de la migración inicial cuando se levante la base de pruebas.

- La reserva impide inicios paralelos y reutiliza la preferencia guardada. Se envía una clave de idempotencia al proveedor, pero la protección local no depende de que el endpoint de preferencias la admita.
- Si una llamada queda incierta o el enlace vence a las 24 horas, no se genera otra preferencia automáticamente. Debe reconciliarse el estado con el proveedor antes de liberar o completar la reserva. Si el proceso se interrumpe durante `creating`, también requiere revisión.
- El evento se identifica a partir del estado consultado al proveedor. La transacción deduplica el evento y actualiza el pedido y sus proyecciones juntos. Las revisiones concurrentes se vuelven a consultar antes de reintentar; no se sobrescriben comentarios o cambios simultáneos.
- Pendiente, en proceso y autorizado permanecen pendientes. Rechazado/cancelado se registran como rechazados. La aprobación conserva la fecha informada por el proveedor. Cada transacción queda identificada en un intento separado del mismo pedido.
- Un reembolso completo conserva la venta histórica y su aprobación, incluso si su notificación llega antes que la de aprobación. Los estados antiguos no hacen retroceder un pago.
- Reembolsos parciales, contracargos, transiciones inesperadas, pagos de pedidos cerrados o más de un cobro aprobado dejan el pedido en revisión. Se conservan los identificadores y movimientos para reconciliar; no se emite automáticamente otro cobro, venta ni reembolso. El pedido queda fuera del despacho. Estos bloqueos no se levantan automáticamente y su resolución administrativa debe validarse en la segunda iteración.

El backend no puede impedir que un comprador reutilice por fuera de la aplicación un enlace que el proveedor todavía acepte. Si se recibe un cobro adicional, queda identificado para revisión sin duplicar la venta del pedido. La política de cierre de preferencias y resolución de cobros adicionales se comprobará con la cuenta de prueba antes de producción.

## Segunda iteración — pendiente, sin configurar ahora

Se preparó la lectura futura de estas variables privadas; `.env` y `.env.example` no se modificaron para activarlas:

| Variable prevista | Uso posterior |
| --- | --- |
| `MP_ENABLED` | Debe ser exactamente `true` para habilitar. Ausente permanece desactivado. |
| `MP_ENVIRONMENT` | `sandbox` o `production`, sin mezclar sus pagos. |
| `MP_ACCESS_TOKEN` | Credencial privada de la cuenta receptora, solo servidor. |
| `MP_WEBHOOK_SECRET` | Secreto de firma de la aplicación. |
| `MP_COLLECTOR_ID` | Identificador verificado de la cuenta que recibe los pagos. |

También se requerirán el backend de la etapa 11, dominio HTTPS en `APP_ORIGIN` y cobertura/tarifa comerciales. Esta implementación redirige a Checkout Pro y no necesita una clave pública en el frontend.

En esa iteración falta aplicar y probar SQL contra PostgreSQL; configurar credenciales y notificaciones en Mercado Pago; comprobar los hosts de checkout devueltos para Chile y la conservación del fragmento privado en las URLs de regreso; validar firmas, tiempos, estados y reintentos con cuentas de prueba; probar persistencia entre procesos, deduplicación y carreras reales; y definir el procedimiento de reconciliación de reservas inciertas, vencidas y pagos en revisión. No habilitar producción hasta completar esas comprobaciones y la etapa 13.

## Pruebas locales

`npm.cmd run test:mercadopago` ejecuta 14 casos sin red externa: desactivación, preferencias, acceso privado, concurrencia, reserva incierta, URLs permitidas, HMAC, estados falsos, monto/moneda/receptor/entorno, aprobación, reintento, reembolso, revisión y eventos antiguos/concurrentes.

`npm.cmd run check:mercadopago-browser` comprueba el panel con respuestas locales: los parámetros de regreso no aprueban pagos, botón ocupado, referencia privada, errores recuperables y enlace inseguro bloqueado. La aprobación visual se prueba con una respuesta de consulta ficticia; la verificación de firma y del proveedor se cubre aparte en las pruebas de servidor. No abre Checkout Pro real. La suite completa reúne 92 pruebas de módulos.
