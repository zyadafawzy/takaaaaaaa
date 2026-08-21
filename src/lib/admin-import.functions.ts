import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import type { TablesUpdate } from "@/integrations/supabase/types";

export const IMPORTS_BUCKET = "admin-imports-private";
export const PRODUCT_ASSETS_BUCKET = "product-assets-private";
export const IMAGES_PREFIX = "product-images";
export const CATALOG_FILES_PREFIX = "catalog-files";
export const REPORTS_PREFIX = "reports";

const safeRelativePath = z
  .string()
  .min(1)
  .max(400)
  .regex(/^[A-Za-z0-9._\-/]+$/, "ASCII_PATH_ONLY")
  .refine((value) => !value.includes("..") && !value.startsWith("/"), "UNSAFE_PATH");

/** إنشاء دفعة رفع جديدة (صور و/أو ملف فهرس). */
export const createImportBatch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        label: z.string().trim().max(120).default(""),
        kind: z.enum(["images", "index_file", "mixed"]).default("images"),
        selectedCount: z.number().int().min(0).max(100000).default(0),
      })
      .parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { requireStaff, CATALOG_ROLES, writeAudit } = await import("./admin-guard.server");
    const identity = await requireStaff(context.supabase, context.userId, CATALOG_ROLES);

    const { data: batch, error } = await context.supabase
      .from("catalog_import_batches")
      .insert({
        label: data.label || `دفعة ${new Date().toISOString().slice(0, 16).replace("T", " ")}`,
        kind: data.kind,
        status: "open",
        created_by: identity.userId,
        created_by_email: identity.email,
        images_bucket_id: IMPORTS_BUCKET,
        selected_count: data.selectedCount,
      })
      .select("id, label, status, created_at")
      .single();

    if (error || !batch) throw new Error("BATCH_CREATE_FAILED");

    await context.supabase
      .from("catalog_import_batches")
      .update({ images_path_prefix: `${IMAGES_PREFIX}/${batch.id}` })
      .eq("id", batch.id);

    await writeAudit(identity, "create_import_batch", "catalog_import_batches", batch.id, {
      kind: data.kind,
    });

    return {
      batchId: batch.id,
      label: batch.label,
      bucket: IMPORTS_BUCKET,
      imagesPrefix: `${IMAGES_PREFIX}/${batch.id}`,
      catalogFilesPrefix: `${CATALOG_FILES_PREFIX}/${batch.id}`,
    };
  });

/**
 * admin_upload_product_asset — بيسجّل صورة اترفعت فعلًا في storage_asset_index.
 * الرفع نفسه بيحصل من المتصفح بجلسة المدير وRLS، من غير أي secret.
 * الصورة تفضل غير منشورة وغير مرتبطة بأي منتج.
 */
export const adminUploadProductAsset = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        batchId: z.string().uuid(),
        items: z
          .array(
            z.object({
              relativePath: safeRelativePath,
              storagePath: safeRelativePath,
              fileName: z.string().min(1).max(200),
              originalFileName: z.string().min(1).max(300),
              mimeType: z.enum(["image/jpeg", "image/png", "image/webp"]),
              byteSize: z.number().int().min(1).max(50 * 1024 * 1024),
              etag: z.string().max(200).optional(),
              contentHash: z.string().max(200).optional(),
            }),
          )
          .min(1)
          .max(200),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { requireStaff, CATALOG_ROLES } = await import("./admin-guard.server");
    await requireStaff(context.supabase, context.userId, CATALOG_ROLES);

    const rows = data.items.map((item) => {
      const numeric = /^0*(\d+)$/.exec(item.fileName.replace(/\.[^.]+$/, ""));
      const folderHint = item.relativePath.includes("/")
        ? item.relativePath.slice(0, item.relativePath.lastIndexOf("/"))
        : "";
      return {
        batch_id: data.batchId,
        bucket_id: IMPORTS_BUCKET,
        storage_path: item.storagePath,
        relative_path: item.relativePath,
        folder_hint: folderHint,
        file_name: item.fileName,
        original_file_name: item.originalFileName,
        sequence_no: numeric?.[1] ? Number.parseInt(numeric[1], 10) : null,
        mime_type: item.mimeType,
        byte_size: item.byteSize,
        etag: item.etag ?? null,
        content_hash: item.contentHash ?? null,
        scan_status: "pending" as const,
        published: false,
      };
    });

    const { data: inserted, error } = await context.supabase
      .from("storage_asset_index")
      .upsert(rows, { onConflict: "bucket_id,storage_path" })
      .select("id, sequence_no, byte_size");

    if (error) throw new Error(`INDEX_WRITE_FAILED:${error.code}`);

    return { ok: true, indexed: inserted?.length ?? 0 };
  });

/** ingest_catalog_source_file — يحفظ ويتحقق من ملف الفهرس فقط (بدون استيراد منتجات). */
export const ingestCatalogSourceFile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        batchId: z.string().uuid(),
        storagePath: safeRelativePath,
        fileName: z.string().min(1).max(300),
        format: z.enum(["csv", "xlsx", "json"]),
        byteSize: z.number().int().min(1).max(200 * 1024 * 1024),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { requireStaff, CATALOG_ROLES, writeAudit } = await import("./admin-guard.server");
    const identity = await requireStaff(context.supabase, context.userId, CATALOG_ROLES);

    const { error } = await context.supabase
      .from("catalog_import_batches")
      .update({
        index_file_bucket_id: IMPORTS_BUCKET,
        index_file_path: data.storagePath,
        index_file_name: data.fileName,
        index_file_format: data.format,
        kind: "mixed",
        status: "ready_for_scan",
      })
      .eq("id", data.batchId);

    if (error) throw new Error("INDEX_FILE_LINK_FAILED");

    await writeAudit(identity, "ingest_catalog_source_file", "catalog_import_batches", data.batchId, {
      format: data.format,
      bytes: data.byteSize,
      imported: false,
    });

    return { ok: true, stored: true, imported: false };
  });

/** scan_uploaded_image_batch — إحصاء وفحص أسماء الملفات والفجوات، بدون إنشاء أي منتج. */
export const scanUploadedImageBatch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ batchId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { requireStaff, CATALOG_ROLES, writeAudit } = await import("./admin-guard.server");
    const identity = await requireStaff(context.supabase, context.userId, CATALOG_ROLES);

    const { data: assets } = await context.supabase
      .from("storage_asset_index")
      .select("id, sequence_no, byte_size, content_hash, file_name, mime_type")
      .eq("batch_id", data.batchId)
      .limit(20000);

    const list = assets ?? [];
    const sequences = list
      .map((a) => a.sequence_no)
      .filter((n): n is number => typeof n === "number")
      .sort((a, b) => a - b);

    const min = sequences[0] ?? null;
    const max = sequences.length > 0 ? sequences[sequences.length - 1]! : null;
    const present = new Set(sequences);
    const gaps: number[] = [];
    if (min != null && max != null) {
      for (let i = min; i <= max && gaps.length < 500; i += 1) {
        if (!present.has(i)) gaps.push(i);
      }
    }

    const hashes = new Map<string, number>();
    for (const asset of list) {
      if (!asset.content_hash) continue;
      hashes.set(asset.content_hash, (hashes.get(asset.content_hash) ?? 0) + 1);
    }
    const duplicates = Array.from(hashes.values()).reduce(
      (sum, count) => sum + (count > 1 ? count - 1 : 0),
      0,
    );
    const totalBytes = list.reduce((sum, asset) => sum + Number(asset.byte_size), 0);

    const report = {
      batchId: data.batchId,
      scannedAt: new Date().toISOString(),
      files: list.length,
      totalBytes,
      minSequenceNo: min,
      maxSequenceNo: max,
      missingSequenceNumbers: gaps,
      duplicates,
      imported: false,
      linkedProducts: 0,
    };

    const reportPath = `${REPORTS_PREFIX}/${data.batchId}/scan-${Date.now()}.json`;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.storage
      .from(IMPORTS_BUCKET)
      .upload(reportPath, new Blob([JSON.stringify(report, null, 2)], { type: "application/json" }), {
        upsert: true,
        contentType: "application/json",
      });

    await context.supabase
      .from("catalog_import_batches")
      .update({
        uploaded_count: list.length,
        duplicate_count: duplicates,
        total_bytes: totalBytes,
        min_sequence_no: min,
        max_sequence_no: max,
        missing_sequence_numbers: gaps,
        scan_report_path: reportPath,
        status: "scanned",
      })
      .eq("id", data.batchId);

    await writeAudit(identity, "scan_uploaded_image_batch", "catalog_import_batches", data.batchId, {
      files: list.length,
    });

    return { ...report, reportPath };
  });

/** تحديث عدّادات الرفع من الواجهة (نجاح/فشل/عدد مختار). */
export const updateImportBatchProgress = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        batchId: z.string().uuid(),
        selectedCount: z.number().int().min(0).max(100000).optional(),
        uploadedCount: z.number().int().min(0).max(100000).optional(),
        failedCount: z.number().int().min(0).max(100000).optional(),
        totalBytes: z.number().int().min(0).optional(),
        status: z
          .enum(["open", "files_uploaded", "awaiting_index_file", "ready_for_scan", "failed", "cancelled"])
          .optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { requireStaff, CATALOG_ROLES } = await import("./admin-guard.server");
    await requireStaff(context.supabase, context.userId, CATALOG_ROLES);

    const patch: Record<string, unknown> = {};
    if (data.selectedCount != null) patch["selected_count"] = data.selectedCount;
    if (data.uploadedCount != null) patch["uploaded_count"] = data.uploadedCount;
    if (data.failedCount != null) patch["failed_count"] = data.failedCount;
    if (data.totalBytes != null) patch["total_bytes"] = data.totalBytes;
    if (data.status) patch["status"] = data.status;

    if (Object.keys(patch).length > 0) {
      await context.supabase.from("catalog_import_batches").update(patch as TablesUpdate<"catalog_import_batches">).eq("id", data.batchId);
    }
    return { ok: true };
  });

/** لوحة حالة الدفعات. */
export const listImportBatches = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { requireStaff, CATALOG_ROLES } = await import("./admin-guard.server");
    await requireStaff(context.supabase, context.userId, CATALOG_ROLES);

    const { data } = await context.supabase
      .from("catalog_import_batches")
      .select(
        `id, label, kind, status, created_at, created_by_email, selected_count, uploaded_count,
         failed_count, duplicate_count, total_bytes, min_sequence_no, max_sequence_no,
         missing_sequence_numbers, index_file_name, index_file_format, scan_report_path`,
      )
      .order("created_at", { ascending: false })
      .limit(50);

    return data ?? [];
  });

/** يقرأ ملف الفهرس المربوط بالدفعة من Storage ويسجّل كل صفوفه (بدون إنشاء منتجات). */
export const ingestIndexRowsFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ batchId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { requireStaff, CATALOG_ROLES, writeAudit } = await import("./admin-guard.server");
    const identity = await requireStaff(context.supabase, context.userId, CATALOG_ROLES);
    const { ingestIndexRows, parseIndexFile } = await import("./catalog-import.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: batch } = await context.supabase
      .from("catalog_import_batches")
      .select("index_file_path, index_file_name, index_file_format")
      .eq("id", data.batchId)
      .maybeSingle();
    if (!batch?.index_file_path) throw new Error("NO_INDEX_FILE");

    const download = await supabaseAdmin.storage.from(IMPORTS_BUCKET).download(batch.index_file_path);
    if (download.error || !download.data) throw new Error("INDEX_FILE_UNREADABLE");
    const text = await download.data.text();
    const records = parseIndexFile(
      text,
      (batch.index_file_format as "csv" | "json" | "xlsx") ?? "json",
    );
    const result = await ingestIndexRows(data.batchId, records, batch.index_file_name ?? "index");

    await writeAudit(identity, "ingest_index_rows", "catalog_import_batches", data.batchId, result);
    return result;
  });

/** فحص ومطابقة الصور بصفوف الفهرس — بدون إنشاء أي منتج. */
export const matchBatchRowsFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ batchId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { requireStaff, CATALOG_ROLES, writeAudit } = await import("./admin-guard.server");
    const identity = await requireStaff(context.supabase, context.userId, CATALOG_ROLES);
    const { matchBatch } = await import("./catalog-import.server");
    const result = await matchBatch(data.batchId);
    await writeAudit(identity, "match_import_batch", "catalog_import_batches", data.batchId, {
      rows: result.rows,
      assets: result.assets,
    });
    return result;
  });

/** استيراد الصفوف عالية الثقة كمسودات فقط (idempotent). */
export const importReadyRowsFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({ batchId: z.string().uuid(), rowIds: z.array(z.string().uuid()).max(2000).optional() })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { requireStaff, CATALOG_ROLES, writeAudit } = await import("./admin-guard.server");
    const identity = await requireStaff(context.supabase, context.userId, CATALOG_ROLES);
    const { importReadyRows } = await import("./catalog-import.server");
    const result = await importReadyRows(data.batchId, data.rowIds);
    await supabaseAuditNoop();
    await writeAudit(identity, "import_ready_rows", "catalog_import_batches", data.batchId, result);
    return result;
  });

async function supabaseAuditNoop(): Promise<void> {
  /* نقطة توسعة مستقبلية */
}

/** معاينة صفوف الاستيراد مع صورة مصغّرة موقّتة وفلاتر عربية. */
export const listImportRows = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        batchId: z.string().uuid(),
        filter: z
          .enum([
            "all",
            "ready",
            "needs_review",
            "imported_draft",
            "failed",
            "needs_visual_review",
            "no_price",
            "no_stock",
            "no_category",
            "no_image",
          ])
          .default("all"),
        search: z.string().max(120).default(""),
        page: z.number().int().min(0).max(500).default(0),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { requireStaff, CATALOG_ROLES } = await import("./admin-guard.server");
    await requireStaff(context.supabase, context.userId, CATALOG_ROLES);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const pageSize = 30;
    let query = supabaseAdmin
      .from("catalog_import_rows")
      .select(
        "id, row_number, status, match_method, confidence, match_reason, needs_visual_review, error_message, normalized_data, raw_data, matched_asset_id, created_product_id, source_file_name",
        { count: "exact" },
      )
      .eq("batch_id", data.batchId)
      .order("row_number", { ascending: true });

    if (["ready", "needs_review", "imported_draft", "failed"].includes(data.filter)) {
      query = query.eq("status", data.filter);
    } else if (data.filter === "needs_visual_review") {
      query = query.eq("needs_visual_review", true);
    } else if (data.filter === "no_image") {
      query = query.is("matched_asset_id", null);
    } else if (data.filter === "no_price") {
      query = query.ilike("error_message", "%سعر%");
    } else if (data.filter === "no_stock") {
      query = query.ilike("error_message", "%كمية%");
    } else if (data.filter === "no_category") {
      query = query.ilike("error_message", "%فئة%");
    }

    if (data.search.trim()) {
      query = query.or(
        `error_message.ilike.%${data.search}%,normalized_data->>name.ilike.%${data.search}%,normalized_data->>sku.ilike.%${data.search}%`,
      );
    }

    const { data: rows, count } = await query.range(data.page * pageSize, data.page * pageSize + pageSize - 1);

    const assetIds = Array.from(
      new Set((rows ?? []).map((row) => row.matched_asset_id).filter((id): id is string => Boolean(id))),
    );
    const paths = new Map<string, string>();
    if (assetIds.length > 0) {
      const { data: assets } = await supabaseAdmin
        .from("storage_asset_index")
        .select("id, storage_path")
        .in("id", assetIds);
      for (const asset of assets ?? []) paths.set(asset.id, asset.storage_path);
    }
    const signed = new Map<string, string>();
    if (paths.size > 0) {
      const { data: urls } = await supabaseAdmin.storage
        .from(IMPORTS_BUCKET)
        .createSignedUrls(Array.from(paths.values()), 600);
      for (const item of urls ?? []) {
        if (item.path && item.signedUrl) signed.set(item.path, item.signedUrl);
      }
    }

    return {
      total: count ?? 0,
      pageSize,
      rows: (rows ?? []).map((row) => {
        const storagePath = row.matched_asset_id ? (paths.get(row.matched_asset_id) ?? "") : "";
        return {
          ...row,
          storagePath,
          thumbnailUrl: storagePath ? (signed.get(storagePath) ?? null) : null,
        };
      }),
    };
  });

/** إجراءات إدارية على صف: اعتماد ونشر، تجاهل، ربط بصورة أخرى، تعديل المسودة. */
export const rowAction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        rowIds: z.array(z.string().uuid()).min(1).max(500),
        action: z.enum(["approve_publish", "ignore", "relink", "unpublish"]),
        assetId: z.string().uuid().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { requireStaff, CATALOG_ROLES, writeAudit } = await import("./admin-guard.server");
    const identity = await requireStaff(context.supabase, context.userId, CATALOG_ROLES);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: rows } = await supabaseAdmin
      .from("catalog_import_rows")
      .select("id, created_product_id, status")
      .in("id", data.rowIds);

    let affected = 0;
    for (const row of rows ?? []) {
      if (data.action === "ignore") {
        await supabaseAdmin
          .from("catalog_import_rows")
          .update({ status: "ignored", error_message: "تم تجاهله يدويًا" })
          .eq("id", row.id);
        affected += 1;
        continue;
      }
      if (data.action === "relink") {
        if (!data.assetId) continue;
        await supabaseAdmin
          .from("catalog_import_rows")
          .update({
            matched_asset_id: data.assetId,
            match_method: "manual",
            confidence: "high",
            match_reason: "ربط يدوي من مدير",
            needs_visual_review: false,
            status: "ready",
          })
          .eq("id", row.id);
        affected += 1;
        continue;
      }
      if (!row.created_product_id) continue;
      const publish = data.action === "approve_publish";
      await supabaseAdmin
        .from("products")
        .update({
          status: publish ? "published" : "draft",
          available: publish,
          visible: publish,
          published_at: publish ? new Date().toISOString() : null,
        })
        .eq("id", row.created_product_id);

      await supabaseAdmin
        .from("product_images")
        .update({ published: publish })
        .eq("product_id", row.created_product_id);
      affected += 1;
    }

    await writeAudit(identity, `row_action_${data.action}`, "catalog_import_rows", null, {
      count: affected,
    });
    return { ok: true, affected };
  });

/** ملخص الدفعة + تنزيل تقرير الأخطاء كنص. */
export const batchReport = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ batchId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { requireStaff, CATALOG_ROLES } = await import("./admin-guard.server");
    await requireStaff(context.supabase, context.userId, CATALOG_ROLES);
    const { batchSummary } = await import("./catalog-import.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const summary = await batchSummary(data.batchId);
    const { data: problems } = await supabaseAdmin
      .from("catalog_import_rows")
      .select("row_number, status, error_message, normalized_data")
      .eq("batch_id", data.batchId)
      .neq("error_message", "")
      .order("row_number")
      .limit(3000);
    return {
      summary,
      problems: (problems ?? []).map((row) => ({
        row: row.row_number,
        status: row.status,
        sku: (row.normalized_data as { sku?: string } | null)?.sku ?? "",
        error: row.error_message,
      })),
    };
  });
