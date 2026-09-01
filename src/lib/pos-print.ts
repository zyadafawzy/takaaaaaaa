/**
 * طباعة الفاتورة من غير ما الكاشير يعمل Ctrl+P.
 * بنسحب محتوى قالب الفاتورة (#pos-print-root) ونحطه في iframe مخفي
 * وندي أمر الطباعة للـ iframe نفسه — كده الشاشة ما تتأثرش والطباعة تلقائية.
 * لو مفيش طابعة، المتصفح هيفتح "حفظ كـ PDF" وهي نفس الخطوة.
 */
export function printReceipt(rootId = "pos-print-root"): boolean {
  if (typeof document === "undefined") return false;
  const source = document.getElementById(rootId);
  if (!source) return false;

  const previous = document.getElementById("pos-print-frame");
  previous?.remove();

  const frame = document.createElement("iframe");
  frame.id = "pos-print-frame";
  frame.setAttribute("aria-hidden", "true");
  frame.style.cssText = "position:fixed;inset-inline-start:-10000px;top:0;width:80mm;height:0;border:0;";
  document.body.appendChild(frame);

  const doc = frame.contentDocument;
  if (!doc) {
    frame.remove();
    return false;
  }

  const styles = Array.from(document.querySelectorAll('link[rel="stylesheet"], style'))
    .map((node) => node.outerHTML)
    .join("");

  doc.open();
  doc.write(
    `<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8" />${styles}` +
      `<style>@page{size:80mm auto;margin:0}body{margin:0;background:#fff;color:#000;font-family:inherit}` +
      `#pos-print-root{position:static!important;width:80mm;max-width:80mm;padding:4mm;background:#fff;color:#000}` +
      `</style></head><body>${source.outerHTML}</body></html>`,
  );
  doc.close();

  const run = () => {
    frame.contentWindow?.focus();
    frame.contentWindow?.print();
    window.setTimeout(() => frame.remove(), 1500);
  };

  if (doc.readyState === "complete") window.setTimeout(run, 150);
  else frame.onload = () => window.setTimeout(run, 150);

  return true;
}

const AUTO_PRINT_KEY = "pos:auto-print";

export function isAutoPrintEnabled(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(AUTO_PRINT_KEY) !== "off";
}

export function setAutoPrintEnabled(enabled: boolean): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(AUTO_PRINT_KEY, enabled ? "on" : "off");
}
