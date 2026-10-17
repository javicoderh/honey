import { useEffect, useId, useState } from "react";
import { MAX_CART_QUANTITY } from "../modules/cart/model.js";

export default function QuantityControl({ quantity, onChange, label = "Cantidad", max = MAX_CART_QUANTITY }) {
  const id = useId();
  const [draft, setDraft] = useState(String(quantity));
  useEffect(() => setDraft(String(quantity)), [quantity]);
  return <div className="quantity-control"><label htmlFor={id}>{label}</label><div>
    <button type="button" aria-label={`Disminuir ${label.toLowerCase()}`} disabled={quantity <= 1} onClick={() => { setDraft(String(quantity - 1)); onChange(quantity - 1); }}>−</button>
    <input id={id} type="number" inputMode="numeric" min="1" max={max} step="1" value={draft}
      onChange={(event) => { setDraft(event.target.value); const value = Number(event.target.value); if (Number.isInteger(value) && value >= 1 && value <= max) onChange(value); }}
      onBlur={() => setDraft(String(quantity))} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); event.currentTarget.blur(); } }} />
    <button type="button" aria-label={`Aumentar ${label.toLowerCase()}`} disabled={quantity >= max} onClick={() => { setDraft(String(quantity + 1)); onChange(quantity + 1); }}>+</button>
  </div></div>;
}
