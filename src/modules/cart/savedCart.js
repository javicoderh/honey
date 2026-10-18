export const SAVED_CART_STORAGE_KEY = 'casa-miel.saved-cart.v1';
export function validCartReference(value) {
  return typeof value?.id==='string' && /^[a-f\d]{8}-[a-f\d]{4}-4[a-f\d]{3}-[89ab][a-f\d]{3}-[a-f\d]{12}$/i.test(value.id)
    && typeof value.token==='string' && /^[a-f\d]{64}$/.test(value.token);
}
export function readSavedCart(storage) {
  try { const value=JSON.parse(storage?.getItem(SAVED_CART_STORAGE_KEY)??'null'); return validCartReference(value)?{id:value.id,token:value.token}:null; }
  catch { return null; }
}
export function newCartReference() {
  const bytes=crypto.getRandomValues(new Uint8Array(32));
  return {id:crypto.randomUUID(),token:Array.from(bytes,byte=>byte.toString(16).padStart(2,'0')).join('')};
}
export function parseCartLink(hash) {
  const match=/^#(recuperar|baja)=([a-f\d-]{36})\.([a-f\d]{64})$/.exec(hash??'');
  const reference=match?{id:match[2],token:match[3]}:null;
  return validCartReference(reference)?{action:match[1],reference}:null;
}
