/**
 * منطق مطابقة واستيراد الكتالوج — يعمل على الخادم فقط.
 * قاعدة أساسية: ملف الفهرس هو مصدر الحقيقة الوحيد للبيانات المنظمة،
 * والصور للعرض والتحقق من الهوية فقط. لا اختراع لأي قيمة مفقودة.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { IMPORTS_BUCKET } from "./admin-import.constants";

export type RawRow = Record<string, unknown>;

export type NormalizedRow = {
  sku: string;
  name: string;
  description: string;
  price: number | null;
  compareAtPrice: number | null;
  stock: number | null;
  categoryName: string;
  categorySlug: string;
  brand: string;
  sizeLabel: string;
  unit: "piece" | "kg" | "pack" | "bundle" | "liter";
  sourceUrl: string;
  slug: string;
  imageFileName: string;
  imageRelativePath: string;
  sequenceNo: number | null;
};

const ALIASES: Record<keyof NormalizedRow | "barcode", string[]> = {
  sku: ["كود_الصنف_sku", "sku", "كود_الصنف", "الكود", "كود", "item_code", "code"],
  barcode: ["barcode", "الباركود", "ean"],
  name: ["الاسم_بالعربية", "الاسم", "name", "product_name", "الاسم_الأصلي", "title"],
  description: ["الوصف_بالعربية", "الوصف", "description", "الوصف_الأصلي"],
  price: ["السعر_الحالي_جنيه", "السعر", "price", "السعر_الحالي", "unit_price"],
  compareAtPrice: ["السعر_قبل_الخصم_جنيه", "السعر_قبل_الخصم", "compare_at_price", "old_price"],
  stock: ["المخزون_المعلن", "الكمية", "stock", "quantity", "qty", "المخزون"],
  categoryName: ["فئة_رئيسية_عربية", "الفئة", "category", "category_name", "التصنيف"],
  categorySlug: ["مسار_الفئة", "category_slug", "category_path"],
  brand: ["الماركة", "brand", "العلامة_التجارية"],
  sizeLabel: ["الحجم", "size", "الوحدة", "unit_size", "الوزن"],
  unit: ["unit", "وحدة_البيع"],
  sourceUrl: ["رابط_المنتج", "product_url", "url", "الرابط"],
  slug: ["slug"],
  imageFileName: ["اسم_ملف_الصورة", "image_file", "image_name", "اسم_الصورة"],
  imageRelativePath: ["مسار_الصورة_داخل_الحزمة", "image_path", "relative_path", "مسار_الصورة"],
  sequenceNo: ["الرقم_التسلسلي", "sequence_no", "sequence", "رقم", "seq", "image_number"],
};

function normKey(key: string): string {
  return key.trim().toLowerCase().replace(/\s+/g, "_");
}

function pick(raw: RawRow, keys: string[]): unknown {
  const map = new Map<string, unknown>();
  for (const [key, value] of Object.entries(raw)) map.set(normKey(key), value);
  for (const key of keys) {
    const value = map.get(normKey(key));
    if (value !== undefined && value !== null && String(value).trim() !== "") return value;
  }
  return undefined;
}

function toNumber(value: unknown): number | null {
  if (value === undefined || value === null || value === "") return null;
  const cleaned = String(value).replace(/[^\d.\-]/g, "");
  if (!cleaned) return null;
  const parsed = Number.parseFloat(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

function toInt(value: unknown): number | null {
  const parsed = toNumber(value);
  return parsed === null ? null : Math.trunc(parsed);
}

function asciiSlug(value: string, fallback: string): string {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return slug || fallback;
}

function detectUnitAndSize(name: string): { unit: NormalizedRow["unit"]; sizeLabel: string } {
  const match = /(\d+(?:\.\d+)?)\s*(kg|kgs|كجم|جم|gm|gms|g|ml|مل|ltr|lt|l|لتر)\b/i.exec(name);
  if (!match) return { unit: "piece", sizeLabel: "" };
  const amount = match[1]!;
  const raw = match[2]!.toLowerCase();
  if (["kg", "kgs", "كجم"].includes(raw)) return { unit: "kg", sizeLabel: `${amount} كجم` };
  if (["g", "gm", "gms", "جم"].includes(raw)) return { unit: "piece", sizeLabel: `${amount} جم` };
  if (["ml", "مل"].includes(raw)) return { unit: "piece", sizeLabel: `${amount} مل` };
  return { unit: "liter", sizeLabel: `${amount} لتر` };
}

export function normalizeRow(raw: RawRow): NormalizedRow {
  const sku = String(pick(raw, ALIASES.sku) ?? pick(raw, ALIASES.barcode) ?? "").trim();
  const name = String(pick(raw, ALIASES.name) ?? "").trim();
  const originalName = String(pick(raw, ["الاسم_الأصلي", "name"]) ?? name);
  const categoryName = String(pick(raw, ALIASES.categoryName) ?? "").trim();
  const categoryPath = String(pick(raw, ALIASES.categorySlug) ?? "").trim();
  const pathParts = categoryPath.split("/").filter(Boolean);
  const categorySlugSource = pathParts.length >= 2 ? pathParts[pathParts.length - 2]! : categoryName;
  const detected = detectUnitAndSize(originalName);
  const explicitSize = String(pick(raw, ALIASES.sizeLabel) ?? "").trim();

  return {
    sku,
    name,
    description: String(pick(raw, ALIASES.description) ?? "").trim(),
    price: toNumber(pick(raw, ALIASES.price)),
    compareAtPrice: toNumber(pick(raw, ALIASES.compareAtPrice)),
    stock: toInt(pick(raw, ALIASES.stock)),
    categoryName,
    categorySlug: asciiSlug(categorySlugSource, `cat-${sku || "unknown"}`),
    brand: String(pick(raw, ALIASES.brand) ?? "").trim(),
    sizeLabel: explicitSize || detected.sizeLabel,
    unit: detected.unit,
    sourceUrl: String(pick(raw, ALIASES.sourceUrl) ?? "").trim(),
    slug: asciiSlug(String(pick(raw, ALIASES.slug) ?? originalName), `p-${sku}`),
    imageFileName: String(pick(raw, ALIASES.imageFileName) ?? "").trim(),
    imageRelativePath: String(pick(raw, ALIASES.imageRelativePath) ?? "").trim(),
    sequenceNo: toInt(pick(raw, ALIASES.sequenceNo)),
  };
}

/** قارئ CSV بسيط متوافق مع RFC4180 (فواصل وأقواس اقتباس وأسطر داخلية). */
export function parseCsv(text: string): RawRow[] {
  const rows: string[][] = [];
  let field = "";
  let row: string[] = [];
  let quoted = false;
  const source = text.replace(/^\uFEFF/, "");
  for (let i = 0; i < source.length; i += 1) {
    const char = source[i]!;
    if (quoted) {
      if (char === '"') {
        if (source[i + 1] === '"') {
          field += '"';
          i += 1;
        } else quoted = false;
      } else field += char;
      continue;
    }
    if (char === '"') quoted = true;
    else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (char !== "\r") field += char;
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  const header = rows.shift();
  if (!header) return [];
  return rows
    .filter((cells) => cells.some((cell) => cell.trim() !== ""))
    .map((cells) => Object.fromEntries(header.map((key, index) => [key.trim(), cells[index] ?? ""])));
}

export function parseIndexFile(text: string, format: "csv" | "json" | "xlsx"): RawRow[] {
  if (format === "xlsx") throw new Error("XLSX_NOT_SUPPORTED_CONVERT_TO_CSV");
  if (format === "json") {
    const parsed: unknown = JSON.parse(text);
    if (Array.isArray(parsed)) return parsed as RawRow[];
    const values = Object.values(parsed as Record<string, unknown>).find((value) => Array.isArray(value));
    if (Array.isArray(values)) return values as RawRow[];
    throw new Error("JSON_SHAPE_UNSUPPORTED");
  }
  return parseCsv(text);
}

/** يستخرج SKU/رقم من اسم ملف الصورة: 0001.jpg → 1، 918658__اسم__65.jpg → 918658 */
export function sequenceFromFileName(fileName: string): number | null {
  const base = fileName.replace(/\.[^.]+$/, "");
  const pureNumber = /^0*(\d{1,9})$/.exec(base);
  if (pureNumber) return Number.parseInt(pureNumber[1]!, 10);
  const prefix = /^0*(\d{3,12})(?:[_\-\s]|$)/.exec(base);
  if (prefix) return Number.parseInt(prefix[1]!, 10);
  return null;
}

function nameKey(value: string): string {
  return value
    .replace(/\.[^.]+$/, "")
    .toLowerCase()
    .replace(/[^a-z0-9\u0600-\u06FF]+/g, "");
}

/** يسجّل صفوف الفهرس كما هي (خام + منظمة) داخل catalog_import_rows. */
export async function ingestIndexRows(
  batchId: string,
  records: RawRow[],
  sourceFileName: string,
): Promise<{ rows: number }> {
  const payload = records.map((raw, index) => ({
    batch_id: batchId,
    row_number: index + 1,
    raw_data: raw as never,
    normalized_data: normalizeRow(raw) as never,
    source_file_name: sourceFileName,
    status: "pending",
    match_method: "none",
    confidence: "none",
  }));

  for (let i = 0; i < payload.length; i += 400) {
    const chunk = payload.slice(i, i + 400);
    const { error } = await supabaseAdmin
      .from("catalog_import_rows")
      .upsert(chunk, { onConflict: "batch_id,row_number" });
    if (error) throw new Error(`ROWS_WRITE_FAILED:${error.message}`);
  }
  return { rows: payload.length };
}

type AssetRow = {
  id: string;
  file_name: string;
  relative_path: string;
  original_file_name: string;
  sequence_no: number | null;
  mime_type: string;
  byte_size: number;
  content_hash: string | null;
};

async function loadAll<T>(
  table: "storage_asset_index" | "catalog_import_rows",
  columns: string,
  batchId: string,
): Promise<T[]> {
  const out: T[] = [];
  for (let page = 0; page < 200; page += 1) {
    const { data, error } = await supabaseAdmin
      .from(table)
      .select(columns)
      .eq("batch_id", batchId)
      .order("id", { ascending: true })
      .range(page * 1000, page * 1000 + 999);
    if (error) throw new Error(`READ_FAILED:${error.message}`);
    const list = (data ?? []) as unknown as T[];
    out.push(...list);
    if (list.length < 1000) break;
  }
  return out;
}

const ALLOWED_MIME = ["image/jpeg", "image/png", "image/webp"];

/** مرحلة الفحص والمطابقة — لا تُنشئ أي منتج. */
export async function matchBatch(batchId: string): Promise<{
  assets: number;
  rows: number;
  byMethod: Record<string, number>;
  byStatus: Record<string, number>;
  duplicateSequences: number[];
  invalidAssets: number;
  unmatchedAssets: number;
}> {
  const assets = await loadAll<AssetRow>(
    "storage_asset_index",
    "id, file_name, relative_path, original_file_name, sequence_no, mime_type, byte_size, content_hash",
    batchId,
  );
  const rows = await loadAll<{
    id: string;
    row_number: number;
    normalized_data: NormalizedRow;
  }>("catalog_import_rows", "id, row_number, normalized_data", batchId);

  // 1) استخراج رقم/كود من اسم الملف + رصد التلف والتكرار
  const bySequence = new Map<number, AssetRow[]>();
  const byNameKey = new Map<string, AssetRow[]>();
  let invalidAssets = 0;
  const assetUpdates: Array<{ id: string; sequence_no: number | null; scan_status: "ok" | "rejected"; scan_message: string }> = [];

  for (const asset of assets) {
    const sequence = asset.sequence_no ?? sequenceFromFileName(asset.file_name);
    const badMime = !ALLOWED_MIME.includes(asset.mime_type);
    const empty = Number(asset.byte_size) < 512;
    if (badMime || empty) invalidAssets += 1;
    assetUpdates.push({
      id: asset.id,
      sequence_no: sequence,
      scan_status: badMime || empty ? "rejected" : "ok",
      scan_message: badMime ? "نوع ملف غير مسموح" : empty ? "ملف فارغ أو تالف" : "",
    });
    if (sequence != null) {
      bySequence.set(sequence, [...(bySequence.get(sequence) ?? []), asset]);
    }
    for (const key of [nameKey(asset.file_name), nameKey(asset.original_file_name), nameKey(asset.relative_path)]) {
      if (!key) continue;
      byNameKey.set(key, [...(byNameKey.get(key) ?? []), asset]);
    }
  }

  for (let i = 0; i < assetUpdates.length; i += 300) {
    await Promise.all(
      assetUpdates.slice(i, i + 300).map((update) =>
        supabaseAdmin
          .from("storage_asset_index")
          .update({
            sequence_no: update.sequence_no,
            scan_status: update.scan_status,
            scan_message: update.scan_message,
          })
          .eq("id", update.id),
      ),
    );
  }

  const duplicateSequences = Array.from(bySequence.entries())
    .filter(([, list]) => list.length > 1)
    .map(([sequence]) => sequence);

  // 2) مطابقة بالأولوية
  const byMethod: Record<string, number> = {};
  const byStatus: Record<string, number> = {};
  const usedAssets = new Set<string>();
  const seenSku = new Set<string>();

  const updates: Array<Record<string, unknown> & { id: string }> = [];
  for (const row of rows) {
    const data = row.normalized_data ?? ({} as NormalizedRow);
    const problems: string[] = [];
    let assetId: string | null = null;
    let method = "none";
    let confidence = "none";
    let reason = "";

    const explicitSequence = data.sequenceNo;
    const skuSequence = data.sku && /^\d+$/.test(data.sku) ? Number.parseInt(data.sku, 10) : null;

    const trySequence = (sequence: number | null, methodName: string, note: string) => {
      if (assetId || sequence == null) return;
      const list = bySequence.get(sequence);
      if (!list || list.length === 0) return;
      if (list.length > 1) {
        problems.push(`رقم تسلسلي مكرر (${sequence}) في الصور — ما اتعملش ربط تلقائي`);
        return;
      }
      assetId = list[0]!.id;
      method = methodName;
      confidence = "high";
      reason = note;
    };

    trySequence(explicitSequence, "sequence_no", "رقم تسلسلي صريح في الفهرس");

    if (!assetId) {
      const keys = [data.imageRelativePath, data.imageFileName].map(nameKey).filter(Boolean);
      for (const key of keys) {
        const list = byNameKey.get(key);
        if (!list) continue;
        if (list.length > 1) {
          problems.push("اسم صورة موثق مكرر في المخزن");
          break;
        }
        assetId = list[0]!.id;
        method = "original_file_name";
        confidence = "high";
        reason = "مسار/اسم الصورة الموثق في الفهرس";
        break;
      }
    }

    if (!assetId) trySequence(skuSequence, "sku_in_file_name", "كود الصنف SKU مكتوب في اسم ملف الصورة");

    if (!assetId) problems.push("مفيش صورة مطابقة موثوقة لهذا الصف");
    if (assetId && usedAssets.has(assetId)) {
      problems.push("الصورة مربوطة بصف آخر — تعارض");
      assetId = null;
      confidence = "low";
    }
    if (assetId) usedAssets.add(assetId);

    if (!data.name) problems.push("بدون اسم");
    if (!data.categoryName) problems.push("بدون فئة");
    if (data.price == null || data.price <= 0) problems.push("بدون سعر أساسي صالح");
    if (data.stock == null) problems.push("بدون كمية أو حالة مخزون صريحة");
    if (!data.sku) problems.push("بدون كود صنف");
    if (data.sku && seenSku.has(data.sku)) problems.push("كود صنف مكرر في الفهرس");
    if (data.sku) seenSku.add(data.sku);

    const needsVisual = Boolean(assetId) && confidence !== "high";
    const status = problems.length === 0 && confidence === "high" ? "ready" : "needs_review";

    byMethod[method] = (byMethod[method] ?? 0) + 1;
    byStatus[status] = (byStatus[status] ?? 0) + 1;

    updates.push({
      id: row.id,
      matched_asset_id: assetId,
      match_method: method,
      confidence,
      match_reason: reason,
      needs_visual_review: needsVisual,
      status,
      error_message: problems.join(" · "),
    });
  }

  for (let i = 0; i < updates.length; i += 200) {
    await Promise.all(
      updates.slice(i, i + 200).map(({ id, ...patch }) =>
        supabaseAdmin.from("catalog_import_rows").update(patch as never).eq("id", id),
      ),
    );
  }

  return {
    assets: assets.length,
    rows: rows.length,
    byMethod,
    byStatus,
    duplicateSequences: duplicateSequences.slice(0, 200),
    invalidAssets,
    unmatchedAssets: assets.length - usedAssets.size,
  };
}

async function ensureCategory(slug: string, name: string, cache: Map<string, string>): Promise<string | null> {
  if (!slug || !name) return null;
  const cached = cache.get(slug);
  if (cached) return cached;
  const { data: existing } = await supabaseAdmin
    .from("categories")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();
  if (existing?.id) {
    cache.set(slug, existing.id);
    return existing.id;
  }
  const { data: created } = await supabaseAdmin
    .from("categories")
    .insert({ slug, name, published: false, sort_order: cache.size + 1 })
    .select("id")
    .single();
  if (created?.id) cache.set(slug, created.id);
  return created?.id ?? null;
}

/**
 * استيراد idempotent للصفوف عالية الثقة والمكتملة فقط، كمسودات غير منشورة.
 * لا ينشر أي منتج ولا ينسخ أي صورة.
 */
export async function importReadyRows(
  batchId: string,
  rowIds?: string[],
): Promise<{ created: number; updated: number; variants: number; images: number; skipped: number; errors: number }> {
  let query = supabaseAdmin
    .from("catalog_import_rows")
    .select("id, row_number, normalized_data, matched_asset_id, status, created_product_id")
    .eq("batch_id", batchId)
    .eq("status", "ready")
    .limit(5000);
  if (rowIds && rowIds.length > 0) query = query.in("id", rowIds);
  const { data: rows, error } = await query;
  if (error) throw new Error(`READ_FAILED:${error.message}`);

  const assetIds = Array.from(
    new Set((rows ?? []).map((row) => row.matched_asset_id).filter((id): id is string => Boolean(id))),
  );
  const assetMap = new Map<string, string>();
  for (let i = 0; i < assetIds.length; i += 500) {
    const { data } = await supabaseAdmin
      .from("storage_asset_index")
      .select("id, storage_path")
      .in("id", assetIds.slice(i, i + 500));
    for (const asset of data ?? []) assetMap.set(asset.id, asset.storage_path);
  }

  const categoryCache = new Map<string, string>();
  const stats = { created: 0, updated: 0, variants: 0, images: 0, skipped: 0, errors: 0 };

  for (const row of rows ?? []) {
    const data = row.normalized_data as unknown as NormalizedRow;
    try {
      if (!data?.sku || !data.name || data.price == null || data.stock == null) {
        stats.skipped += 1;
        continue;
      }
      const categoryId = await ensureCategory(data.categorySlug, data.categoryName, categoryCache);
      const { data: existing } = await supabaseAdmin
        .from("products")
        .select("id, status")
        .eq("sku", data.sku)
        .maybeSingle();

      const productPayload = {
        slug: `${data.slug}-${data.sku}`.slice(0, 140),
        sku: data.sku,
        name: data.name,
        description: data.description,
        category_id: categoryId,
        unit: data.unit,
        is_fresh: false,
        available: false,
        is_complete: true,
        source_url: data.sourceUrl,
        search_text: `${data.name} ${data.description} ${data.sku} ${data.categoryName}`.trim(),
      };

      let productId = existing?.id ?? null;
      if (productId) {
        // لا نلمس حالة النشر لمنتج منشور بالفعل
        const patch =
          existing?.status === "published"
            ? { name: productPayload.name, description: productPayload.description, source_url: productPayload.source_url }
            : { ...productPayload, status: "draft" as const };
        await supabaseAdmin.from("products").update(patch as never).eq("id", productId);
        stats.updated += 1;
      } else {
        const { data: created, error: createError } = await supabaseAdmin
          .from("products")
          .insert({ ...productPayload, status: "draft" })
          .select("id")
          .single();
        if (createError || !created) throw new Error(createError?.message ?? "PRODUCT_INSERT_FAILED");
        productId = created.id;
        stats.created += 1;
      }

      const variantSku = `${data.sku}-1`;
      const { data: variant } = await supabaseAdmin
        .from("product_variants")
        .select("id")
        .eq("sku", variantSku)
        .maybeSingle();
      const variantPayload = {
        product_id: productId,
        sku: variantSku,
        size_label: data.sizeLabel,
        price: data.price,
        compare_at_price:
          data.compareAtPrice != null && data.compareAtPrice > data.price ? data.compareAtPrice : null,
        stock_quantity: data.stock,
        active: true,
        sort_order: 1,
      };
      if (variant?.id) {
        await supabaseAdmin.from("product_variants").update(variantPayload as never).eq("id", variant.id);
      } else {
        await supabaseAdmin.from("product_variants").insert(variantPayload as never);
      }
      stats.variants += 1;

      const storagePath = row.matched_asset_id ? assetMap.get(row.matched_asset_id) : undefined;
      if (storagePath) {
        const { data: image } = await supabaseAdmin
          .from("product_images")
          .select("id")
          .eq("product_id", productId)
          .eq("storage_path", storagePath)
          .maybeSingle();
        if (!image?.id) {
          await supabaseAdmin.from("product_images").insert({
            product_id: productId,
            bucket_id: IMPORTS_BUCKET,
            storage_path: storagePath,
            alt_text: data.name,
            sort_order: 1,
            published: false,
            asset_index_id: row.matched_asset_id,
          } as never);
        }
        stats.images += 1;
        await supabaseAdmin
          .from("storage_asset_index")
          .update({ linked_product_id: productId })
          .eq("id", row.matched_asset_id!);
      }

      await supabaseAdmin
        .from("catalog_import_rows")
        .update({ created_product_id: productId, status: "imported_draft", error_message: "" })
        .eq("id", row.id);
    } catch (importError) {
      stats.errors += 1;
      await supabaseAdmin
        .from("catalog_import_rows")
        .update({
          status: "failed",
          error_message: `فشل الاستيراد: ${importError instanceof Error ? importError.message : "خطأ غير معروف"}`,
        })
        .eq("id", row.id);
    }
  }

  return stats;
}

/** ملخص الدفعة للتقرير والمعاينة. */
export async function batchSummary(batchId: string): Promise<{
  statuses: Record<string, number>;
  methods: Record<string, number>;
  confidence: Record<string, number>;
  needsVisual: number;
  assets: number;
  linkedAssets: number;
  draftProducts: number;
  publishedProducts: number;
}> {
  const rows = await loadAll<{
    status: string;
    match_method: string;
    confidence: string;
    needs_visual_review: boolean;
  }>("catalog_import_rows", "status, match_method, confidence, needs_visual_review", batchId);

  const statuses: Record<string, number> = {};
  const methods: Record<string, number> = {};
  const confidence: Record<string, number> = {};
  let needsVisual = 0;
  for (const row of rows) {
    statuses[row.status] = (statuses[row.status] ?? 0) + 1;
    methods[row.match_method] = (methods[row.match_method] ?? 0) + 1;
    confidence[row.confidence] = (confidence[row.confidence] ?? 0) + 1;
    if (row.needs_visual_review) needsVisual += 1;
  }

  const { count: assets } = await supabaseAdmin
    .from("storage_asset_index")
    .select("id", { count: "exact", head: true })
    .eq("batch_id", batchId);
  const { count: linkedAssets } = await supabaseAdmin
    .from("storage_asset_index")
    .select("id", { count: "exact", head: true })
    .eq("batch_id", batchId)
    .not("linked_product_id", "is", null);
  const { count: draftProducts } = await supabaseAdmin
    .from("products")
    .select("id", { count: "exact", head: true })
    .eq("status", "draft");
  const { count: publishedProducts } = await supabaseAdmin
    .from("products")
    .select("id", { count: "exact", head: true })
    .eq("status", "published");

  return {
    statuses,
    methods,
    confidence,
    needsVisual,
    assets: assets ?? 0,
    linkedAssets: linkedAssets ?? 0,
    draftProducts: draftProducts ?? 0,
    publishedProducts: publishedProducts ?? 0,
  };
}
