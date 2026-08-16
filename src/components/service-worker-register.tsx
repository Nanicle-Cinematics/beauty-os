"use client";

import { useEffect } from "react";

export function ServiceWorkerRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator) || process.env.NODE_ENV !== "production") {
      return;
    }

    let idleId: number | null = null;
    const register = () => {
      const run = () => {
        navigator.serviceWorker.register("/sw.js").catch(() => {
          // Installation support is progressive enhancement; the app remains usable.
        });
      };

      if ("requestIdleCallback" in window) {
        idleId = window.requestIdleCallback(run, { timeout: 3000 });
      } else {
        globalThis.setTimeout(run, 1200);
      }
    };

    if (document.readyState === "complete") {
      register();
      return () => {
        if (idleId != null && "cancelIdleCallback" in window) window.cancelIdleCallback(idleId);
      };
    }

    window.addEventListener("load", register, { once: true });
    return () => {
      window.removeEventListener("load", register);
      if (idleId != null && "cancelIdleCallback" in window) window.cancelIdleCallback(idleId);
    };
  }, []);

  return null;
}
