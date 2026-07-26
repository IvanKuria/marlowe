/// <reference types="vite/client" />

/**
 * Vite's asset `?inline` query forces a base64 data: URI regardless of
 * `assetsInlineLimit`. vite/client only declares the bare `*.png` form.
 */
declare module '*.png?inline' {
  const src: string;
  export default src;
}

declare module '*.webp?inline' {
  const src: string;
  export default src;
}
