export const MAX_CART_QUANTITY = 99;
export const cartItemKey = ({ slug, format }) => `${encodeURIComponent(slug)}:${encodeURIComponent(format)}`;

function validLine(line) {
  return typeof line?.slug === "string" && line.slug.trim().length > 0 && line.slug.length <= 150
    && typeof line.format === "string" && line.format.trim().length > 0 && line.format.length <= 80
    && Number.isInteger(line.quantity) && line.quantity >= 1 && line.quantity <= MAX_CART_QUANTITY;
}

export function sanitizeCart(lines) {
  if (!Array.isArray(lines)) throw new Error("Carrito inválido");
  const result = [];
  for (const line of lines) {
    if (!validLine(line)) throw new Error("El carrito contiene un producto o cantidad inválidos");
    const existing = result.find((entry) => cartItemKey(entry) === cartItemKey(line));
    if (existing) {
      existing.quantity += line.quantity;
      if (existing.quantity > MAX_CART_QUANTITY) throw new Error("Cantidad del carrito fuera de rango");
    } else result.push({ slug: line.slug, format: line.format, quantity: line.quantity });
  }
  return result;
}

export function cartReducer(state, action) {
  const key = action.item ? cartItemKey(action.item) : action.key;
  try {
    if (action.type === "clear") return { ...state, lines: [], notice: null };
    if (action.type === "remove") return { ...state, lines: state.lines.filter((line) => cartItemKey(line) !== key), notice: null };
    if (action.type === "add") {
      if (!validLine(action.item)) throw new Error(`Elige una cantidad entre 1 y ${MAX_CART_QUANTITY}.`);
      const lines = sanitizeCart([...state.lines, action.item]);
      return { ...state, lines, notice: { key, kind: "success", text: "Producto agregado al carrito." } };
    }
    if (action.type === "quantity") {
      if (!Number.isInteger(action.quantity) || action.quantity < 1 || action.quantity > MAX_CART_QUANTITY) throw new Error(`Elige una cantidad entre 1 y ${MAX_CART_QUANTITY}.`);
      return { ...state, lines: state.lines.map((line) => cartItemKey(line) === key ? { ...line, quantity: action.quantity } : line), notice: null };
    }
    if (action.type === "error") return { ...state, notice: { key, kind: "error", text: action.message } };
    return state;
  } catch (error) {
    return { ...state, notice: { key, kind: "error", text: error.message } };
  }
}

// El almacenamiento solo guarda la elección; precios y disponibilidad vienen del catálogo.
export function resolveCart(lines, products) {
  const items = lines.map((line) => {
    const product = products.find((entry) => entry.slug === line.slug);
    const size = product?.sizes.find((entry) => entry.label === line.format);
    const available = Boolean(size && Number.isSafeInteger(size.price) && size.price >= 0 && Number.isSafeInteger(size.price * line.quantity));
    return { ...line, key: cartItemKey(line), product, name: product?.name ?? "Producto no disponible", available,
      unitPrice: available ? size.price : null, lineTotal: available ? size.price * line.quantity : null };
  });
  const subtotal = items.reduce((sum, item) => sum + (item.lineTotal ?? 0), 0);
  return { items, itemCount: lines.reduce((sum, line) => sum + line.quantity, 0), subtotal,
    canCheckout: items.length > 0 && items.every((item) => item.available) && Number.isSafeInteger(subtotal) };
}
