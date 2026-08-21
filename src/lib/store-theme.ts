/** ألوان الهوية لكل سوبرماركت — بتتحول لمتغيّرات CSS فوق نفس تصميم تِكّة. */

export type StoreBranding = {
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  backgroundColor: string;
  surfaceColor: string;
  textColor: string;
  mutedColor: string;
  borderColor: string;
  successColor: string;
  warningColor: string;
  dangerColor: string;
  /** إعدادات الشكل العام — كل متجر يقدر يغيّرها من لوحته. */
  themePreset?: string;
  colorMode?: "light" | "dark" | "system";
  fontFamily?: string;
  radiusStyle?: string;
  density?: string;
  headerStyle?: string;
  productCardStyle?: string;
  heroImageUrl?: string | null;
  heroTitle?: string;
  heroSubtitle?: string;
};

export type StoreColorKey =
  | "primaryColor"
  | "secondaryColor"
  | "accentColor"
  | "backgroundColor"
  | "surfaceColor"
  | "textColor"
  | "mutedColor"
  | "borderColor"
  | "successColor"
  | "warningColor"
  | "dangerColor";

export const FONT_OPTIONS: Array<{ id: string; name: string; stack: string }> = [
  { id: "cairo", name: "القاهرة", stack: '"Cairo", system-ui, sans-serif' },
  { id: "tajawal", name: "تجوال", stack: '"Tajawal", system-ui, sans-serif' },
  { id: "almarai", name: "المرعى", stack: '"Almarai", system-ui, sans-serif' },
  { id: "rubik", name: "روبيك", stack: '"Rubik", system-ui, sans-serif' },
  { id: "kufi", name: "كوفي", stack: '"Noto Kufi Arabic", system-ui, sans-serif' },
  { id: "ibm", name: "بلكس عربي", stack: '"IBM Plex Sans Arabic", system-ui, sans-serif' },
];

export const RADIUS_OPTIONS: Array<{ id: string; name: string; value: string }> = [
  { id: "sharp", name: "حواف حادة", value: "0.25rem" },
  { id: "soft", name: "حواف ناعمة", value: "0.75rem" },
  { id: "round", name: "حواف دائرية", value: "1.25rem" },
  { id: "pill", name: "كبسولة", value: "1.75rem" },
];

export const DENSITY_OPTIONS: Array<{ id: string; name: string; scale: string }> = [
  { id: "compact", name: "مضغوط", scale: "0.92" },
  { id: "comfortable", name: "مريح", scale: "1" },
  { id: "spacious", name: "واسع", scale: "1.08" },
];

export const HEADER_STYLE_OPTIONS: Array<{ id: string; name: string }> = [
  { id: "classic", name: "كلاسيكي" },
  { id: "centered", name: "متوسّط" },
  { id: "bold", name: "لون كامل" },
  { id: "minimal", name: "بسيط" },
];

export const CARD_STYLE_OPTIONS: Array<{ id: string; name: string }> = [
  { id: "standard", name: "قياسي" },
  { id: "elevated", name: "بارز بالظل" },
  { id: "bordered", name: "بإطار" },
  { id: "flat", name: "مسطّح" },
];

export function fontStack(id: string | undefined): string {
  return (FONT_OPTIONS.find((f) => f.id === id) ?? FONT_OPTIONS[0]!).stack;
}


export const defaultBranding: StoreBranding = {
  primaryColor: "#1f6f52",
  secondaryColor: "#f2efe6",
  accentColor: "#e0a83c",
  backgroundColor: "#fbfaf6",
  surfaceColor: "#ffffff",
  textColor: "#1b2420",
  mutedColor: "#6d7a74",
  borderColor: "#e3e2da",
  successColor: "#2f9e5f",
  warningColor: "#d99a2b",
  dangerColor: "#d24b3e",
};

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace("#", "").trim();
  const full =
    clean.length === 3
      ? clean
          .split("")
          .map((c) => c + c)
          .join("")
      : clean;
  const value = Number.parseInt(full.slice(0, 6) || "000000", 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

function hexToRgbString(hex: string): string {
  const [r, g, b] = hexToRgb(hex);
  return `${r}, ${g}, ${b}`;
}

/** لون نص مقروء فوق أي خلفية (أبيض أو أسود حسب السطوع). */
export function readableOn(hex: string): string {
  const [r, g, b] = hexToRgb(hex);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.62 ? "#111827" : "#ffffff";
}

export function mix(hex: string, withHex: string, amount: number): string {
  const a = hexToRgb(hex);
  const b = hexToRgb(withHex);
  const out = a.map((channel, index) =>
    Math.round(channel + (b[index]! - channel) * amount),
  ) as [number, number, number];
  return `#${out.map((c) => c.toString(16).padStart(2, "0")).join("")}`;
}

/** بيبني متغيّرات التصميم المستخدمة في كل واجهة تِكّة. */
export function brandingCssVars(
  branding: StoreBranding,
  modeOverride?: "light" | "dark",
): Record<string, string> {
  const base = { ...defaultBranding, ...branding };
  const mode =
    modeOverride ?? (base.colorMode === "system" ? "light" : base.colorMode ?? "light");
  /** الوضع الليلي: بنقلب الأسطح والنصوص مع الحفاظ على لون الهوية. */
  const b: StoreBranding =
    mode === "dark"
      ? {
          ...base,
          primaryColor: mix(base.primaryColor, "#ffffff", 0.18),
          backgroundColor: "#0d1512",
          surfaceColor: "#151f1b",
          textColor: "#f2f5f3",
          mutedColor: "#9aa8a2",
          borderColor: "#26332e",
          secondaryColor: "#1d2a25",
        }
      : base;
  return {
    "--background": b.backgroundColor,
    "--background-rgb": hexToRgbString(b.backgroundColor),
    "--foreground": b.textColor,
    "--surface": b.surfaceColor,
    "--surface-rgb": hexToRgbString(b.surfaceColor),
    "--surface-foreground": b.textColor,
    "--card": b.surfaceColor,
    "--card-foreground": b.textColor,
    "--popover": b.surfaceColor,
    "--popover-foreground": b.textColor,
    "--primary": b.primaryColor,
    "--primary-foreground": readableOn(b.primaryColor),
    "--primary-soft": mix(b.primaryColor, b.surfaceColor, 0.85),
    "--secondary": b.secondaryColor,
    "--secondary-foreground": readableOn(b.secondaryColor),
    "--muted": mix(b.backgroundColor, b.mutedColor, 0.12),
    "--muted-foreground": b.mutedColor,
    "--accent": b.accentColor,
    "--accent-foreground": readableOn(b.accentColor),
    "--accent-soft": mix(b.accentColor, b.surfaceColor, 0.85),
    "--destructive": b.dangerColor,
    "--destructive-foreground": readableOn(b.dangerColor),
    "--success": b.successColor,
    "--success-foreground": readableOn(b.successColor),
    "--warning": b.warningColor,
    "--warning-foreground": readableOn(b.warningColor),
    "--border": b.borderColor,
    "--input": b.borderColor,
    "--ring": b.primaryColor,
    "--sidebar": b.surfaceColor,
    "--sidebar-foreground": b.textColor,
    "--sidebar-primary": b.primaryColor,
    "--sidebar-primary-foreground": readableOn(b.primaryColor),
    "--sidebar-border": b.borderColor,
    "--radius": (RADIUS_OPTIONS.find((r) => r.id === b.radiusStyle) ?? RADIUS_OPTIONS[1]!).value,
    "--store-density": (DENSITY_OPTIONS.find((d) => d.id === b.density) ?? DENSITY_OPTIONS[1]!).scale,
    "--store-font": fontStack(b.fontFamily),
    "font-family": fontStack(b.fontFamily),
    "color-scheme": mode,
    "--header-glass": mode === "dark" ? "rgba(15, 23, 42, 0.75)" : "rgba(255, 255, 255, 0.75)",
    "--header-blur": "16px",
    "--search-bg": mode === "dark" ? "rgba(30, 41, 59, 0.5)" : "rgba(248, 250, 252, 0.5)",
    "--card-shadow": mode === "dark" ? "0 10px 30px -10px rgba(0,0,0,0.5)" : "0 10px 30px -10px rgba(0,0,0,0.1)",
    "--primary-glow": `0 0 20px rgba(${hexToRgbString(b.primaryColor)}, 0.35)`,
  };
}


export const brandingPresets: Array<{ name: string; branding: StoreBranding }> = [
  { name: "أخضر طبيعي", branding: defaultBranding },
  {
    name: 'أزرق ملكي',
    branding: {
      ...defaultBranding,
      primaryColor: "#1d4ed8",
      accentColor: "#f59e0b",
      backgroundColor: "#f8fafc",
      secondaryColor: "#e8eefc",
      borderColor: "#dbe3f0",
    },
  },
  {
    name: 'أحمر دافئ',
    branding: {
      ...defaultBranding,
      primaryColor: "#b91c1c",
      accentColor: "#f2b544",
      backgroundColor: "#fdf8f6",
      secondaryColor: "#f9e9e6",
      borderColor: "#efdcd8",
    },
  },
  {
    name: 'برتقالي حيوي',
    branding: {
      ...defaultBranding,
      primaryColor: "#ea580c",
      accentColor: "#0d9488",
      backgroundColor: "#fffaf5",
      secondaryColor: "#ffeede",
      borderColor: "#f3ddc8",
    },
  },
  {
    name: 'بنفسجي عصري',
    branding: {
      ...defaultBranding,
      primaryColor: "#6d28d9",
      accentColor: "#f472b6",
      backgroundColor: "#faf8ff",
      secondaryColor: "#ede9fe",
      borderColor: "#e2dcf7",
    },
  },
  {
    name: 'تركواز منعش',
    branding: {
      ...defaultBranding,
      primaryColor: "#0891b2",
      accentColor: "#f59e0b",
      backgroundColor: "#f6fdff",
      secondaryColor: "#dff5fb",
      borderColor: "#cfe9f0",
    },
  },
  {
    name: 'زيتوني ريفي',
    branding: {
      ...defaultBranding,
      primaryColor: "#4d7c0f",
      accentColor: "#ca8a04",
      backgroundColor: "#fbfdf5",
      secondaryColor: "#eef5e0",
      borderColor: "#dfe8cd",
    },
  },
  {
    name: 'وردي أنيق',
    branding: {
      ...defaultBranding,
      primaryColor: "#be185d",
      accentColor: "#0ea5e9",
      backgroundColor: "#fff8fb",
      secondaryColor: "#fce7f1",
      borderColor: "#f4d8e5",
    },
  },
  {
    name: 'بني قهوة',
    branding: {
      ...defaultBranding,
      primaryColor: "#7c4a21",
      accentColor: "#d97706",
      backgroundColor: "#fdfaf6",
      secondaryColor: "#f3e7da",
      borderColor: "#e8d8c7",
    },
  },
  {
    name: 'رمادي احترافي',
    branding: {
      ...defaultBranding,
      primaryColor: "#334155",
      accentColor: "#0ea5e9",
      backgroundColor: "#f8fafc",
      secondaryColor: "#e9eef4",
      borderColor: "#dde3ea",
    },
  },
  {
    name: 'ليلي فاخر',
    branding: {
      ...defaultBranding,
      primaryColor: "#c9a227",
      secondaryColor: "#1c2430",
      accentColor: "#6ee7b7",
      backgroundColor: "#0f141b",
      surfaceColor: "#161d26",
      textColor: "#f5f7fa",
      mutedColor: "#97a3b4",
      borderColor: "#26303c",
      colorMode: "dark",
    },
  },
  {
    name: 'ليلي نيون',
    branding: {
      ...defaultBranding,
      primaryColor: "#22d3ee",
      secondaryColor: "#12203a",
      accentColor: "#f472b6",
      backgroundColor: "#0b1120",
      surfaceColor: "#121a2b",
      textColor: "#eef2ff",
      mutedColor: "#93a3c0",
      borderColor: "#1f2b45",
      colorMode: "dark",
    },
  },
  {
    name: 'ليلي زمردي',
    branding: {
      ...defaultBranding,
      primaryColor: "#34d399",
      secondaryColor: "#10241d",
      accentColor: "#fbbf24",
      backgroundColor: "#08120f",
      surfaceColor: "#0f1d18",
      textColor: "#ecfdf5",
      mutedColor: "#8aa79c",
      borderColor: "#1b2f28",
      colorMode: "dark",
    },
  },
  {
    name: 'ذهبي ملكي',
    branding: {
      ...defaultBranding,
      primaryColor: "#a16207",
      accentColor: "#1f6f52",
      backgroundColor: "#fffdf5",
      secondaryColor: "#fbf1d8",
      borderColor: "#efe2c4",
    },
  },
];
