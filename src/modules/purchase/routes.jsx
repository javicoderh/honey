import CartPage from "../cart/CartPage";
import CheckoutPage, { PurchaseResultPage } from "./CheckoutPage";

export function resolvePurchaseRoute(pathname) {
  if (pathname === "/carrito") return <CartPage />;
  if (pathname === "/checkout") return <CheckoutPage />;
  if (pathname === "/checkout/resultado") return <PurchaseResultPage />;
  return null;
}
