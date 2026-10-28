"use client";

import { useState, useSyncExternalStore } from "react";
import styles from "./CookieNotice.module.css";

const COOKIE = "ca.cookie-ok";
const ONE_YEAR = 60 * 60 * 24 * 365;

function subscribe() {
  return () => {};
}

function acceptedOnClient() {
  return document.cookie.split("; ").some((part) => part.startsWith(`${COOKIE}=`));
}

export function CookieNotice() {
  // Server and hydration render nothing. The client snapshot then shows the bar if the cookie is absent.
  const accepted = useSyncExternalStore(subscribe, acceptedOnClient, () => true);
  const [dismissed, setDismissed] = useState(false);
  if (accepted || dismissed) return null;

  return (
    <div className={styles.bar} role="region" aria-label="Cookies">
      <p>We use cookies to keep you signed in, remember your cart, and save settings like light or dark mode.</p>
      <button
        type="button"
        className="btn"
        onClick={() => {
          document.cookie = `${COOKIE}=accepted; Max-Age=${ONE_YEAR}; Path=/; SameSite=Lax`;
          setDismissed(true);
        }}
      >
        Accept
      </button>
    </div>
  );
}
