import { createContext, useEffect, useRef, useState } from "react";
import { useServices } from "../../services/ServicesContext";
import { useCart } from "../cart/CartContext";
import { useModuleContext } from "../../shared/useModuleContext";
import { createPurchaseDraft, updatePurchaseDraft, resolveRecipient } from "./model.js";

const PurchaseContext = createContext(null);

export function PurchaseProvider({ children }) {
  const services = useServices();
  const cart = useCart();
  const completed = useRef(new Set());
  const [draft, setDraft] = useState(createPurchaseDraft);
  const [order, setOrder] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [restoring, setRestoring] = useState(false);
  useEffect(() => {
    if (services.mode !== 'api') return;
    const match = /^#pedido=([a-f\d-]{36})\.([a-f\d]{64})$/.exec(window.location.hash);
    if (!match) return;
    let active = true;
    setRestoring(true);
    services.orders.getById(match[1]).then(result => { if (active) { completed.current.add(result.id); setOrder(result); } }).catch(() => { if (active) setError('La referencia privada no está disponible. Revisa el enlace de tu compra.'); }).finally(() => { if (active) setRestoring(false); });
    return () => { active = false; };
  }, [services]);
  const lock = useRef(false);
  const requestId = useRef(null);
  const updateDraft = (changes) => setDraft((current) => updatePurchaseDraft(current, changes));
  const resetDraft = () => setDraft(createPurchaseDraft());
  const beginPurchase = async (items) => {
    if (lock.current) return null;
    lock.current = true; setBusy(true); setError(null);
    try {
      if (order) return order;
      requestId.current ??= crypto.randomUUID();
      const created = await services.orders.create({ requestId: requestId.current, draft, items });
      setOrder(created);
      return created;
    } catch (cause) { setError(cause.message); return null; }
    finally { lock.current = false; setBusy(false); }
  };
  const startNewPurchase = () => { setOrder(null); requestId.current = null; setError(null); resetDraft(); if (services.mode === 'api') window.history.replaceState({}, '', window.location.pathname); };
  const completePurchase = (id) => {
    if (completed.current.has(id)) return;
    completed.current.add(id);
    // Conserva productos agregados después de crear este pedido.
    for (const item of order.items) {
      const line = cart.items.find((entry) => entry.slug === item.productSlug && entry.format === item.format);
      if (!line) continue;
      if (line.quantity <= item.quantity) cart.removeItem(line.key);
      else cart.updateQuantity(line.key, line.quantity - item.quantity);
    }
  };
  return <PurchaseContext.Provider value={{ draft, recipient: resolveRecipient(draft), updateDraft, resetDraft, order, busy, restoring, error, beginPurchase, startNewPurchase, completePurchase }}>{children}</PurchaseContext.Provider>;
}

export const usePurchase = () => useModuleContext(PurchaseContext, "Purchase");
