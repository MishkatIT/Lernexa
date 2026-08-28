export const THEME_STORAGE_KEY = "lernexa-theme";

export type ThemeChoice = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

/**
 * Runs before first paint (injected at the top of <body>) so a returning
 * dark-mode visitor never sees a light flash. Mirrors the resolution logic in
 * ThemeProvider.
 */
export const NO_FLASH_SCRIPT = `(function(){try{
var k=${JSON.stringify(THEME_STORAGE_KEY)};
var c=localStorage.getItem(k)||'system';
var dark=c==='dark'||(c==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches);
var r=document.documentElement;
r.setAttribute('data-theme',dark?'dark':'light');
r.style.colorScheme=dark?'dark':'light';
}catch(e){}})();`;
