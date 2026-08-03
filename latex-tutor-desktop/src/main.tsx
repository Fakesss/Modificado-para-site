import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./styles.css";

window.addEventListener("error", (e) => {
  console.error("GLOBAL ERROR:", e.error?.stack || e.message);
});
window.addEventListener("unhandledrejection", (e) => {
  console.error("UNHANDLED REJECTION:", (e.reason && e.reason.stack) || e.reason);
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
