/**
 * Injected by `build/data-assets.ts` via Vite's `define`.
 *
 * `__LOL_DATA_URL__` is the content-addressed URL of the data snapshot
 * (`/data/lol.<hash>.json`, with `wiki` stripped) and `__LOL_WIKI_BASE__` is the
 * directory holding one wiki file per champion (`/data/wiki/<hash>`). Both carry
 * the same dataset hash, which is what lets `_headers` cache them immutably.
 */
declare const __LOL_DATA_URL__: string;
declare const __LOL_WIKI_BASE__: string;

/**
 * Injected by Vite's `define` in `vite.config.ts` from `package.json`. Kept as a
 * constant so the page does not have to import the manifest (see app/page.tsx).
 */
declare const __APP_VERSION__: string;
