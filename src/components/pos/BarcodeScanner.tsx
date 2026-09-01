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
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!disabled) inputRef.current?.focus();
  }, [disabled, busy]);

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
        <ScanLine className="pointer-events-none absolute end-3 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" />
        <Input
          ref={inputRef}
          value={value}
          disabled={disabled}
          inputMode="search"
          autoComplete="off"
          placeholder="امسح الباركود أو اكتب اسم المنتج ثم Enter"
          className="h-14 pe-11 text-lg"
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key !== "Enter") return;
            event.preventDefault();
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
