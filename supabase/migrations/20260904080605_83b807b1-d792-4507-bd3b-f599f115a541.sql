UPDATE public.product_images pi
SET published = true, updated_at = now()
FROM public.products p
WHERE p.id = pi.product_id
  AND p.status = 'published'
  AND pi.published = false
  AND pi.storage_path IS NOT NULL
  AND pi.storage_path <> '';