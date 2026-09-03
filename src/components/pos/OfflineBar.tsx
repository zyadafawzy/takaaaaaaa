import { CloudOff, CloudUpload, Download, Wifi, WifiOff } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useOffline } from "@/lib/offline/offline";

/** شريط حالة الاتصال + التحميل للعمل أوفلاين + رفع الفواتير المتأخرة (شاشات الإدارة فقط). */
export function OfflineBar() {
  const offline = useOffline();
  if (!offline) return null;

  const { isOnline, mode, chooseMode, snapshot, downloading, download, outbox, sync, syncing } = offline;

  if (mode === null) {
    return (
      <div className="border-b border-border bg-muted/40 px-4 py-3">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3">
          <p className="flex-1 text-sm font-semibold">
            أول تشغيل على الجهاز ده: تحب نحمّل كل البيانات عشان الكاشير يشتغل من غير إنترنت؟
          </p>
          <Button size="sm" onClick={() => chooseMode("offline")} disabled={downloading}>
            <Download className="size-4" />
            {downloading ? "بنحمّل…" : "تحميل للعمل أوفلاين"}
          </Button>
          <Button size="sm" variant="outline" onClick={() => chooseMode("online")}>
            تشغيل أونلاين بس
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="border-b border-border bg-muted/30 px-4 py-2">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-2 text-xs">
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-bold ${
            isOnline ? "bg-primary/10 text-primary" : "bg-destructive/10 text-destructive"
          }`}
        >
          {isOnline ? <Wifi className="size-3.5" /> : <WifiOff className="size-3.5" />}
          {isOnline ? "متصل" : "بدون إنترنت"}
        </span>

        <span className="inline-flex items-center gap-1.5 text-muted-foreground">
          {snapshot ? (
            <>
              <Download className="size-3.5" />
              {snapshot.variants.length} صنف محفوظ · آخر تحديث{" "}
              {new Date(snapshot.takenAt).toLocaleString("ar-EG", { dateStyle: "short", timeStyle: "short" })}
            </>
          ) : (
            <>
              <CloudOff className="size-3.5" />
              مفيش نسخة محلية
            </>
          )}
        </span>

        {outbox.length > 0 ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/15 px-2.5 py-1 font-bold text-amber-700 dark:text-amber-400">
            <CloudUpload className="size-3.5" />
            {outbox.length} فاتورة في انتظار الرفع
          </span>
        ) : null}

        <span className="ms-auto flex items-center gap-2">
          <Button size="sm" variant="outline" className="h-7" onClick={() => void download()} disabled={downloading || !isOnline}>
            {downloading ? "بنحمّل…" : "تحديث النسخة المحلية"}
          </Button>
          {outbox.length > 0 ? (
            <Button size="sm" className="h-7" onClick={() => void sync()} disabled={syncing || !isOnline}>
              {syncing ? "بنرفع…" : "رفع الآن"}
            </Button>
          ) : null}
        </span>
      </div>
    </div>
  );
}
