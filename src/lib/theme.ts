export type Theme = "dark" | "light";

export const THEME_STORAGE_KEY = "theme";

/** Runs in <head> before first paint so a saved light-mode choice doesn't flash dark. */
export const themeInitScript = `try{var t=localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}`;
