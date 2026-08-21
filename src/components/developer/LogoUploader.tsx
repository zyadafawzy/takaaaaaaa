import { useRef, useState } from "react";
import { ImagePlus, Trash2, UploadCloud, CheckCircle2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

import { ASSET_SPECS } from "@/lib/store-hero-gallery";
import { Button } from "@/components/ui/button";

export type LogoDraft = { fileName: string; contentType: string; base64: string; preview: string };

type Info = { width: number; height: number; sizeKb: number };

/** رفع شعار السوبرماركت مع توضيح المقاسات المطلوبة وفحص الصورة فورًا. */
export function LogoUploader({
  logo,
  onChange,
  currentUrl,
}: {
  logo: LogoDraft | null;
  onChange: (logo: LogoDraft | null) => void;
  currentUrl?: string | null;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [info, setInfo] = useState<Info | null>(null);
  const [dragging, setDragging] = useState(false);
  const preview = logo?.preview ?? currentUrl ?? null;

  const pick = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("الملف ده مش صورة");
      return;
    }
    if (file.size > 2_000_000) {
      toast.error("الصورة أكبر من ٢ ميجا");
      return;
    }
    const buffer = await file.arrayBuffer();
    let binary = "";
    const bytes = new Uint8Array(buffer);
    for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]!);
    const objectUrl = URL.createObjectURL(file);

    const image = new Image();
    image.onload = () =>
      setInfo({
        width: image.naturalWidth,
        height: image.naturalHeight,
        sizeKb: Math.round(file.size / 1024),
      });
    image.src = objectUrl;

    onChange({
      fileName: file.name,
      contentType: file.type || "image/png",
      base64: btoa(binary),
      preview: objectUrl,
    });
  };

  const ratio = info ? info.width / info.height : 1;
  const squareish = ratio > 0.85 && ratio < 1.18;
  const bigEnough = info ? Math.min(info.width, info.height) >= 256 : true;
  const perfect = Boolean(info) && squareish && bigEnough;

  return (
    <div
      onDragOver={(event) => {
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(event) => {
        event.preventDefault();
        setDragging(false);
        const file = event.dataTransfer.files?.[0];
        if (file) void pick(file);
      }}
      className={`flex flex-col gap-4 rounded-2xl border-2 border-dashed p-4 transition-colors sm:flex-row sm:items-center ${
        dragging ? "border-primary bg-primary-soft/50" : "border-border bg-background"
      }`}
    >
      <div className="grid size-28 shrink-0 place-items-center overflow-hidden rounded-2xl border border-border bg-surface">
        {preview ? (
          <img src={preview} alt="شعار السوبرماركت" className="size-full object-contain p-1.5" />
        ) : (
          <ImagePlus className="size-8 text-muted-foreground" />
        )}
      </div>

      <div className="min-w-0 flex-1 space-y-1.5">
        <p className="text-sm font-bold">{ASSET_SPECS.logo.label} — ارفع شعارك بنفسك</p>
        <ul className="space-y-0.5 text-[11px] text-muted-foreground">
          <li>• المقاس المفضّل: {ASSET_SPECS.logo.size}</li>
          <li>• {ASSET_SPECS.logo.note}</li>
          <li>• الصيغ المدعومة: PNG / JPG / WEBP / SVG</li>
          <li>• اسحب الصورة وارميها هنا على طول</li>
        </ul>

        {info ? (
          <p
            className={`flex items-center gap-1.5 text-[11px] font-bold ${
              perfect ? "text-success" : "text-warning"
            }`}
          >
            {perfect ? <CheckCircle2 className="size-3.5" /> : <AlertTriangle className="size-3.5" />}
            {info.width}×{info.height} بكسل — {info.sizeKb} ك.ب
            {perfect
              ? " • مقاس ممتاز"
              : !squareish
                ? " • يُفضّل شعار مربّع"
                : " • الدقة صغيرة، يُفضّل 512×512"}
          </p>
        ) : null}

        <div className="flex flex-wrap gap-2 pt-1">
          <Button type="button" size="sm" variant="outline" className="gap-1.5" onClick={() => inputRef.current?.click()}>
            <UploadCloud className="size-3.5" /> اختر صورة
          </Button>
          {logo ? (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => {
                onChange(null);
                setInfo(null);
              }}
            >
              <Trash2 className="me-1 size-3.5" /> شيل
            </Button>
          ) : null}
        </div>

        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/svg+xml"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void pick(file);
          }}
        />
      </div>
    </div>
  );
}
