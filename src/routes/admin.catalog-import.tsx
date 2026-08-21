import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, FileSpreadsheet, FolderUp, RefreshCw, ScanSearch } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { useAdminAuth } from "@/lib/auth/admin-auth";
import { supabase } from "@/integrations/supabase/client";
import {
  IMPORTS_BUCKET,
  adminUploadProductAsset,
  createImportBatch,
  ingestCatalogSourceFile,
  listImportBatches,
  scanUploadedImageBatch,
  updateImportBatchProgress,
} from "@/lib/admin-import.functions";

export const Route = createFileRoute("/admin/catalog-import")({
  head: () => ({
    meta: [
      { title: "رفع مكتبة الصور والبيانات — تِكّة" },
      {
        name: "description",
        content: "رفع مجلد صور المنتجات وملف البيانات إلى مخزن خاص، مع فحص وتقرير قبل أي نشر.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: CatalogImportPage,
});

const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_IMAGE_BYTES = 15 * 1024 * 1024;
const CONCURRENCY = 4;

type QueueItem = {
  file: File;
  relativePath: string;
  status: "pending" | "uploading" | "done" | "failed" | "skipped";
  reason?: string;
};

function sanitizeSegment(value: string): string {
  const ext = /\.([A-Za-z0-9]+)$/.exec(value)?.[1]?.toLowerCase() ?? "jpg";
  const base = value
    .replace(/\.[^.]+$/, "")
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return `${base || "file"}.${ext}`;
}

function sanitizeRelativePath(path: string): string {
  const parts = path.split("/").filter((part) => part && part !== "." && part !== "..");
  const file = parts.pop() ?? "file.jpg";
  const folders = parts.map((part) => part.replace(/[^A-Za-z0-9._-]+/g, "-").slice(0, 60));
  return [...folders, sanitizeSegment(file)].join("/");
}

async function hashFile(file: File): Promise<string | undefined> {
  try {
    const buffer = await file.slice(0, 1024 * 1024).arrayBuffer();
    const digest = await crypto.subtle.digest("SHA-256", buffer);
    return Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")
      .concat(`-${file.size}`);
  } catch {
    return undefined;
  }
}

function CatalogImportPage() {
  const { allowed, ready, user } = useAdminAuth();
  const folderRef = useRef<HTMLInputElement>(null);
  const [label, setLabel] = useState("");
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [batchId, setBatchId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [scan, setScan] = useState<null | {
    files: number;
    duplicates: number;
    minSequenceNo: number | null;
    maxSequenceNo: number | null;
    missingSequenceNumbers: number[];
  }>(null);
  const [batches, setBatches] = useState<Awaited<ReturnType<typeof listImportBatches>>>([]);

  const refreshBatches = async () => {
    try {
      setBatches(await listImportBatches());
    } catch {
      /* الصلاحية مرفوضة من الخادم */
    }
  };

  useEffect(() => {
    if (ready && user) void refreshBatches();
  }, [ready, user]);

  useEffect(() => {
    const input = folderRef.current;
    if (input) input.setAttribute("webkitdirectory", "");
  }, []);

  if (ready && !allowed("catalog.edit")) {
    return (
      <div className="rounded-xl border border-border bg-surface p-6 text-sm">
        الصفحة دي متاحة لمدير النظام ومدير المتجر وموظف المخزون فقط.
      </div>
    );
  }

  const done = queue.filter((item) => item.status === "done").length;
  const failed = queue.filter((item) => item.status === "failed").length;
  const skipped = queue.filter((item) => item.status === "skipped").length;
  const progress = queue.length === 0 ? 0 : Math.round(((done + failed + skipped) / queue.length) * 100);

  function pickFiles(files: FileList | null) {
    if (!files) return;
    const items: QueueItem[] = Array.from(files).map((file) => {
      const relative = sanitizeRelativePath(
        (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name,
      );
      if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
        return { file, relativePath: relative, status: "skipped", reason: "نوع غير مسموح" };
      }
      if (file.size > MAX_IMAGE_BYTES) {
        return { file, relativePath: relative, status: "skipped", reason: "أكبر من 15 ميجابايت" };
      }
      return { file, relativePath: relative, status: "pending" };
    });
    setQueue(items);
    setScan(null);
    setMessage(`اتحدد ${items.length} ملف — الصور بتتخزن خاصة ومش هتتنشر تلقائيًا.`);
  }

  async function startUpload() {
    const pending = queue.filter((item) => item.status === "pending");
    if (pending.length === 0) {
      setMessage("مفيش ملفات صالحة للرفع.");
      return;
    }
    setBusy(true);
    setMessage("بنجهّز الدفعة...");

    try {
      const batch = await createImportBatch({
        data: { label, kind: "images", selectedCount: queue.length },
      });
      setBatchId(batch.batchId);

      const next = [...queue];
      let cursor = 0;
      let uploaded = 0;
      let failedCount = 0;
      let bytes = 0;
      const registered: Array<{
        relativePath: string;
        storagePath: string;
        fileName: string;
        originalFileName: string;
        mimeType: "image/jpeg" | "image/png" | "image/webp";
        byteSize: number;
        contentHash?: string;
      }> = [];

      async function worker() {
        for (;;) {
          const index = next.findIndex((item, i) => i >= cursor && item.status === "pending");
          if (index === -1) return;
          cursor = index + 1;
          const item = next[index]!;
          next[index] = { ...item, status: "uploading" };
          setQueue([...next]);

          const storagePath = `${batch.imagesPrefix}/${item.relativePath}`;
          const { error } = await supabase.storage
            .from(IMPORTS_BUCKET)
            .upload(storagePath, item.file, { contentType: item.file.type, upsert: true });

          if (error) {
            failedCount += 1;
            next[index] = { ...item, status: "failed", reason: error.message };
          } else {
            uploaded += 1;
            bytes += item.file.size;
            const hash = await hashFile(item.file);
            registered.push({
              relativePath: item.relativePath,
              storagePath,
              fileName: item.relativePath.split("/").pop() ?? item.relativePath,
              originalFileName: item.file.name,
              mimeType: item.file.type as "image/jpeg",
              byteSize: item.file.size,
              ...(hash ? { contentHash: hash } : {}),
            });
            next[index] = { ...item, status: "done" };
          }
          setQueue([...next]);

          if (registered.length >= 100) {
            const chunk = registered.splice(0, registered.length);
            await adminUploadProductAsset({ data: { batchId: batch.batchId, items: chunk } });
          }
        }
      }

      await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));

      if (registered.length > 0) {
        await adminUploadProductAsset({ data: { batchId: batch.batchId, items: registered } });
      }

      await updateImportBatchProgress({
        data: {
          batchId: batch.batchId,
          uploadedCount: uploaded,
          failedCount,
          totalBytes: bytes,
          status: failedCount > 0 && uploaded === 0 ? "failed" : "files_uploaded",
        },
      });

      setMessage(
        `خلصنا الرفع: ${uploaded} نجحت، ${failedCount} فشلت، ${skipped} اتخطّت. الصور محفوظة خاصة وبدون ربط بأي منتج.`,
      );
      await refreshBatches();
    } catch {
      setMessage("حصلت مشكلة أثناء الرفع — جرّب تاني أو راجع صلاحيتك.");
    } finally {
      setBusy(false);
    }
  }

  async function uploadIndexFile(file: File) {
    if (!batchId) {
      setMessage("ارفع الصور أو ابدأ دفعة الأول قبل ملف البيانات.");
      return;
    }
    const ext = file.name.split(".").pop()?.toLowerCase();
    const format = ext === "csv" ? "csv" : ext === "json" ? "json" : ext === "xlsx" ? "xlsx" : null;
    if (!format) {
      setMessage("الملف لازم يكون CSV أو XLSX أو JSON.");
      return;
    }
    setBusy(true);
    const storagePath = `catalog-files/${batchId}/${sanitizeSegment(file.name)}`;
    const { error } = await supabase.storage
      .from(IMPORTS_BUCKET)
      .upload(storagePath, file, { upsert: true });
    if (error) {
      setBusy(false);
      setMessage("مقدرناش نرفع ملف البيانات.");
      return;
    }
    await ingestCatalogSourceFile({
      data: { batchId, storagePath, fileName: file.name, format, byteSize: file.size },
    });
    setBusy(false);
    setMessage("ملف البيانات اتخزن واتربط بالدفعة — لسه مفيش أي منتج اتعمل منه.");
    await refreshBatches();
  }

  async function runScan() {
    if (!batchId) return;
    setBusy(true);
    try {
      const result = await scanUploadedImageBatch({ data: { batchId } });
      setScan(result);
      setMessage("الفحص خلص — التقرير محفوظ مع الدفعة.");
      await refreshBatches();
    } catch {
      setMessage("الفحص فشل.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-xl font-bold">رفع مكتبة الصور والبيانات</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          ارفع مجلد الصور بالكامل وملف البيانات إلى مخزن خاص. مفيش أي نشر أو إنشاء منتجات تلقائي —
          الصور تدخل الفهرس كـ«غير منشورة وغير مرتبطة» لحد ما تربطها بنفسك.
        </p>
      </header>

      <section className="rounded-xl border border-border bg-surface p-4">
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <Label htmlFor="label">اسم الدفعة (اختياري)</Label>
            <Input
              id="label"
              value={label}
              onChange={(event) => setLabel(event.target.value)}
              placeholder="مثال: صور الرفوف — يناير"
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="folder">مجلد الصور</Label>
            <Input
              id="folder"
              ref={folderRef}
              type="file"
              multiple
              accept={ALLOWED_IMAGE_TYPES.join(",")}
              className="mt-1"
              onChange={(event) => pickFiles(event.target.files)}
            />
            <p className="mt-1 text-[11px] text-muted-foreground">
              يقبل المجلدات الفرعية. المسموح: JPG / PNG / WEBP حتى 15 ميجابايت للملف.
            </p>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <Button onClick={() => void startUpload()} disabled={busy || queue.length === 0} className="gap-2">
            <FolderUp className="size-4" /> ابدأ الرفع
          </Button>
          <Button variant="outline" disabled={busy || !batchId} onClick={() => void runScan()} className="gap-2">
            <ScanSearch className="size-4" /> افحص الدفعة
          </Button>
          <Button variant="ghost" onClick={() => void refreshBatches()} className="gap-2">
            <RefreshCw className="size-4" /> تحديث
          </Button>
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs font-semibold">
            <FileSpreadsheet className="size-4" /> ملف بيانات (CSV / XLSX / JSON)
            <input
              type="file"
              className="hidden"
              accept=".csv,.xlsx,.json"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void uploadIndexFile(file);
              }}
            />
          </label>
        </div>

        {queue.length > 0 ? (
          <div className="mt-4">
            <Progress value={progress} />
            <p className="mt-2 text-xs text-muted-foreground">
              {done} نجحت · {failed} فشلت · {skipped} اتخطّت · من {queue.length}
            </p>
          </div>
        ) : null}

        {message ? <p className="mt-3 text-xs font-semibold">{message}</p> : null}
      </section>

      {scan ? (
        <section className="rounded-xl border border-border bg-surface p-4 text-sm">
          <h2 className="flex items-center gap-2 font-bold">
            <CheckCircle2 className="size-4 text-primary" /> تقرير الفحص
          </h2>
          <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
            <li>عدد الملفات المفهرسة: {scan.files}</li>
            <li>
              أرقام التسلسل: {scan.minSequenceNo ?? "—"} → {scan.maxSequenceNo ?? "—"}
            </li>
            <li>نسخ مكرّرة (بنفس البصمة): {scan.duplicates}</li>
            <li>
              أرقام ناقصة:{" "}
              {scan.missingSequenceNumbers.length === 0
                ? "مفيش"
                : scan.missingSequenceNumbers.slice(0, 40).join(", ")}
            </li>
          </ul>
          <p className="mt-2 flex items-center gap-1 text-[11px] text-muted-foreground">
            <AlertTriangle className="size-3.5" /> الفحص لا يُنشئ منتجات ولا ينشر صور.
          </p>
        </section>
      ) : null}

      {queue.length > 0 ? (
        <section className="rounded-xl border border-border bg-surface p-4">
          <h2 className="mb-2 text-sm font-bold">طابور الرفع</h2>
          <ul className="max-h-64 space-y-1 overflow-auto text-xs">
            {queue.slice(0, 300).map((item, index) => (
              <li key={`${item.relativePath}-${index}`} className="flex justify-between gap-2">
                <span className="truncate">{item.relativePath}</span>
                <span className="shrink-0 text-muted-foreground">
                  {item.status}
                  {item.reason ? ` — ${item.reason}` : ""}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="rounded-xl border border-border bg-surface p-4">
        <h2 className="mb-2 text-sm font-bold">الدفعات السابقة</h2>
        {batches.length === 0 ? (
          <p className="text-xs text-muted-foreground">مفيش دفعات لسه.</p>
        ) : (
          <div className="overflow-auto">
            <table className="w-full text-xs">
              <thead className="text-muted-foreground">
                <tr>
                  <th className="p-1 text-start">الدفعة</th>
                  <th className="p-1 text-start">الحالة</th>
                  <th className="p-1 text-start">مرفوع</th>
                  <th className="p-1 text-start">فشل</th>
                  <th className="p-1 text-start">مكرر</th>
                  <th className="p-1 text-start">ملف البيانات</th>
                </tr>
              </thead>
              <tbody>
                {batches.map((batch) => (
                  <tr key={batch.id} className="border-t border-border">
                    <td className="p-1">{batch.label}</td>
                    <td className="p-1">{batch.status}</td>
                    <td className="p-1">{batch.uploaded_count}</td>
                    <td className="p-1">{batch.failed_count}</td>
                    <td className="p-1">{batch.duplicate_count}</td>
                    <td className="p-1">{batch.index_file_name ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
