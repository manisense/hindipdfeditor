/**
 * Feature switch for the web-only Plan B trial (shaping edited/added Devanagari with HarfBuzz WASM
 * and embedding CID/Identity-H font subsets with ToUnicode and /ActualText instead of raster PNGs).
 *
 * Off by default. Opt in via `?planB=1` on the editor URL or `localStorage['hpe.export.vectorText'] = 'on'`.
 * An explicit `?planB=0` overrides localStorage and forces the Plan A image path.
 */

export const VECTOR_TEXT_STORAGE_KEY = 'hpe.export.vectorText';

const TRUTHY = new Set(['1', 'true', 'on']);
const FALSY = new Set(['0', 'false', 'off']);

export function isVectorTextEnabled(
  search?: string,
  storage?: Pick<Storage, 'getItem'> | null,
): boolean {
  const query = search ?? (typeof window !== 'undefined' ? window.location.search : '');
  const param = new URLSearchParams(query).get('planB')?.trim().toLowerCase();
  if (param !== undefined && param.length > 0) {
    if (TRUTHY.has(param)) return true;
    if (FALSY.has(param)) return false;
  }
  try {
    const store = storage === undefined ? (typeof window !== 'undefined' ? window.localStorage : null) : storage;
    return store?.getItem(VECTOR_TEXT_STORAGE_KEY) === 'on';
  } catch {
    return false;
  }
}
