import { useEffect, useState } from "react";
import { CloudUpload, Wifi, WifiOff } from "lucide-react";

import { idbGet } from "@/lib/offline/idb";

type Outbox = Array<{ id: string }>;

/** مؤشر الاتصال + الفواتير المتأخرة — بيظهر في كل صفحات الإدارة. */
export function ConnectionChip() {
  const [online, setOnline] = useState(true);
  const [pending, setPending] = useState(0);

  useEffect(() => {
    setOnline(window.navigator.onLine);
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);

    const read = () => void idbGet<Outbox>("outbox").then((items) => setPending(items?.length ?? 0));
    read();
    const interval = window.setInterval(read, 10000);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
      window.clearInterval(interval);
    };
  }, []);

  return (
    <span className="flex items-center gap-1.5">
      <span
        className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-bold ${
          online ? "bg-primary/10 text-primary" : "bg-destructive/10 text-destructive"
        }`}
        title={online ? "متصل بالإنترنت" : "بدون إنترنت — الكاشير شغال محليًا"}
      >
        {online ? <Wifi className="size-3.5" /> : <WifiOff className="size-3.5" />}
        {online ? "متصل" : "أوفلاين"}
      </span>
      {pending > 0 ? (
        <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-1 text-[11px] font-bold text-amber-700 dark:text-amber-400">
          <CloudUpload className="size-3.5" />
          {pending}
        </span>
      ) : null}
    </span>
  );
}
