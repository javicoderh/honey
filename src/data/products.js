export const products = [
  {
    slug: "miel-clasica",
    name: "Miel Clásica",
    eyebrow: "Para todos los días",
    summary: "Una miel versátil y cercana, pensada para acompañar la mesa cotidiana.",
    description: "La puerta de entrada a nuestra selección. Origen y perfil definitivo pendientes de la información real del productor.",
    color: "#d99022",
    accent: "#fff0c7",
    notes: ["Dulzor equilibrado", "Perfil amable", "Textura natural"],
    sizes: [
      { label: "250 g", price: 2990 },
      { label: "500 g", price: 4990, featured: true },
      { label: "1 kg", price: 8990 },
    ],
  },
  {
    slug: "miel-multifloral",
    name: "Miel Multifloral",
    eyebrow: "Nuestra recomendación",
    summary: "Una expresión de distintas floraciones, con el carácter del lugar y la temporada.",
    description: "El producto central del catálogo. La ficha final incorporará territorio, temporada, lote y notas de cata verificadas.",
    color: "#b96b27",
    accent: "#f9e1c3",
    notes: ["Floral", "Compleja", "Final persistente"],
    sizes: [
      { label: "1 kg", price: 6990, featured: true },
    ],
  },
  {
    slug: "miel-de-cerezo",
    name: "Miel de Cerezo",
    eyebrow: "Cosecha estacional",
    summary: "Una variedad escasa llamada a convertirse en la firma de la colección.",
    description: "Producto insignia sujeto a validación de origen botánico, zona productiva y temporada de cosecha.",
    color: "#8f3a4a",
    accent: "#f5dce1",
    notes: ["Frutal", "Delicada", "Edición limitada"],
    sizes: [
      { label: "1 kg", price: 9000, featured: true },
    ],
  },
  {
    slug: "miel-de-avellana",
    name: "Miel de Avellano",
    eyebrow: "Textura cremosa",
    summary: "Una miel cremosa para descubrir y acompañar tus pequeños rituales.",
    description: "La ficha final incorporará origen botánico, zona productiva y temporada de cosecha verificados.",
    color: "#b58a52",
    accent: "#f4e6cd",
    notes: ["Cremosa"],
    sizes: [
      { label: "1 kg", price: 7500, featured: true },
    ],
  },
  {
    slug: "polen-apicola",
    name: "Polen Apícola",
    eyebrow: "Producto de la colmena",
    summary: "Polen seleccionado con origen, formato y conservación claramente informados.",
    description: "La condición de polen fresco o seco y su conservación se completarán al confirmar el producto final.",
    color: "#cf8f15",
    accent: "#f7e7af",
    notes: ["Granulado", "Natural", "Origen por definir"],
    sizes: [
      { label: "250 g", price: 7990, featured: true },
      { label: "500 g", price: 14990 },
      { label: "1 kg", price: 26990 },
    ],
  },
  {
    slug: "jalea-real",
    name: "Jalea Real",
    eyebrow: "Fresca y refrigerada",
    summary: "Un producto especializado que exige información y conservación cuidadosas.",
    description: "Antes de venderla se deben confirmar composición, lote, origen y condiciones de conservación.",
    color: "#e4a82c",
    accent: "#fff1bd",
    notes: ["Pura", "Fresca", "Formato dosificado"],
    sizes: [{ label: "10 g", price: 17990, featured: true }],
  },
];

export const formatPrice = (price) =>
  new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0,
  }).format(price);

export const startingPrice = (product) => Math.min(...product.sizes.map(({ price }) => price));
