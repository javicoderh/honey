import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles.css";

const catalogElement = document.getElementById('initial-catalog');
const initialProducts = catalogElement ? JSON.parse(catalogElement.textContent) : undefined;
catalogElement?.remove();

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App initialProducts={initialProducts} />
  </StrictMode>,
);
