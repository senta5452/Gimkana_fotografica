import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";

// Estils, en aquest ordre (els posteriors poden ajustar els anteriors).
import "./styles/base.css";
import "./styles/game-panel.css";
import "./styles/team.css";
import "./styles/home.css";
import "./styles/results.css";
import "./styles/forms.css";
import "./styles/messages.css";

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
