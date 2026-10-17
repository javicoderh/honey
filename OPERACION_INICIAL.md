# Preparación de la operación inicial

La primera iteración de la etapa 13 prepara la validación local y el procedimiento de puesta en marcha. La habilitación comercial continúa pendiente. No se configuraron credenciales, variables ni servicios externos y no se realizaron cobros.

## Validación reproducible

Desde la raíz del proyecto, con las dependencias instaladas y Edge disponible en Windows:

```powershell
npm.cmd run check:operation
```

El comando ejecuta secuencialmente las pruebas de módulos, la revisión de estructura, las compilaciones API/demo y ocho recorridos de navegador: staff, pedidos, ventas, despachos, equipo, revisión integral, API y Mercado Pago local. Se detiene ante el primer fallo. Los puertos de los recorridos deben estar libres; no ejecutar otras comprobaciones de navegador en paralelo.

El informe se escribe en `.preview-browser/operation-report.json`, excluido de Git. Registra resultados, duración y comprobaciones omitidas, sin incorporar datos de compradores, credenciales ni contenido de respuestas. `passed` describe únicamente la ejecución local; `productionReady` permanece en `false` y `externalValidation` en `pending`.

Para comprobar solamente los escenarios nuevos:

```powershell
npm.cmd run test:operation
```

## Evidencia y límites

La suite reúne 92 pruebas de módulos. Los cuatro escenarios de `scripts/operation.test.mjs` recorren la API real con un doble de base de datos y respuestas locales del proveedor:

| Escenario | Comprobación |
| --- | --- |
| Compra aprobada hasta entrega | Pago verificado, preparación, asignación, comentario y entrega; venta y pedido comparten fecha y comentarios; comprador recibe una proyección limitada. |
| Pendiente, rechazo y reintento | No permiten preparar ni generan venta antes de aprobar; el reintento conserva un pedido y una venta. |
| Interrupción y regreso tardío | Reintentar la notificación recupera el pago; repetirla no duplica eventos ni revisiones; el comprador consulta después. |
| Permisos y reembolso | Delivery no accede a datos generales ni modifica pedidos ajenos; un reembolso bloquea la entrega asignada y conserva el historial financiero. |

Las pruebas existentes cubren filtros por fecha, formularios, sesiones y otras reglas de dominio. Los recorridos de navegador comprueban la interfaz. Las compilaciones revisan ambos modos y la ausencia de referencias a las variables privadas del servidor en los archivos JavaScript generados; esto no sustituye una auditoría de secretos.

Estas comprobaciones no ejecutan PostgreSQL, Supabase Auth ni Checkout Pro reales. No prueban políticas SQL, persistencia entre procesos, carreras reales ni recepción pública de notificaciones.

## Segunda iteración: orden de puesta en marcha

1. Crear una base de pruebas y seguir [BACKEND.md](./BACKEND.md): aplicar ambas migraciones, comprobar Auth, permisos con claves públicas, persistencia, concurrencia y protección del último administrador.
2. Definir precios, comunas cubiertas y tarifa de despacho. Verificar que catálogo y cálculo del servidor coincidan con las condiciones comerciales aprobadas.
3. Seguir [MERCADOPAGO.md](./MERCADOPAGO.md): obtener las credenciales correspondientes, configurar el entorno de pruebas y las notificaciones. Comprobar cuenta receptora, moneda, firmas, tiempos, estados, reintentos y URLs privadas de regreso con el proveedor real.
4. Repetir los cuatro escenarios anteriores contra esa integración. Registrar evidencias sin secretos y verificar que una interrupción o notificación duplicada no genere pedidos, cobros registrados ni ventas duplicadas.
5. Definir el mecanismo de emisión tributaria aplicable como alcance separado. El registro interno de ventas no emite documentos tributarios.
6. Verificar un respaldo y una restauración en un entorno aislado, además del acceso y recuperación del administrador. Definir responsables para pagos en revisión y preferencias inciertas o vencidas; no recrearlas a ciegas.
7. Preparar producción con cuentas reales y permisos mínimos. Retirar accesos y registros de demostración; repetir comprobaciones de autorización y confirmar que el entorno activo sea el previsto.
8. Ejecutar una compra real controlada: contrastar recepción del dinero en la cuenta receptora, registro de venta, asignación y entrega. Documentar el resultado antes de abrir la recepción general de pedidos.

## Incidencias durante la apertura

Ante diferencias de importes, cobros adicionales, pagos en revisión o falta de persistencia, detener la apertura y conservar pedidos, pagos e historial para conciliación. No aprobar por parámetros de regreso ni borrar un registro para repetir un cobro.

Antes del lanzamiento debe quedar validado un procedimiento para pausar nuevos inicios de pago y mantener la conciliación de los ya existentes. Actualmente `MP_ENABLED` controla también la disponibilidad del webhook: desactivarlo no mantiene las notificaciones operativas. Esa variable no constituye por sí sola el procedimiento de pausa.

La etapa 13 se cierra cuando las comprobaciones externas y la compra controlada estén documentadas. Una ejecución local satisfactoria no cierra esas tareas.
