import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Toasty } from "@cloudflare/kumo";
import { App } from "./App.tsx";
import "./styles.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Toasty>
      <App />
    </Toasty>
  </StrictMode>,
);
