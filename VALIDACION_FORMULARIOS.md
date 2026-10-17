# Validación de formularios

| Dato del checkout | Condición |
| --- | --- |
| Nombre, correo y teléfono del comprador | Obligatorios. |
| Nombre y teléfono del destinatario | Obligatorios si recibe otra persona; si recibe el comprador, se usan sus datos. |
| Calle y número, comuna | Obligatorios. Se admiten direcciones rurales y nombres con acentos. |
| Departamento/casa/oficina, referencias, indicaciones | Opcionales. Pueden quedar vacíos. |

Las reglas comunes de correo y teléfono están en `src/shared/validation.js`. También se aplican al crear pedidos y corregir entregas, además de la validación de la interfaz.

- Correo: una arroba, usuario de hasta 64 caracteres y dirección de hasta 254. Admite alias con `+` y subdominios. Rechaza puntos iniciales/finales/consecutivos en el usuario y etiquetas de dominio vacías o con guiones en sus extremos. Valida correos habituales, no la existencia del buzón ni toda la sintaxis RFC.
- Teléfono: entre 8 y 15 dígitos; permite `+` al inicio, espacios, guiones y paréntesis simples con dígitos dentro. No exige prefijo chileno. Rechaza signos sin dígitos, letras y paréntesis incompletos. Se evitan cuantificadores anidados ambiguos.
- Nombres y direcciones: texto no vacío, sin exigir letras ASCII, dos apellidos ni números para direcciones rurales.

Login exige correo y contraseña; Equipo exige nombre, correo único y rol válido. Los comentarios requieren texto al guardarlos. Corregir datos de entrega requiere motivo. También se exige motivo para fallo, corrección de entrega completada y reasignación; para otros cambios de entrega es opcional. Ventas exige fecha o mes al consultar períodos, fecha final válida para rangos y texto al buscar en todo el historial.

Los campos compartidos muestran obligatoriedad u opcionalidad y vinculan ayudas y errores con `aria-describedby`; usan `required` y `aria-invalid`. Los formularios con validación propia usan `noValidate` para mantener mensajes coherentes. El checkout enfoca el primer error y actualiza los errores existentes al corregir el dato. Los fallos al guardar conservan el borrador y permiten reintentar. Los errores de comentario o motivo enfocan el campo correspondiente.

`npm.cmd run test:validation` cubre correos, teléfonos, espacios, entradas incompletas, opcionales y destinatario condicional. `npm.cmd run check:review-browser` verifica obligatoriedad en el DOM, rechazo de correo/teléfono mal formados, corrección de errores y reintento tras fallo del servicio, conservando los datos y dejando opcionales vacíos. La suite completa reúne 64 pruebas de módulos.
