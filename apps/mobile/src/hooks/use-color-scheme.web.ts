import { useSyncExternalStore } from "react";

type WebColorScheme = "light" | "dark";

const mediaQuery = "(prefers-color-scheme: dark)";

function getServerSnapshot(): WebColorScheme {
  return "light";
}

function getSnapshot(): WebColorScheme {
  if (
    typeof window === "undefined" ||
    typeof window.matchMedia !== "function"
  ) {
    return "light";
  }

  return window.matchMedia(mediaQuery).matches ? "dark" : "light";
}

function subscribe(onStoreChange: () => void): () => void {
  if (
    typeof window === "undefined" ||
    typeof window.matchMedia !== "function"
  ) {
    return () => {};
  }

  const mediaQueryList = window.matchMedia(mediaQuery);

  const handleChange = () => {
    onStoreChange();
  };

  mediaQueryList.addEventListener("change", handleChange);

  return () => {
    mediaQueryList.removeEventListener("change", handleChange);
  };
}

/**
 * Web implementation.
 *
 * Learning:
 * useSyncExternalStore gives React an explicit
 * client snapshot and a server snapshot.
 *
 * This avoids keeping a separate "hasHydrated"
 * state just to re-render after hydration.
 */
export function useColorScheme(): WebColorScheme {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
