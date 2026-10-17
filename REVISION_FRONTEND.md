# Revisión del frontend — etapa 10

Revisión local del 17 de octubre de 2026. El frontend sigue funcionando con servicios simulados: no realiza cobros, envíos, autenticación ni emisión tributaria reales.

## Escenarios reproducibles

`scripts/fixtures/review-orders.mjs` crea siete pedidos ficticios mediante las reglas del dominio. Incluye pagos pendientes, rechazados y aprobados; entregas pendientes, listas, en reparto, fallidas y completadas; comprador distinto del destinatario, comentarios, referencias e indicaciones especiales. Se usa únicamente en pruebas. La aplicación normal comienza sin pedidos precargados.

Ejecutar `npm.cmd run test:review` y `npm.cmd run check:review-browser`. El recorrido de navegador inyecta estos datos en un adaptador nuevo, verifica filtros y contadores, y prueba una consulta diferida que pasa por carga, error y recuperación.

## Cobertura revisada

| Área | Evidencia |
| --- | --- |
| Compra y pago | `check:deliveries-browser`: compra invitada, destinatario distinto, pago simulado aprobado y pedido compartido. Pruebas de checkout: rechazo, error de conexión, reintento y prevención de duplicados. |
| Operación completa | `check:deliveries-browser`: preparación admin, asignación, consulta del delivery, comentario, entrega fallida, entrega completada y corrección; sincronización con Pedidos y Ventas. |
| Formularios y consultas | `check:review-browser`: validación de Equipo y Checkout con foco en el primer error; consulta con carga/error/reintento; resultado de compra vacío. Los recorridos de Pedidos/Ventas comprueban filtros, estados vacíos, confirmaciones y regreso conservando filtros. |
| Roles y acceso | `check:staff-browser` y `check:team-browser`: ambos roles, vencimiento, cierre, acceso denegado, último admin y revocación tras cambiar permisos. |
| Escritorio y móvil | Capturas y controles de desbordamiento a 1280 y 390 px en Pedidos, panel admin, Equipo, login, delivery y Checkout; Despachos y confirmación a 390 px, Checkout también a 360 px. Ventas y detalles cuentan además con sus recorridos móviles específicos. |
| Teclado | Foco en contenido tras cambiar de ruta, campos con etiquetas, error asociado al campo, apertura de confirmación con Enter, Tab y Mayús+Tab dentro del diálogo, Escape para cancelar y retorno al control inicial. Foco visible y navegación con movimiento reducido. |
| Datos y simulación | Contraseñas de prueba ausentes de localStorage/sessionStorage tras un login fallido. Solo el carrito persiste selección y cantidades; sesiones y pedidos permanecen en memoria. Avisos explícitos de demostración y ausencia de cobro real en Checkout y resultados. |

Las capturas locales se guardan en `.preview-browser/review-*.png` y no se versionan. Se inspeccionaron visualmente el panel admin de escritorio, listados y formulario de Equipo en móvil, Checkout móvil, confirmación y panel delivery de escritorio. Esta revisión no equivale a una auditoría completa de accesibilidad ni a pruebas con todos los navegadores o lectores de pantalla.

## Correcciones

- El contenido principal ahora recibe foco tras cada cambio de ruta, incluso al cambiar el conjunto de contextos montados. El enlace para saltar al contenido tiene un destino enfocable.
- El contenido dispone de un indicador de foco visible y la navegación respeta la preferencia de movimiento reducido, incluido el desplazamiento de página.

## Validación y siguiente paso

59 pruebas de módulos, comprobación de estructura, compilación de producción y seis recorridos de navegador: staff, pedidos, ventas, despachos, equipo y revisión integral. Los recorridos de navegador deben ejecutarse secuencialmente: comparten puertos y perfil de Edge.

Sigue la etapa 11: elegir y conectar backend, base de datos y autenticación con permisos reales. Antes de habilitar cobros también falta definir cobertura y tarifa comercial (pendiente de la etapa 4), integrar Mercado Pago y completar la validación de operación de las etapas 12–13. Esta etapa no publica cambios en GitHub ni despliega el sitio.
