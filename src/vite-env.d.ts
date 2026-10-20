/// <reference types="vite/client" />

/**
 * Injected at build time from the VERSION file (see vite.config.ts).
 * Lets the UI show the release version without hardcoding it in components.
 */
declare const __APP_VERSION__: string;
