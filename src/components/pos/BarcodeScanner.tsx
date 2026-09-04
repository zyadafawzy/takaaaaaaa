import { useEffect, useRef, useState } from "react";
import { ScanLine, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Props = {
  onScan: (barcode: string) => void;
  onSearch: (query: string) => void;
  disabled?: boolean;
  busy?: boolean;
};

/**
 * حقل الباركود: يقرأ من قارئ الباركود (اللي بيبعت Enter) أو بالكتابة اليدوية.
 * ماسك الفوكس دائمًا لأن الكاشير مش بيستخدم الماوس.
 */
export function BarcodeScanner({ onScan, onSearch, disabled, busy }: Props) {
  const [value, setValue] = useState("");
  const [capturing, setCapturing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!disabled) inputRef.current?.focus();
  }, [disabled, busy]);

  /**
   * التقاط عام: أي رقم أو حرف يتكتب في أي مكان في الشاشة (والكاشير مش واقف
   * جوه الخانة) بيتحوّل تلقائيًا للخانة. كده قارئ الباركود بيشتغل حتى لو
   * الفوكس ضاع بعد ضغطة زر أو غلق نافذة.
   */
  useEffect(() => {
    if (disabled) return;

    const isTypingElsewhere = (target: EventTarget | null) => {
      const el = target as HTMLElement | null;
      if (!el) return false;
      if (el === inputRef.current) return true;
      const tag = el.tagName;
      return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el.isContentEditable;
    };

    const onKey = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      if (isTypingElsewhere(event.target)) return;

      const input = inputRef.current;
      if (!input) return;

      if (event.key === "Enter") {
        if (!value.trim()) return;
        event.preventDefault();
        submit(/^[0-9]{4,}$/.test(value.trim()) ? "scan" : "search");
        return;
      }

      if (event.key === "Backspace") {
        event.preventDefault();
        setValue((current) => current.slice(0, -1));
        input.focus();
        return;
      }

      if (event.key.length !== 1) return;
      event.preventDefault();
      setValue((current) => current + event.key);
      setCapturing(true);
      input.focus();
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [disabled, value]);

  useEffect(() => {
    if (!capturing) return;
    const timer = window.setTimeout(() => setCapturing(false), 1200);
    return () => window.clearTimeout(timer);
  }, [capturing, value]);

  const submit = (mode: "scan" | "search") => {
    const trimmed = value.trim();
    if (!trimmed) return;
    if (mode === "scan") onScan(trimmed);
    else onSearch(trimmed);
    setValue("");
    inputRef.current?.focus();
  };

  return (
    <div className="flex items-center gap-2">
      <div className="relative flex-1">
        <ScanLine
          className={`pointer-events-none absolute end-3 top-1/2 size-5 -translate-y-1/2 transition-colors ${
            capturing ? "text-primary animate-pulse" : "text-muted-foreground"
          }`}
        />
        <Input
          ref={inputRef}
          value={value}
          disabled={disabled}
          inputMode="search"
          autoComplete="off"
          placeholder="امسح الباركود في أي وقت — الرقم بيتكتب هنا لوحده"
          className={`h-14 pe-11 text-lg transition-shadow ${capturing ? "ring-2 ring-primary/60" : ""}`}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key !== "Enter") return;
            event.preventDefault();
            event.stopPropagation();
            submit(/^[0-9]{4,}$/.test(value.trim()) ? "scan" : "search");
          }}
        />
      </div>

      <Button type="button" size="lg" variant="secondary" disabled={disabled || busy} onClick={() => submit("search")}>
        <Search className="size-4" />
        بحث
      </Button>
      <Button type="button" size="lg" disabled={disabled || busy} onClick={() => submit("scan")}>
        <ScanLine className="size-4" />
        مسح
      </Button>
    </div>
  );
}
