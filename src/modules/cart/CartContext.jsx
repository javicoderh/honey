import { createContext, useContext, useEffect, useMemo, useReducer, useState } from "react";
import { useModuleContext } from "../../shared/useModuleContext";
import { useCatalog } from "../store/CatalogContext";
import { cartReducer, resolveCart } from "./model.js";
import { browserCartStorage, readCart, writeCart } from "./storage.js";

const CartContext = createContext(null);

export function CartProvider({ children }) {
  const catalog = useCatalog();
  const [storage] = useState(browserCartStorage);
  const [state, dispatch] = useReducer(cartReducer, storage, (source) => ({ ...readCart(source), notice: null }));
  const [storageError, setStorageError] = useState(null);
  useEffect(() => {
    if (typeof window !== "undefined") setStorageError(writeCart(storage, state.lines));
  }, [storage, state.lines]);
  const cart = useMemo(() => resolveCart(state.lines, catalog.products), [state.lines, catalog.products]);
  const addItem = ({ slug, format, quantity = 1 }) => {
    const product = catalog.getProduct(slug);
    if (catalog.status !== "ready" || !product?.sizes.some((size) => size.label === format)) {
      dispatch({ type: "error", item: { slug, format }, message: "Este producto no está disponible. Actualiza el catálogo e inténtalo nuevamente." });
      return;
    }
    dispatch({ type: "add", item: { slug, format, quantity } });
  };
  const updateQuantity = (key, quantity) => dispatch({ type: "quantity", key, quantity });
  const removeItem = (key) => dispatch({ type: "remove", key });
  const clearCart = () => dispatch({ type: "clear" });
  return <CartContext.Provider value={{ ...cart, lines: state.lines, status: catalog.status, ready: catalog.status === "ready", notice: state.notice,
    persistenceError: storageError || state.loadError, addItem, updateQuantity, removeItem, clearCart, restoreSelection:lines=>dispatch({type:'restore',lines}) }}>{children}</CartContext.Provider>;
}

export const useCart = () => useModuleContext(CartContext, "Cart");

// El encabezado también se usa en staff, donde no se monta el carrito.
export function useCartCount() { return useContext(CartContext)?.itemCount ?? 0; }
