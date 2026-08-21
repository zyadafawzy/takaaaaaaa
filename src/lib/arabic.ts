/** تطبيع النص العربي للبحث: همزات، تاء مربوطة، ألف مقصورة، تشكيل، أرقام عربية. */

const ARABIC_DIACRITICS = /[\u064B-\u0652\u0640]/g;
const ARABIC_INDIC = "٠١٢٣٤٥٦٧٨٩";
const EASTERN_INDIC = "۰۱۲۳۴۵۶۷۸۹";

export function normalizeArabic(input: string): string {
  if (!input) return "";
  let text = input.trim().toLowerCase();

  text = text.replace(ARABIC_DIACRITICS, "");
  text = text.replace(/[أإآٱ]/g, "ا");
  text = text.replace(/ى/g, "ي");
  text = text.replace(/ؤ/g, "و");
  text = text.replace(/ئ/g, "ي");
  text = text.replace(/ة/g, "ه");
  text = text.replace(/گ/g, "ك");

  text = text.replace(/[٠-٩]/g, (d) => String(ARABIC_INDIC.indexOf(d)));
  text = text.replace(/[۰-۹]/g, (d) => String(EASTERN_INDIC.indexOf(d)));

  text = text.replace(/\s+/g, " ");
  return text;
}

export function matchesQuery(haystacks: Array<string | undefined | null>, query: string): boolean {
  const q = normalizeArabic(query);
  if (!q) return true;
  const tokens = q.split(" ").filter(Boolean);
  const hay = haystacks.filter(Boolean).map((h) => normalizeArabic(String(h))).join(" ");
  return tokens.every((token) => hay.includes(token));
}
