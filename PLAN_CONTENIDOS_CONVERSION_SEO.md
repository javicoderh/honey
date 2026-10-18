# Revisión de textos, conversión y plan de SEO orgánico — Casa Miel

Fecha: 18 de octubre de 2026. Alcance: tienda pública, compra, recuperación de carrito y mensajes del equipo. Esta revisión parte del código y del catálogo conectado; las mejoras de conversión son hipótesis para medir, no resultados demostrados. No hay datos de Search Console, analítica de tráfico ni volúmenes de búsqueda disponibles en esta revisión.

## 1. Decisión editorial

Conservar la personalidad visual y el concepto «Hay un mundo en cada gota», pero acompañarlo de información que ayude a elegir: variedad, textura, formato, precio, costo de entrega y siguiente paso. La portada sigue siendo una sola pantalla; el contenido extenso vive en las fichas y futuras guías.

Voz: cercana, concreta, en español de Chile. Usar «tú» y verbos de acción. Reservar «ritual» para titulares; evitar repetirlo en cada párrafo. En botones y errores, explicar qué ocurrirá. Distinguir siempre pedido creado, pago confirmado y entrega completada.

«SEO orgánico» se refiere a captación desde resultados de búsqueda, no a afirmar que la miel cuenta con certificación orgánica.

## 2. Qué ya se implementó y qué es propuesta

**Implementado en esta pasada:** HTML prerenderizado por ruta; títulos y descripciones propios; canonical; Open Graph y Twitter Cards; sitemap y robots; datos estructurados; exclusión de páginas privadas/incompletas; página 404; actualización de metadatos al navegar; migas de pan en las fichas. Se corrigió el aviso de compra demo que aparecía también en modo API y las tres fichas principales ahora reutilizan las descripciones públicas de sus modales, sustituyendo textos internos de preparación y etiquetas de escasez no verificadas.

**Propuesta para una siguiente pasada editorial:** los textos de las tablas siguientes, nuevas páginas de ayuda y contenido, fotografía, políticas comerciales, analítica y campañas. No se han publicado biografías, ubicaciones, testimonios, plazos de entrega ni canales de contacto inventados. Mercado Pago sigue pendiente de la reunión de cuentas; no se activó. No se enviaron correos.

**Fuente comercial:** el catálogo de la API prevalece sobre las propuestas antiguas de precios. Al revisar: multifloral 1 kg $6.990; cerezo y avellano 1 kg $9.000 cada una. Estos números son una referencia del momento, no se fijan en el copy ni en el SEO: se obtienen del catálogo. Despacho inicial acordado: $3.000, sujeto a la consulta y cobertura del backend; no prometer «a todo Chile» ni entrega en 24/48 horas sin confirmación.

Los documentos `PROPUESTA_INICIAL_MARKETING.md` y `PLAN_PRODUCTOS_Y_PRECIOS.md` describen una etapa anterior (Astro/Shopify y otros formatos/precios). Se conservan como antecedentes; este plan corresponde a React + Vite, Vercel y Supabase, con las tres mieles de 1 kg.

## 3. Hallazgos priorizados

| Prioridad | Hallazgo comprobado | Consecuencia probable | Acción |
|---|---|---|---|
| P0 | `/contacto` muestra `hola@example.com` | El comprador no tiene un canal útil y puede abandonar | Confirmar correo/WhatsApp comercial y reemplazar el ejemplo; noindex mientras tanto |
| P0 | `/nosotros` dice «La historia se completará con evidencia real» | Debilita la confianza en el origen | Redactar con productor, localidad y proceso confirmados; noindex hasta completar |
| P0 | Fichas principales mostraban instrucciones internas y escasez sin respaldo | Dudas antes de agregar al carrito | Corregido: descripción de textura y uso compartida con modal |
| P0 | Aviso «Compra de demostración» incondicional en ficha | Contradicción con catálogo/API reales | Corregido: aviso solo en modo demo |
| P0 | Pago real todavía no habilitado | No se puede medir venta pagada real de punta a punta | Mantener mensaje honesto; habilitar con el encargado antes de promover ventas |
| P1 | Portada muy emocional, poco explícita sobre formato/elección | El visitante puede no comprender qué comprar | Añadir formato y textura al subtítulo, sin agregar scroll |
| P1 | «Dura» puede interpretarse como defecto | Fricción al comparar con «cremosa» | Proponer «textura firme» en textos comerciales; validar nombre final con productor |
| P1 | Fichas de clásica, polen y jalea aún contienen preparación interna | Catálogo amplio con información desigual | Noindex de estas fichas; completar antes de promocionarlas |
| P1 | Costos y condiciones de entrega no están explicados en una página útil | Sorpresa al final del recorrido | Página de envíos con cobertura, tarifa y tiempos reales |
| P1 | Sin títulos, canonical ni HTML inicial propios por ruta | Poca diferenciación para buscadores y vistas compartidas | Implementado en esta pasada |
| P1 | Imágenes PNG de aproximadamente 2–3 MB cada una | La primera carga móvil puede retrasarse | Optimizar formatos/tamaños y medir LCP antes/después |
| P2 | El guardado de carrito exige permiso de recordatorio y aún no envía emails | Puede generar expectativas distintas al funcionamiento actual | Mantener aclaración; separar guardado y recordatorio en un cambio funcional posterior |
| P2 | «Ventas / Facturación» es un registro interno, no emisión tributaria | Confusión operativa | Proponer «Ventas y pagos»; conservar explicación de emisión |

## 4. Auditoría y propuesta por pantalla

Cada fila indica la intención del cambio; no equivale a una promesa de aumento de ventas.

| Pantalla / ubicación | Texto actual o problema | Propuesta concreta | Objetivo / condición |
|---|---|---|---|
| Navegación | Productos / Origen / Contacto | Nuestras mieles / Nuestro origen / Ayuda y contacto | Hacer explícito lo que encontrará; mantener enlaces actuales |
| Portada, H1 | «Hay un mundo en cada gota.» | Mantener | Ya diferencia la marca y encaja con el arte |
| Portada, subtítulo | «Mieles chilenas para descubrir con calma. Elige tu sabor, encuentra tu pequeño ritual.» | «Tres mieles, distintas texturas. Elige tu favorita en pote de 1 kg.» | Claridad comercial en dos líneas; sin ampliar el alto móvil |
| Portada, origen | «De la colmena Puconina a tu mesa» | Si se verifica: «De Pucón a tu mesa». Mientras: «Tres mieles para descubrir» | No usar localidad como prueba de origen sin respaldo |
| Selección de miel | «Dura» / «Cremosa» | «Firme» / «Cremosa» | Comparación comprensible y más apetecible |
| Modal multifloral | «Un jardín en tu mesa.» | Mantener + «Textura firme para disfrutar en tu desayuno. Elige tu pote de 1 kg.» | Conectar textura, ocasión y formato |
| Modal cerezo | «Tu momento más dulce.» | «Cremosa, para disfrutar sin apuro.» | Decir qué aporta la variedad sin escasez artificial |
| Modal avellano | «Un nuevo ritual, a cucharadas.» | «Una nueva favorita para tu desayuno.» | Diferenciación por ocasión; confirmar sabor antes de describir notas |
| Modal, ficha | «Conoce más sobre esta miel» | «Ver detalles de esta miel» | Anticipar destino con menos palabras; se puede conservar el actual si se prefiere |
| Modal, CTA | «Agregar al carrito» | Mantener | Acción clara, sin fingir compra o reserva |
| Modal, confirmación | «Producto agregado al carrito.» | «Agregaste [nombre] a tu carrito.» + «Ver mi carrito» | Confirmación específica; requiere texto parametrizado |
| Catálogo, H1 | «Elige tu próxima favorita.» | «Encuentra tu miel favorita.» | Incluir el producto en el título visible |
| Catálogo, apoyo | «Tres mieles. Acércate y descubre la tuya.» | «Compara texturas y elige tu pote de 1 kg.» | Sustituir instrucción ambigua por criterio de elección |
| Catálogo, otras categorías | «Más de la colmena» | Mantener; promocionar productos adicionales solo con fichas completas | Evitar desviar tráfico a fichas sin preparar |
| Fichas, título | Nombre de la miel | «Miel [variedad] · 1 kg» solo cuando sea el único formato real | Claridad para compra y búsqueda; título dinámico al cambiar formatos |
| Fichas, descripción | Antes: notas internas de preparación | Usar bloques de textura, ocasión y formato; versión inicial implementada | Más información útil cerca del CTA |
| Fichas, formato | «Elige un formato» incluso si solo hay uno | «Tu formato» si hay uno; «Elige un formato» si hay varios | Evitar una elección aparente que no existe |
| Fichas, tranquilidad | Aviso demo en producción | «Compra sin crear una cuenta. Consulta el costo de despacho al completar tu comuna.» | Implementado; respeta la operación real |
| Carrito, H1 | «Un pequeño ritual, a tu gusto.» | «Tus mieles, listas para el siguiente paso.» | Mantener cercanía y explicar el estado |
| Carrito vacío | «Tu próxima favorita te espera.» | Mantener + «Elige una miel para comenzar.» | Próxima acción clara |
| Carrito, entrega | «Por calcular» | «Se calcula al ingresar tu comuna» | Explicar por qué aún no hay importe |
| Carrito, CTA | «Continuar con mi compra» | «Continuar con mis datos de entrega» | Anticipar el paso real; probar largo del botón móvil |
| Carrito, borrar | «Vaciar carrito» | Mantener con confirmación | Acción destructiva debe ser literal |
| Checkout, H1 | «De la colmena a tu puerta.» | «¿Dónde entregamos tus mieles?» | Orientar al formulario sin prometer cobertura universal |
| Checkout, apoyo | «No necesitas crear una cuenta.» | «Completa tus datos y revisa el total con despacho.» + compra como invitado | Claridad de proceso |
| Checkout, comuna | «Completa la comuna para consultar cobertura y tarifa.» | «Ingresa tu comuna para ver el costo de entrega.» | Mensaje más corto; error debe distinguir sin cobertura de fallo técnico |
| Checkout, acción | «Crear pedido» | Mantener mientras el pago está pendiente. Con pago activo: «Crear pedido y continuar al pago» | No llamar «Pagar» a un botón que solo crea el pedido |
| Pago no activo | «Pago en línea aún no habilitado» | «Tu pedido quedó registrado. El pago en línea aún no está disponible y no se realizó ningún cobro.» | Informar la limitación sin disimularla |
| Pago pendiente | «Un pago pendiente o rechazado no habilita el despacho.» | «Estamos esperando la confirmación del pago. Aquí podrás consultar cuando cambie su estado.» | Explicar qué hacer; no sugerir pagar nuevamente |
| Pago rechazado | Mismo texto que pendiente | «El pago no se completó. Revisa el estado antes de volver a intentarlo.» | Evitar duplicar cobros cuando haya incertidumbre |
| Pago confirmado | «El pago de tu pedido está confirmado.» | «Recibimos el pago de tu pedido [número]. Guarda este enlace para consultar su estado.» | Confirmación concreta; no prometer preparación inmediata |
| Enlace privado | «Es privado: no lo compartas.» | Mantener | Instrucción importante para la protección del pedido |
| Guardar carrito | «¿Prefieres comprar después?» | «Guarda tus mieles para volver después.» | Expresar el beneficio; mantener plazo de 30 días |
| Recuperación, botón | «Recuperar selección» | «Recuperar mi carrito» | Vocabulario consistente con el resto de la compra |
| Recuperación, datos | «Tu correo para recuperar el carrito» | «Correo para guardar tu selección» mientras el envío no está activo | No insinuar que se mandará un correo inmediatamente |
| Consentimiento marketing | «También quiero recibir catálogos, novedades y promociones…» | Mantener optativo y desmarcado | La conversión no debe depender de aceptar campañas |
| Baja de emails | «Confirmar baja de correos» | Mantener | Facilitar una salida clara y sin presión |
| Origen | «La historia se completará con evidencia real.» | Véase borrador condicionado abajo | Sustituir nota de proyecto por historia comprobable |
| Contacto | «Los canales definitivos se incorporarán…» y email ficticio | «Te ayudamos a elegir tu miel.» + canal comercial verificado | Resolver dudas reales antes de pagar |
| Footer | «Mieles chilenas con origen y carácter propio.» | «Tres mieles para encontrar tu favorita.» hasta completar evidencia de origen | Menos promesa no documentada |
| Footer, ayuda | Dos enlaces diferentes apuntan a contacto vacío | «Ayuda y contacto» ahora; separar FAQ/envíos cuando tengan contenido | El destino debe cumplir la etiqueta |
| 404 | «Esta página no está en la colmena.» | Mantener + CTA «Ver nuestras mieles» | Recuperar navegación hacia catálogo |
| Fallo de catálogo/precio | «No pudimos consultar los precios» | Mantener explicación de que el carrito se conserva + reintentar | No ocultar errores comerciales con copy persuasivo |
| Validaciones | Campos requeridos, email/teléfono y dirección | Mantener junto al campo, indicar cómo corregir: «Ingresa tu correo, por ejemplo nombre@dominio.cl» | Evitar genéricos «Dato inválido»; no borrar datos ingresados |

### Fichas: borradores completos para la siguiente iteración

**Multifloral**

- H1: «Miel Multifloral»; formato y precio junto al título.
- Bajada: «Una miel de textura firme para acompañar tu desayuno.»
- Descripción: «Dale un lugar en tu mesa: sobre pan tibio o junto a tu té favorito. Elige tu pote de 1 kg y disfruta a tu ritmo.»
- Datos: textura firme, peso real y composición confirmada. Añadir procedencia/cosecha solo con información del productor.
- CTA: «Agregar al carrito». Apoyo: «Compra sin crear una cuenta. El despacho se calcula con tu comuna.»

**Cerezo**

- H1: «Miel de Cerezo».
- Bajada: «Textura cremosa para tus pausas más dulces.»
- Descripción: «Una cucharada sobre una tostada o junto a tu yogur favorito. Descubre esta miel en pote de 1 kg.»
- No usar «escasa», «edición limitada», «monofloral certificada» ni notas de sabor que aún no se hayan verificado.
- Mantener nombre comercial actual; confirmar origen botánico antes de basar una campaña en esa denominación.

**Avellano**

- H1: «Miel de Avellano».
- Bajada: «Una miel cremosa para renovar tu desayuno.»
- Descripción: «Elige tu pote de 1 kg y encuentra tu combinación favorita en la mesa de cada día.»
- Confirmar qué significa «avellana»: origen floral, ingrediente incorporado u otra denominación. La ficha debe explicar composición y alérgenos cuando exista información validada. No insinuar sabor a fruto seco ni ausencia de alérgenos.

**Clásica, polen y jalea real**

Mantener fuera del sitemap hasta tener ficha comercial completa. Para cada uno: nombre correcto, composición, peso, uso descrito sin efectos terapéuticos, conservación validada, origen y disponibilidad real. En jalea real no presentar cadena de frío o frescura como resueltas si aún no se ha confirmado su operación.

### Origen: estructura para completar con el productor

H1 propuesto: «Conoce a quienes están detrás de Casa Miel.»

Bajada provisional sin promesas: «Queremos que elegir tu miel sea sencillo: conocer su textura, su formato y las personas que la producen.»

La historia final requiere: nombre del productor, localidad exacta, experiencia real, fotos propias, cosecha/envasado y forma de identificar cada lote. Plantilla de trabajo, no texto publicable: «Trabajamos con [productor] en [localidad], donde [práctica comprobada]. Cada cosecha se identifica mediante [sistema real].»

### Contacto y ayuda: estructura propuesta

H1: «Te ayudamos a elegir tu miel.»

Bajada: «Consulta sobre variedades, formatos o tu pedido.» Botones: «Escribir por WhatsApp» y/o «Enviar un correo», solo con canales confirmados. Horario y plazo de respuesta solo si el equipo puede cumplirlos.

Preguntas útiles: ¿qué textura tiene cada miel?, ¿cuánto contiene el pote?, ¿cómo se calcula el despacho?, ¿puedo comprar sin cuenta?, ¿cómo reviso mi pedido?, ¿qué medios de pago están activos?, ¿cómo guardo mi carrito? La pregunta de pago debe cambiar cuando Mercado Pago esté operativo. Las respuestas de conservación/composición deben validarse antes de publicarlas.

## 5. Mensajes internos: claridad operativa

Revisados acceso staff, pedidos, ventas, equipo, despachos, delivery y Marketing. No aplicar lenguaje persuasivo a confirmaciones operativas. Su objetivo es evitar errores que después afectan al comprador.

| Ubicación | Propuesta | Razón |
|---|---|---|
| Login | Mantener «Acceso del equipo», «Correo», «Contraseña», «Iniciar sesión» | Es claro y distingue acceso de clientes |
| Panel admin | «Ventas y pagos» en lugar de «Ventas / Facturación» | No existe emisión tributaria integrada |
| Equipo | «Administrador» / «Repartidor» en lugar de «Admin» / «Delivery» si se busca consistencia | Facilitar lectura a usuarios no técnicos |
| Equipo, sin historial | «Sin cambios registrados» en lugar de «Cuenta inicial de demostración» en API | Evitar atribuir carácter demo a una cuenta real |
| Pedido no encontrado | «No encontramos este pedido. Vuelve a la lista y actualiza la consulta.» en API | No atribuirlo al reinicio de la demo sin saber la causa |
| Pago en revisión | Mantener «No realices otro pago» y bloqueo de despacho | Priorizar certeza del estado |
| Cancelar / archivar | Mantener advertencia de que no efectúa reembolso y conserva historial | Acción comercial sensible |
| Entregas | Mantener destinatario, teléfono, dirección y estado antes de confirmar | Reduce entregas mal registradas |
| Marketing | «Carritos guardados», «Contactos y recompra» y aclaración «todavía no envía correos» | Describe capacidades actuales |
| Exportaciones | Mantener límite, permisos, bajas y exclusión de ficticios | Evitar campañas a segmentos incorrectos |

Fuentes revisadas: `src/pages`, `src/components`, `src/modules/cart`, `purchase`, `payments`, `staff`, `orders`, `sales`, `deliveries`, `marketing` y mensajes compartidos en `src/shared`. Los cambios de denominación de estados internos deben conservar sus valores de datos y contratos API.

## 6. Arquitectura SEO orgánica

### Mapa de intención y página de destino

Estas consultas son hipótesis iniciales. No se asignan volúmenes, dificultad ni proyecciones de ventas sin datos de Search Console/una herramienta de investigación.

| Grupo de consultas | Intención | Destino | Acción |
|---|---|---|---|
| Casa Miel, Casa Miel mieles | Marca | `/` | Identidad de marca y acceso al catálogo |
| comprar miel, miel 1 kg, miel online Chile | Compra / comparación | `/productos` | Diferenciar texturas, formato y precio; evitar competir con la portada por el mismo H1 |
| miel multifloral 1 kg, comprar miel multifloral | Compra específica | `/productos/miel-multifloral` | Ficha completa y enlaces desde catálogo/guías |
| miel de cerezo, miel cerezo 1 kg | Producto específico | `/productos/miel-de-cerezo` | Explicar denominación con evidencia antes de ampliar contenido botánico |
| miel de avellano, miel avellano cremosa | Producto específico ambiguo | `/productos/miel-de-avellana` | Aclarar composición y origen de la denominación |
| miel firme o cremosa, qué miel elegir | Comparación | Futura `/guias/como-elegir-miel` | Guía útil con enlaces a las tres fichas |
| por qué cambia la textura de la miel | Informativa | Futura `/guias/texturas-de-la-miel` | Redactar con fuente técnica y revisión del productor |
| cómo conservar la miel | Informativa | Futura `/guias/conservar-miel` | Validar recomendaciones; no copiar consejos sin fuente |
| desayunos con miel | Inspiración | Futura `/guias/desayunos-con-miel` | Recetas probadas, fotos propias y productos usados |
| miel en Pucón / miel de Pucón | Local / origen | `/nosotros` y ficha, solo si se confirma | No crear páginas de ciudades sin operación real |

No abrir decenas de páginas de «miel en [comuna]». Una página de envíos con cobertura real es más útil que páginas repetidas sin contenido propio.

### Estructura de contenidos de una ficha

1. H1 con nombre; formato/precio visible; descripción breve; agregar al carrito.
2. Textura y usos sugeridos, distinguiendo sugerencia culinaria de característica verificada.
3. Composición, origen, productor, proceso y conservación confirmados.
4. Entrega y pago: enlazar condiciones reales.
5. Preguntas que resuelvan dudas específicas del producto.
6. Otra variedad para comparar y enlace al catálogo.

Evitar relleno para alcanzar un número de palabras. No añadir bloques a la portada que rompan su diseño sin scroll; usar fichas y guías para profundidad temática.

### Enlazado interno

Inicio → catálogo → cada ficha. Fichas → catálogo mediante migas de pan. Guías → una o dos fichas pertinentes y viceversa. Footer → contacto, origen, envíos y políticas cuando existan. Usar enlaces `<a href>` reales; los modales no reemplazan las URLs de producto. Cada contenido debe tener una finalidad distinta para no duplicar la intención de búsqueda.

## 7. Plan de ejecución de ocho semanas

| Momento | Entregable | Responsable sugerido | Criterio de cierre |
|---|---|---|---|
| Ahora | Base técnica SEO y revisión editorial | Desarrollo | HTML inicial, metadata, sitemap, noindex y navegación verificados |
| Semana 1 | Ficha maestra de productos y condiciones comerciales | Productor + encargado comercial | Composición, origen, formatos, stock, cobertura, plazos y contacto confirmados |
| Semana 1 | Dominio de marca y Search Console | Responsable del dominio + desarrollo | Dominio canónico decidido, propiedad verificada, sitemap enviado |
| Semana 2 | Aprobar/publicar textos comerciales, origen y ayuda | Marca + contenido | Sin placeholders; información real en cada enlace público |
| Semana 2 | Pago real y compra controlada | Encargado de cuentas + desarrollo | Pago confirmado y pedido/entrega probados; prerrequisito para medir ventas reales |
| Semanas 2–3 | Fotografías, WebP/AVIF y medición de rendimiento | Diseño + desarrollo | Comparación de peso y Core Web Vitals en móvil; sin recorte de producto |
| Semana 3 | Medición del embudo | Desarrollo + marketing | Eventos de selección, carrito, checkout y compra verificados sin datos personales |
| Semanas 3–4 | Guía de elección y guía de texturas | Contenido + productor | Contenido original y revisado; enlaces a fichas |
| Semanas 5–6 | Origen documentado y guía de conservación | Productor + contenido | Fotografías/evidencia y revisión de recomendaciones |
| Semanas 7–8 | Contenido de usos y primera revisión de consultas | Marketing | Decisiones basadas en impresiones, clics y embudo; no solo posiciones |

Posponer publicación de una guía si faltan datos para responder bien. Un artículo semanal es una capacidad de trabajo sugerida, no un requisito de Google.

### Distribución orgánica

Compartir fichas/guías desde canales propios confirmados, colaboraciones reales con productores y menciones editoriales pertinentes. Si existe un negocio elegible con operación física, evaluar Google Business Profile con sus datos reales; no crear una dirección ficticia para SEO local. Evaluar Merchant Center y fichas gratuitas tras completar datos, políticas y operación de venta. Sin compra de enlaces ni reseñas fabricadas.

## 8. Medición y experimentos

No se instaló analítica ni se conectó una cuenta externa en esta pasada. Preparar consentimiento/configuración según el proveedor elegido antes de instrumentar. No enviar correo, nombre, teléfono, dirección, identificadores privados del pedido ni tokens del carrito en URLs o eventos.

Eventos propuestos: `view_item_list`, `select_item` (abrir modal), `view_item`, `add_to_cart` (solo cuando se agrega), `view_cart`, `begin_checkout`, `order_created` y `purchase` (solo pago aprobado, deduplicado por pedido; excluir `isTest`). Mantener separado `order_created` de `purchase` mientras Mercado Pago esté pendiente. Para recuperación, medir consentimiento, recuperación efectiva y compra posterior; un enlace recuperado no es una venta.

| Indicador | Definición / uso |
|---|---|
| CTR orgánico | Clics / impresiones por consulta y página en Search Console |
| Selección de producto | Visitantes que abren una miel / visitantes de la portada |
| Conversión a carrito | Sesiones con agregado exitoso / sesiones que vieron producto o modal |
| Inicio de checkout | Sesiones con inicio de checkout / sesiones con carrito |
| Conversión a compra | Sesiones con pago aprobado real / sesiones elegibles; definir atribución antes de reportar |
| Abandono | Separar carrito sin pedido, pedido sin pago y pago rechazado |
| Ingresos orgánicos | Pagos reales atribuidos según modelo acordado; excluir ficticios y tratar reembolsos explícitamente |
| Rendimiento | LCP ≤2,5 s, INP ≤200 ms y CLS ≤0,1 como metas de experiencia en percentil 75; no resultados actuales |

Primero obtener una línea base. Luego probar un cambio por hipótesis: subtítulo explícito vs emocional, «firme» vs «dura», costo de entrega explicado antes del checkout y confirmación de agregado específica. Comparar por dispositivo y fuente. Definir muestra/duración antes; si el tráfico no permite un A/B fiable, usar pruebas de usuario y comparación temporal con cautela. No prometer un porcentaje de mejora sin evidencia.

## 9. Pendientes para activar el plan completo

- Dominio definitivo de marca y acceso a Search Console. Mientras, canonical usa la URL pública actual de Vercel.
- Correo/WhatsApp comercial, horario y persona responsable de responder.
- Datos verificables del productor, origen botánico, composición y conservación de cada producto.
- Confirmación comercial de catálogo adicional, cobertura, tiempos y condiciones de entrega.
- Políticas reales de privacidad, compra, cambios/devoluciones y mecanismo tributario, revisadas por responsables correspondientes.
- Cuenta de Mercado Pago habilitada y compra real controlada.
- Proveedor de analítica y de correos; el módulo actual prepara contactos/listas pero no envía campañas.
- Fotografías oficiales: las imágenes actuales siguen siendo ilustraciones referenciales.

Estos pendientes no impiden mantener la base técnica, pero sí limitan qué textos, campañas y datos enriquecidos es correcto publicar.

## 10. Fuentes de criterios técnicos

Consultadas el 18 de octubre de 2026. Se usaron fuentes oficiales; las propuestas de copy y priorización son recomendaciones para Casa Miel.

- [Google: SEO en aplicaciones JavaScript](https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics): HTML inicial, títulos/canonical y errores de rutas.
- [Google: estructura de una tienda](https://developers.google.com/search/docs/specialty/ecommerce/help-google-understand-your-ecommerce-site-structure): enlaces y descubrimiento de productos.
- [Google: sitemap](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap): URLs canónicas y fechas de actualización reales.
- [Google: noindex](https://developers.google.com/search/docs/crawling-indexing/block-indexing): el robot debe poder leer la exclusión.
- [Google: Product](https://developers.google.com/search/docs/appearance/structured-data/product-snippet), [Organization](https://developers.google.com/search/docs/appearance/structured-data/organization) y [BreadcrumbList](https://developers.google.com/search/docs/appearance/structured-data/breadcrumb): representar información real de la página. El marcado no garantiza resultados enriquecidos.
- [Vite: renderizado en servidor y prerender](https://vite.dev/guide/ssr.html).
- [Vercel: configuración de rutas](https://vercel.com/docs/project-configuration).
- [Google: Core Web Vitals](https://developers.google.com/search/docs/appearance/core-web-vitals).
