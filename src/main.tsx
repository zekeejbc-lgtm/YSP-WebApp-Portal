
import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import App from "./App.tsx";
import "./index.css";

createRoot(document.getElementById("root")!).render(<App />);

const updateSW = registerSW({
  immediate: true,
  onNeedRefresh() {
    const shouldUpdate = window.confirm(
      "An update is available (includes the new app icon). Update now?"
    );
    if (shouldUpdate) {
      updateSW(true);
      window.alert(
        "Update started. When it finishes, close and reopen the app to refresh the icon."
      );
    }
  },
});
  
