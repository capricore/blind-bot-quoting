import { OPACITY_LABELS } from "./catalog-data";
import type { ItemConfig, Product, ProductLine } from "./types";

export function describeConfig(line: ProductLine, product: Product, config: ItemConfig) {
  const color = product.colors.find((c) => c.id === config.colorId);
  const options = line.optionGroups
    .map((g) => g.options.find((o) => o.id === config.options[g.key])?.name)
    .filter((x): x is string => Boolean(x));
  const dims = line.dimensionFields
    .map((f) => `${f.label} ${config.dimensions[f.key]} ${f.unit}`)
    .join(" · ");
  return {
    colorName: color?.name ?? config.colorId,
    color,
    opacityLabel: OPACITY_LABELS[config.opacityId] ?? config.opacityId,
    options,
    dims,
  };
}
