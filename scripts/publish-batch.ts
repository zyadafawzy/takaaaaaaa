import { supabaseAdmin } from "@/integrations/supabase/client.server";

async function main() {
  const batchId = "0778f52a-fa79-4429-9b9b-735e99877a24";
  console.log(`Publishing all products and images for batch: ${batchId}`);

  try {
    // Find all products created by this batch (even if already imported_draft)
    const { data: rows } = await supabaseAdmin
      .from("catalog_import_rows")
      .select("created_product_id")
      .eq("batch_id", batchId)
      .not("created_product_id", "is", null);

    const productIds = (rows ?? [])
      .map(r => r.created_product_id)
      .filter((id): id is string => Boolean(id));

    if (productIds.length > 0) {
      console.log(`Publishing ${productIds.length} products...`);
      
      // Batch updates to avoid timeouts or limits
      for (let i = 0; i < productIds.length; i += 200) {
        const chunk = productIds.slice(i, i + 200);
        
        await supabaseAdmin
          .from("products")
          .update({
            status: "published",
            visible: true,
            available: true,
            published_at: new Date().toISOString()
          } as never)
          .in("id", chunk);

        await supabaseAdmin
          .from("product_images")
          .update({ published: true } as never)
          .in("product_id", chunk);
          
        console.log(`Progress: ${i + chunk.length}/${productIds.length}`);
      }
      
      console.log("Updating import status...");
      await supabaseAdmin
        .from("catalog_import_rows")
        .update({ status: "imported_published" } as never)
        .eq("batch_id", batchId)
        .not("created_product_id", "is", null);
    }

    console.log("Success! Products and images are now live.");
  } catch (error) {
    console.error("Critical error:", error);
    process.exit(1);
  }
}

main();
