import assert from "node:assert/strict";
import test from "node:test";
import { isValidEmail, isValidPhone } from "../src/shared/validation.js";
import { validateCheckout } from "../src/modules/purchase/checkout.js";
import { createPurchaseDraft, purchaseSnapshot } from "../src/modules/purchase/model.js";
import { validateTeamDraft } from "../src/modules/staff/model.js";

const draft = () => ({ ...createPurchaseDraft(), buyer: { name: "María-José O'Ryan", email: "maria+pedido@example.cl", phone: "+56 (9) 1234-5678" }, shippingAddress: { street: "Camino rural s/n", commune: "Pucón" } });

test("correo permite alias y subdominios, rechaza puntos y dominios mal formados", () => {
  for (const email of [" maria+pedido@example.cl ", "a.b@sub.example.com", "CLIENTE@EXAMPLE.CL", "a@xn--dominio-e3a.cl"]) assert.equal(isValidEmail(email), true, email);
  for (const email of ["", " ", "a@@example.cl", "a..b@example.cl", ".a@example.cl", "a.@example.cl", "a@-example.cl", "a@example-.cl", "a@example..cl", "a@example", "a b@example.cl", "a@example.c", "a@exa_mple.cl", "a<@example.cl", `${'a'.repeat(65)}@example.cl`, null, 123]) assert.equal(isValidEmail(email), false, String(email));
});

test("teléfono cuenta dígitos y admite formato internacional sin aceptar solo signos", () => {
  for (const phone of ["12345678", "+56912345678", " +56 (9) 1234-5678 ", "(02) 2345 6789", "+123456789012345"]) assert.equal(isValidPhone(phone), true, phone);
  for (const phone of ["", "        ", "--------", "((((((((", "1234567", "+1234567890123456", "1234+5678", "12abc345678", "(912345678", "912345678)", "9\n12345678", null, 912345678]) assert.equal(isValidPhone(phone), false, String(phone));
});

test("checkout exige solo datos principales, permite opcionales vacíos y nombres con acentos", () => {
  const data = draft();
  assert.deepEqual(validateCheckout(data), {});
  const snapshot = purchaseSnapshot(data);
  assert.equal(snapshot.shippingAddress.apartment, "");
  assert.equal(snapshot.shippingAddress.reference, "");
  assert.equal(snapshot.deliveryInstructions, "");
  for (const [group, key] of [["buyer", "name"], ["buyer", "email"], ["buyer", "phone"], ["shippingAddress", "street"], ["shippingAddress", "commune"]]) {
    const invalid = draft(); invalid[group][key] = "   ";
    assert.equal(validateCheckout(invalid)[`${group}.${key}`], "Completa este campo.");
  }
  assert.doesNotThrow(() => validateCheckout(null));
  assert.doesNotThrow(() => validateCheckout({ buyer: { phone: 123 } }));
});

test("destinatario alternativo es obligatorio solo al desmarcar que recibe el comprador", () => {
  const data = draft();
  data.recipient = { name: "", phone: "--------" };
  assert.deepEqual(validateCheckout(data), {});
  data.recipientSameAsBuyer = false;
  assert.ok(validateCheckout(data)["recipient.name"]);
  assert.ok(validateCheckout(data)["recipient.phone"]);
  data.recipient = { name: "Ana", phone: "+56911111111" };
  assert.deepEqual(validateCheckout(data), {});
});

test("dominio vuelve a validar correo y teléfonos aunque se omita el formulario", () => {
  for (const email of ["a..b@example.cl", "a@example-.cl"]) {
    const data = draft(); data.buyer.email = email;
    assert.throws(() => purchaseSnapshot(data), /Correo inválido/);
    assert.ok(validateTeamDraft({ name: "Ana", email, role: "admin" }).email);
  }
  const data = draft(); data.buyer.phone = "--------";
  assert.throws(() => purchaseSnapshot(data), /Teléfono del comprador inválido/);
  data.buyer.phone = "+56911111111"; data.recipientSameAsBuyer = false;
  data.recipient = { name: "Ana", phone: "(12345678" };
  assert.throws(() => purchaseSnapshot(data), /Teléfono del destinatario inválido/);
  assert.equal(Object.keys(validateTeamDraft(null)).length, 3);
});
