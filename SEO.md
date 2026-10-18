# Base SEO de Casa Miel

Implementación: React + Vite con prerender estático del mismo árbol de componentes. El plan editorial y de captación está en [PLAN_CONTENIDOS_CONVERSION_SEO.md](./PLAN_CONTENIDOS_CONVERSION_SEO.md).

## Qué entrega cada despliegue

`npm run build` ejecuta `scripts/build-seo.mjs`: consulta el catálogo público en modo API, valida y selecciona sus campos, compila Vite y genera HTML por ruta usando los mismos componentes React. Después genera `sitemap.xml`, `robots.txt`, una plantilla privada y `404.html`.

En esta primera versión hay 14 rutas prerenderizadas y dos plantillas adicionales. Cinco rutas son indexables: inicio, catálogo y las tres mieles principales. Si se retira una miel del catálogo, su URL deja de generarse y de aparecer en el sitemap. El catálogo sigue consultándose en el navegador para actualizar datos y precios; el servidor valida la compra con precios actuales.

El HTML contiene título, descripción, canonical cuando corresponde, Open Graph, Twitter Cards, idioma es-CL y JSON-LD. React actualiza el head al navegar sin recarga y elimina los metadatos de la ruta anterior. El modal mantiene la URL/canonical de la portada; «Conoce más» abre la ficha propia.

El catálogo público inicial permite pintar contenido útil antes de ejecutar JavaScript. La app conserva `createRoot`: React toma el control de la interfaz y del carrito local, sin intentar hidratar datos personales inexistentes en el HTML compartido. No se prerenderizan sesiones, datos de clientes, pedidos ni carritos reales.

## Política de indexación

| Ruta | HTML inicial | Indexación | Motivo |
|---|---|---|---|
| `/` | Contenido de portada | Sí | Marca y entrada a la tienda |
| `/productos` | Catálogo | Sí | Comparación comercial |
| Tres fichas principales | Descripción, formato, precio y CTA | Sí | Producto comercial con contenido público coherente |
| Clásica, polen, jalea real | Ficha actual | No | Información comercial pendiente de completar |
| `/nosotros`, `/contacto` | Contenido actual | No | Todavía contienen textos/canales provisionales |
| `/carrito`, `/checkout`, `/checkout/resultado` | Estado público vacío o formulario | No | Recorridos personales, sin valor de búsqueda |
| `/staff` y subrutas | Plantilla de acceso | No | Área privada; sigue protegida por autenticación/API |
| Rutas inexistentes | `404.html` | No | Vercel devuelve HTTP 404 al no haber fallback general de productos |

Las rutas privadas tienen además `X-Robots-Tag`. No se bloquean en robots.txt: Google necesita rastrear para leer noindex. El endpoint API se excluye del rastreo. Noindex es una directiva de búsqueda, no un control de acceso.

Con `cleanUrls: true` y `trailingSlash: false`, las páginas públicas usan URLs sin `.html` ni barra final (salvo `/`). Las rutas staff profundas usan la plantilla privada. No existe una reescritura genérica de productos a la portada, evitando que un producto inexistente responda 200 como si fuera válido. Dentro de la SPA, la vista desconocida lleva noindex; una petición directa recibe 404.

## Variables

| Variable | Uso |
|---|---|
| `VITE_SITE_URL` | Origen canónico; valor por defecto `https://honey-d164.vercel.app`. Sin ruta, query ni credenciales |
| `VITE_SEO_INDEXING` | `false` desactiva indexación. Su ausencia permite las rutas aprobadas en producción API |
| `VITE_DATA_MODE` | `api` permite catálogo real; `demo` queda noindex y sitemap vacío |
| `SEO_CATALOG_SOURCE` | Opcional, solo build: endpoint público de catálogo. Por defecto `${VITE_SITE_URL}/api?route=catalog` |
| `VERCEL_ENV` | Previews/desarrollo se marcan noindex automáticamente |
| `VERCEL_PROJECT_PRODUCTION_URL` | Si otro proyecto despliega el mismo repo en un dominio distinto del canónico, ese build queda noindex |

No se necesita añadir claves privadas para SEO. La única consulta de datos en la compilación es el catálogo público. Si falla o trae un precio/formato inválido, la compilación falla y no sustituye datos reales por datos demo. Debe existir el endpoint antes del primer build API; para un entorno nuevo, configurar `SEO_CATALOG_SOURCE` apuntando a un endpoint público operativo.

Al migrar a un dominio propio: cambiar `VITE_SITE_URL`, confirmar dominio en Vercel, ajustar `SEO_CATALOG_SOURCE` si el nuevo dominio aún no resuelve, desplegar, revisar canonical/robots/sitemap y configurar redirecciones permanentes desde el dominio anterior. Eliminar luego el override de catálogo si ya no es necesario.

## Datos estructurados

- Organization: nombre y URL reales de la marca. Sin dirección, teléfono ni redes inventadas.
- WebSite: inicio y nombre del sitio; sin SearchAction porque la tienda no ofrece una búsqueda pública funcional.
- CollectionPage / ItemList: las tres mieles principales existentes en el catálogo.
- Product / Offer: nombre, imagen referencial, descripción visible y precios CLP de los formatos reales del catálogo. No se inventan SKU, GTIN, reseñas, puntuaciones, stock ni fechas de vencimiento de precios.
- BreadcrumbList: inicio → productos → ficha; coincide con enlaces visibles en las fichas.

Faltan políticas de envío/devoluciones y disponibilidad verificada para enriquecer el marcado comercial. La ausencia de propiedades recomendadas puede generar avisos en herramientas de resultados enriquecidos; no se rellenan con suposiciones. Validar en Rich Results Test y Search Console una vez publicada la versión. No se garantiza una apariencia concreta en Google.

## Actualización de catálogo y contenido

El HTML, el sitemap y las vistas previas sociales son una instantánea del momento del build. Al cambiar precios, formatos, nombres, altas/bajas o textos públicos, volver a desplegar para actualizar esa instantánea. En el navegador se revalida el catálogo y se actualizan sus metadatos; el backend sigue calculando el pedido con datos vigentes. Si el catálogo empieza a cambiar frecuentemente, el siguiente paso es SSR/ISR o un disparador de build desde la administración; no está implementado todavía.

`src/data/honeyContent.js` contiene los textos compartidos entre portada/modal/ficha. `src/seo/model.js` contiene títulos, descripciones y la lista de rutas aprobadas para indexar. Cuando origen/contacto u otros productos estén completos, habilitarlos allí y comprobar que el sitemap y el contenido reflejen la decisión.

No se genera `lastmod` con la fecha del build: sin un dato fiable de actualización, es mejor omitirlo. No se añaden meta keywords, puntuaciones falsas, FAQ invisible ni páginas de ciudades generadas sin contenido útil.

## Verificaciones

```powershell
npm.cmd run build
npm.cmd run test:seo
npm.cmd run check:seo
npm.cmd run check:structure
node scripts/check-seo-browser.mjs
```

`test:seo` comprueba exclusiones, canonical sin parámetros/tokens, precios, previews, duplicados de dominio y serialización segura. `check:seo` inspecciona el HTML inicial, JSON-LD y sitemap del build. La comprobación de navegador valida navegación, actualización del catálogo, metadatos y carrito sobre los archivos de producción. También se debe comprobar por HTTP el deploy real: Vercel aplica cleanUrls, headers y 404 de forma distinta al servidor de desarrollo de Vite.

## Pendientes externos y de rendimiento

- Verificar propiedad en Search Console y enviar `/sitemap.xml`; requiere una cuenta/propiedad autorizada. No realizado automáticamente.
- Elegir dominio de marca. Por ahora la URL canónica es la que usa el usuario.
- Completar origen, contacto, políticas y catálogo adicional antes de permitir su indexación.
- Optimizar PNG a WebP/AVIF y versiones responsivas manteniendo transparencia; fotografía y tarjeta social propia pendientes.
- Medir PageSpeed/Core Web Vitals reales en móvil. Se mantienen dimensiones de imágenes, fuente con `display=swap`, preconexiones y prioridad de la imagen principal. No se ha certificado una puntuación Lighthouse.
- Configurar analítica y Merchant Center como tareas separadas cuando las cuentas y la operación estén listas.
