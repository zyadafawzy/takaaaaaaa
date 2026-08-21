import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { IMPORTS_BUCKET, CATALOG_FILES_PREFIX } from "@/lib/admin-import.constants";
import { ingestIndexRows, parseIndexFile, matchBatch, importReadyRows, batchSummary } from "@/lib/catalog-import.server";

const batchId = "0778f52a-fa79-4429-9b9b-735e99877a24";
const local = "/mnt/user-uploads/فهرس_طلبات_مارت_بالعربية.json";
const fileName = "فهرس_طلبات_مارت_بالعربية.json";
const storagePath = `${CATALOG_FILES_PREFIX}/${batchId}/index.json`;

const text = await Bun.file(local).text();
const up = await supabaseAdmin.storage.from(IMPORTS_BUCKET).upload(storagePath, new Blob([text], { type: "application/json" }), { upsert: true, contentType: "application/json" });
console.log("upload", up.error?.message ?? "ok");
await supabaseAdmin.from("catalog_import_batches").update({
  index_file_bucket_id: IMPORTS_BUCKET, index_file_path: storagePath, index_file_name: fileName,
  index_file_format: "json", kind: "mixed", status: "ready_for_scan",
}).eq("id", batchId);

const records = parseIndexFile(text, "json");
console.log("records", records.length, Object.keys(records[0] ?? {}));
console.log(await ingestIndexRows(batchId, records, fileName));
const m = await matchBatch(batchId);
console.log("match", JSON.stringify(m).slice(0, 800));
const imp = await importReadyRows(batchId);
console.log("import", imp);
console.log("summary", await batchSummary(batchId));
