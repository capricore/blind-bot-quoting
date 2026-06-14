import type { ItemConfig } from "./types";

/**
 * Bridge for designs carried in from the upstream visualization tool.
 *
 * Skeleton scope (see docs/superpowers/specs/2026-06-14-result-to-configurator-import-skeleton-design.md):
 * the inbound configuration is shown to the user as a reference only — it is NOT
 * auto-applied to the form yet, because the upstream option vocabulary does not line
 * up with this catalog. `mapImportedConfig` is the seam where that real mapping will
 * live later; today it is intentionally a no-op.
 */

/** Upstream selections, a flat string dictionary (e.g. { color, translucency, ... }). */
export type ImportedConfig = Record<string, string>;

export interface ImportPayload {
  /** Result image URL, shown as a reference. */
  img: string;
  /** Upstream selections, shown as a reference (not auto-applied). */
  cfg: ImportedConfig;
}

function isHttpUrl(s: string): boolean {
  try {
    const u = new URL(s);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * Parse the inbound import params. Returns null when there is nothing usable to import
 * (so the page renders exactly as a normal direct visit). Defensive against arbitrary
 * input: `img` must be an http(s) URL, and only string-valued cfg entries are kept.
 */
export function parseImportPayload(
  img: string | undefined,
  cfg: string | undefined
): ImportPayload | null {
  if (!img || !isHttpUrl(img)) return null;

  const parsed: ImportedConfig = {};
  if (cfg) {
    try {
      const obj = JSON.parse(cfg) as unknown;
      if (obj && typeof obj === "object") {
        for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
          if (typeof v === "string" && v.length > 0) parsed[k] = v;
        }
      }
    } catch {
      // malformed cfg — fall through and show the image with no reference list
    }
  }
  return { img, cfg: parsed };
}

/**
 * Seam for the future variation mapping. Given the upstream selections, return the
 * subset of this product's config to pre-select. Intentionally a no-op for now — the
 * upstream vocabulary (translucency, lighting, valance, texture, hemStyle, …) does not
 * map cleanly onto this catalog's colors/opacity/options yet. When real mapping lands,
 * return { colorId, opacityId, options, dimensions } here and the configurator will
 * initialize from it automatically.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- `cfg` is unused only while this is a no-op seam; it's the interface real mapping will consume.
export function mapImportedConfig(cfg: ImportedConfig): Partial<ItemConfig> {
  return {};
}
