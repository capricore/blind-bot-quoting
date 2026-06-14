import type {
  DraperyPricingConfig,
  Product,
  ProductLine,
  RollerPricingConfig,
} from "./types";

export const OPACITY_LABELS: Record<string, string> = {
  sheer: "Sheer / Screen",
  "light-filtering": "Light Filtering",
  "room-darkening": "Room Darkening",
  blackout: "Blackout",
};

export const TIER_LABELS: Record<string, string> = {
  standard: "Standard",
  premium: "Premium",
  designer: "Designer",
};

export const PRODUCT_LINES: ProductLine[] = [
  {
    id: "roller-shade",
    name: "Roller Shade",
    tagline: "Clean, minimal light control",
    description:
      "Factory-direct custom roller shades with cassette or open-roll headrails, chain or motorized control.",
    leadTimeDays: 18,
    dimensionFields: [
      {
        key: "width",
        label: "Width",
        unit: "cm",
        min: 30,
        max: 300,
        step: 0.5,
        help: "Finished width including brackets",
      },
      {
        key: "height",
        label: "Height (drop)",
        unit: "cm",
        min: 40,
        max: 350,
        step: 0.5,
        help: "Top of headrail to bottom bar, fully lowered",
      },
    ],
    optionGroups: [
      {
        key: "mount",
        label: "Mount",
        options: [
          { id: "inside", name: "Inside mount", hint: "Fits within the window recess" },
          { id: "outside", name: "Outside mount", hint: "Overlaps the window frame" },
        ],
      },
      {
        key: "headrail",
        label: "Headrail",
        options: [
          { id: "open-roll", name: "Open roll" },
          { id: "cassette", name: "Cassette", hint: "Fabric-wrapped enclosure" },
        ],
      },
      {
        key: "control",
        label: "Control",
        options: [
          { id: "chain-plastic", name: "Chain · plastic" },
          { id: "chain-metal", name: "Chain · stainless" },
          { id: "motorized", name: "Motorized", hint: "Rechargeable, remote included" },
        ],
      },
    ],
  },
  {
    id: "drapery",
    name: "Drapery",
    tagline: "Tailored softness, made to measure",
    description:
      "Custom-sewn drapery panels cut from full-width bolts, with pinch pleat, ripple fold or grommet headers.",
    leadTimeDays: 22,
    dimensionFields: [
      {
        key: "rodWidth",
        label: "Rod / track width",
        unit: "cm",
        min: 60,
        max: 600,
        step: 0.5,
        help: "End to end, excluding finials",
      },
      {
        key: "height",
        label: "Finished height",
        unit: "cm",
        min: 80,
        max: 400,
        step: 0.5,
        help: "Top of header to hem",
      },
    ],
    optionGroups: [
      {
        key: "panels",
        label: "Panel configuration",
        options: [
          { id: "pair", name: "Pair", hint: "Splits at center" },
          { id: "single", name: "Single panel" },
        ],
      },
      {
        key: "fullness",
        label: "Fullness",
        options: [
          { id: "2.0", name: "2.0× · Standard" },
          { id: "2.5", name: "2.5× · Deluxe" },
          { id: "3.0", name: "3.0× · Luxury" },
        ],
      },
      {
        key: "header",
        label: "Header style",
        options: [
          { id: "pinch-pleat", name: "Pinch pleat" },
          { id: "ripple-fold", name: "Ripple fold" },
          { id: "grommet", name: "Grommet" },
        ],
      },
      {
        key: "lining",
        label: "Lining",
        options: [
          { id: "none", name: "Unlined" },
          { id: "standard", name: "Standard lining" },
          { id: "blackout", name: "Blackout lining" },
        ],
      },
      {
        key: "control",
        label: "Operation",
        options: [
          { id: "hand-drawn", name: "Hand drawn" },
          { id: "cord-drawn", name: "Cord drawn" },
          { id: "motorized-track", name: "Motorized track", hint: "Quiet DC motor, app + remote" },
        ],
      },
    ],
  },
];

export const PRODUCTS: Product[] = [
  // ---------- Roller Shades ----------
  {
    id: "rs-aria",
    lineId: "roller-shade",
    sku: "RS-AR-100",
    name: "Aria Solid",
    description: "Smooth matte solid — the workhorse of every project spec.",
    tier: "standard",
    patternStyle: "solid",
    colors: [
      { id: "chalk", name: "Chalk", hex: "#F1EEE8" },
      { id: "dove", name: "Dove", hex: "#C9C7C2" },
      { id: "storm", name: "Storm", hex: "#8B8E94" },
      { id: "ink", name: "Ink", hex: "#3A3D44" },
      { id: "sage", name: "Sage", hex: "#A8B3A0" },
    ],
    validOpacities: ["light-filtering", "room-darkening", "blackout"],
    featured: true,
  },
  {
    id: "rs-linum",
    lineId: "roller-shade",
    sku: "RS-LN-220",
    name: "Linum Texture",
    description: "Woven linen-look face with a soft, organic slub.",
    tier: "premium",
    patternStyle: "linen",
    colors: [
      { id: "natural", name: "Natural", hex: "#D8CDB9", accentHex: "#C5B79E" },
      { id: "oat", name: "Oat", hex: "#E5DCC8", accentHex: "#D6CAAE" },
      { id: "flax", name: "Flax", hex: "#C9B795", accentHex: "#B5A37F" },
      { id: "slate", name: "Slate", hex: "#9AA0A8", accentHex: "#868D96" },
    ],
    validOpacities: ["sheer", "light-filtering", "room-darkening"],
    featured: true,
  },
  {
    id: "rs-coastal",
    lineId: "roller-shade",
    sku: "RS-CS-310",
    name: "Coastal Stripe",
    description: "Wide woven stripe with a relaxed, beach-house feel.",
    tier: "premium",
    patternStyle: "stripe",
    colors: [
      { id: "sand", name: "Sand", hex: "#E8DFCB", accentHex: "#C8B68E" },
      { id: "harbor", name: "Harbor", hex: "#DCE2E5", accentHex: "#7E97A6" },
      { id: "olive", name: "Olive", hex: "#E0DECF", accentHex: "#9AA178" },
    ],
    validOpacities: ["light-filtering", "room-darkening"],
  },
  {
    id: "rs-solar",
    lineId: "roller-shade",
    sku: "RS-SC-030",
    name: "Solar Screen 3%",
    description: "3% openness screen — glare control with a view through.",
    tier: "standard",
    patternStyle: "screen",
    colors: [
      { id: "white", name: "White", hex: "#F4F4F2" },
      { id: "greige", name: "Greige", hex: "#C9C2B6" },
      { id: "charcoal", name: "Charcoal", hex: "#55585C" },
      { id: "bronze", name: "Bronze", hex: "#7A6A55" },
    ],
    validOpacities: ["sheer"],
  },
  {
    id: "rs-midnight",
    lineId: "roller-shade",
    sku: "RS-MD-440",
    name: "Midnight Dimout",
    description: "Coated triple-weave engineered for total darkness.",
    tier: "standard",
    patternStyle: "solid",
    colors: [
      { id: "pearl", name: "Pearl", hex: "#E9E6E0" },
      { id: "graphite", name: "Graphite", hex: "#4A4D52" },
      { id: "mocha", name: "Mocha", hex: "#6E5C4F" },
    ],
    validOpacities: ["blackout"],
  },
  {
    id: "rs-botanica",
    lineId: "roller-shade",
    sku: "RS-BT-510",
    name: "Botanica",
    description: "Designer botanical print on a fine basket weave.",
    tier: "designer",
    patternStyle: "botanical",
    colors: [
      { id: "ivory", name: "Ivory", hex: "#F0EBDF", accentHex: "#A3B18A" },
      { id: "mist", name: "Mist", hex: "#DFE5E3", accentHex: "#7C9885" },
    ],
    validOpacities: ["light-filtering", "room-darkening"],
    featured: true,
  },

  // ---------- Drapery ----------
  {
    id: "dp-velluto",
    lineId: "drapery",
    sku: "DP-VL-700",
    name: "Velluto Velvet",
    description: "Deep-pile cotton velvet with a rich directional sheen.",
    tier: "designer",
    patternStyle: "velvet",
    colors: [
      { id: "emerald", name: "Emerald", hex: "#2F5D50" },
      { id: "navy", name: "Navy", hex: "#2C3A55" },
      { id: "rust", name: "Rust", hex: "#A85B3C" },
      { id: "charcoal", name: "Charcoal", hex: "#46484D" },
    ],
    validOpacities: ["room-darkening", "blackout"],
    featured: true,
  },
  {
    id: "dp-brera",
    lineId: "drapery",
    sku: "DP-BR-410",
    name: "Brera Linen Blend",
    description: "Airy linen-cotton blend that breaks beautifully.",
    tier: "premium",
    patternStyle: "linen",
    colors: [
      { id: "white", name: "White", hex: "#F4F1EA", accentHex: "#E6E1D5" },
      { id: "natural", name: "Natural", hex: "#DDD2BC", accentHex: "#CCBFA4" },
      { id: "sage", name: "Sage", hex: "#B6BFAC", accentHex: "#A3AD97" },
      { id: "stone", name: "Stone", hex: "#B9B2A6", accentHex: "#A79F91" },
    ],
    validOpacities: ["light-filtering", "room-darkening"],
    featured: true,
  },
  {
    id: "dp-voile",
    lineId: "drapery",
    sku: "DP-VA-110",
    name: "Voile Aria",
    description: "Featherweight sheer voile for soft, diffused daylight.",
    tier: "standard",
    patternStyle: "voile",
    colors: [
      { id: "white", name: "White", hex: "#FAFAF8" },
      { id: "ivory", name: "Ivory", hex: "#F4EFE3" },
      { id: "smoke", name: "Smoke", hex: "#D4D6D9" },
    ],
    validOpacities: ["sheer"],
  },
  {
    id: "dp-hudson",
    lineId: "drapery",
    sku: "DP-HW-320",
    name: "Hudson Weave",
    description: "Tight basket weave with a tailored, contract-grade hand.",
    tier: "standard",
    patternStyle: "weave",
    colors: [
      { id: "oat", name: "Oat", hex: "#DCD3C2", accentHex: "#CBC0AB" },
      { id: "pewter", name: "Pewter", hex: "#9A9CA1", accentHex: "#88898E" },
      { id: "denim", name: "Denim", hex: "#67788C", accentHex: "#56677B" },
    ],
    validOpacities: ["light-filtering", "room-darkening"],
  },
  {
    id: "dp-kyoto",
    lineId: "drapery",
    sku: "DP-KG-810",
    name: "Kyoto Geo",
    description: "Jacquard-woven geometric inspired by katazome studies.",
    tier: "designer",
    patternStyle: "geo",
    colors: [
      { id: "ecru", name: "Ecru", hex: "#EAE3D2", accentHex: "#B9AD90" },
      { id: "indigo", name: "Indigo", hex: "#3C4A66", accentHex: "#5D6C8A" },
    ],
    validOpacities: ["light-filtering", "room-darkening"],
  },
  {
    id: "dp-eclipse",
    lineId: "drapery",
    sku: "DP-EC-900",
    name: "Eclipse Suite",
    description: "Hotel-grade three-pass blackout, drapes like a heavyweight.",
    tier: "premium",
    patternStyle: "solid",
    colors: [
      { id: "ivory", name: "Ivory", hex: "#EFEAE0" },
      { id: "flint", name: "Flint", hex: "#797C82" },
      { id: "espresso", name: "Espresso", hex: "#4E4138" },
    ],
    validOpacities: ["blackout"],
  },
];

export const ROLLER_PRICING_V1: RollerPricingConfig = {
  kind: "roller-grid",
  currency: "USD",
  gridWidths: [60, 100, 140, 180, 220, 260, 300],
  gridHeights: [100, 160, 220, 280, 350],
  prices: [
    [39, 46, 54, 63, 74],
    [52, 61, 72, 85, 99],
    [66, 78, 92, 108, 126],
    [81, 96, 113, 132, 154],
    [97, 115, 135, 158, 184],
    [114, 135, 159, 186, 216],
    [132, 156, 184, 215, 250],
  ],
  tierMultiplier: { standard: 1.0, premium: 1.28, designer: 1.55 },
  opacityMultiplier: {
    sheer: 0.95,
    "light-filtering": 1.0,
    "room-darkening": 1.12,
    blackout: 1.28,
  },
  optionSurcharges: {
    control: { "chain-plastic": 0, "chain-metal": 8, motorized: 90 },
    headrail: { "open-roll": 0, cassette: 32 },
    mount: { inside: 0, outside: 0 },
  },
  minCharge: 49,
};

/**
 * 2026.2 — Q2 freight adjustment: motorized +$5 (90→95), blackout multiplier 1.28→1.30.
 * The active version. Quotes priced before this took effect stay pinned to 2026.1,
 * so the version lock is observable: re-pricing an old config yields a different total.
 */
export const ROLLER_PRICING_V2: RollerPricingConfig = {
  ...ROLLER_PRICING_V1,
  opacityMultiplier: { ...ROLLER_PRICING_V1.opacityMultiplier, blackout: 1.3 },
  optionSurcharges: {
    ...ROLLER_PRICING_V1.optionSurcharges,
    control: { ...ROLLER_PRICING_V1.optionSurcharges.control, motorized: 95 },
  },
};

export const DRAPERY_PRICING_V1: DraperyPricingConfig = {
  kind: "drapery-formula",
  currency: "USD",
  fabricBoltWidthCm: 140,
  headerAllowanceCm: 25,
  hemAllowanceCm: 15,
  fabricPricePerMeter: { standard: 14, premium: 22, designer: 34 },
  opacitySurchargePerMeter: {
    sheer: 0,
    "light-filtering": 0,
    "room-darkening": 2.5,
    blackout: 4,
  },
  makingPerWidth: { "pinch-pleat": 28, "ripple-fold": 34, grommet: 22 },
  liningPerMeter: { none: 0, standard: 6, blackout: 9.5 },
  controlFlat: { "hand-drawn": 0, "cord-drawn": 18, "motorized-track": 240 },
  fullnessFactor: { "2.0": 2.0, "2.5": 2.5, "3.0": 3.0 },
  minCharge: 89,
};
