import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { importReadyRows } from "@/lib/catalog-import.server";

async function main() {
  const batchId = "0778f52a-fa79-4429-9b9b-735e99877a24";
  console.log(`Starting final import for batch: ${batchId}`);

  try {
    const stats = await importReadyRows(batchId);
    console.log("Import Stats:", JSON.stringify(stats, null, 2));

    // Now, publish all draft products that were just imported
    console.log("Publishing imported products...");
    const { data: rows } = await supabaseAdmin
      .from("catalog_import_rows")
      .select("created_product_id")
      .eq("batch_id", batchId)
      .eq("status", "imported_draft");

    const productIds = (rows ?? [])
      .map(r => r.created_product_id)
      .filter((id): id is string => Boolean(id));

    if (productIds.length > 0) {
      console.log(`Publishing ${productIds.length} products...`);
      const { error: pError } = await supabaseAdmin
        .from("products")
        .update({
          status: "published",
          visible: true,
          available: true,
          published_at: new Date().toISOString()
        } as never)
        .in("id", productIds);

      if (pError) console.error("Error publishing products:", pError.message);

      console.log("Publishing images for these products...");
      const { error: iError } = await supabaseAdmin
        .from("product_images")
        .update({ published: true } as never)
        .in("product_id", productIds);

      if (iError) console.error("Error publishing images:", iError.message);
      
      console.log("Updating import rows status to imported_published...");
      await supabaseAdmin
        .from("catalog_import_rows")
        .update({ status: "imported_published" } as never)
        .in("created_product_id", productIds);
    }

    console.log("Success! All ready items imported and published.");
  } catch (error) {
    console.error("Critical error during import:", error);
    process.exit(1);
  }
}

main();
