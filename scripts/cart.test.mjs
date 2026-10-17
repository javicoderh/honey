import test from "node:test";
import assert from "node:assert/strict";
import { cartItemKey, cartReducer, resolveCart } from "../src/modules/cart/model.js";
import { CART_STORAGE_KEY, readCart, writeCart } from "../src/modules/cart/storage.js";

const item = { slug: "miel", format: "1 kg", quantity: 2 };
const catalog = [{ slug: "miel", name: "Miel", sizes: [{ label: "1 kg", price: 6990 }] }];
const initial = { lines: [], notice: null };

test("agregar acumula cantidades y permite modificar, quitar y vaciar", () => {
  let state = cartReducer(initial, { type: "add", item });
  state = cartReducer(state, { type: "add", item });
  assert.equal(state.lines[0].quantity, 4);
  assert.equal(resolveCart(state.lines, catalog).subtotal, 27960);
  state = cartReducer(state, { type: "quantity", key: cartItemKey(item), quantity: 3 });
  assert.equal(resolveCart(state.lines, catalog).itemCount, 3);
  assert.deepEqual(cartReducer(state, { type: "remove", key: cartItemKey(item) }).lines, []);
  assert.deepEqual(cartReducer(state, { type: "clear" }).lines, []);
});

test("cantidades inválidas y acumulación sobre el límite no modifican el carrito", () => {
  const state = cartReducer(initial, { type: "add", item });
  for (const quantity of [0, -1, 1.5, 100, NaN]) {
    const result = cartReducer(state, { type: "quantity", key: cartItemKey(item), quantity });
    assert.deepEqual(result.lines, state.lines);
    assert.equal(result.notice.kind, "error");
  }
  assert.deepEqual(cartReducer(state, { type: "add", item: { ...item, quantity: 99 } }).lines, state.lines);
});

test("persistencia recupera la selección y usa precios actuales del catálogo", () => {
  const values = new Map();
  const storage = { getItem: (key) => values.get(key), setItem: (key, value) => values.set(key, value) };
  assert.equal(writeCart(storage, [item]), null);
  const restored = readCart(storage);
  assert.deepEqual(restored.lines, [item]);
  assert.equal(resolveCart(restored.lines, catalog).subtotal, 13980);
  assert.equal(resolveCart(restored.lines, [{ ...catalog[0], sizes: [{ label: "1 kg", price: 9000 }] }]).subtotal, 18000);
  assert.equal(JSON.parse(values.get(CART_STORAGE_KEY)).lines[0].price, undefined);
  values.set(CART_STORAGE_KEY, "{invalid");
  assert.deepEqual(readCart(storage).lines, []);
  assert.ok(readCart(storage).loadError);
  assert.ok(writeCart({ setItem() { throw new Error("Sin espacio"); } }, [item]));
});

test("productos retirados bloquean checkout hasta quitarlos; vacío no permite comprar", () => {
  assert.equal(resolveCart([item], catalog).canCheckout, true);
  assert.equal(resolveCart([item], []).canCheckout, false);
  assert.equal(resolveCart([item], [{ ...catalog[0], sizes: [] }]).canCheckout, false);
  assert.equal(resolveCart([], catalog).canCheckout, false);
});
