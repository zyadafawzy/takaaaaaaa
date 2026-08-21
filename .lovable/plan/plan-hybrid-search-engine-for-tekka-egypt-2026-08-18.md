# Plan: Hybrid Search Engine for Tekka (Egypt)

Implement a production-ready search system using the provided index of 15,000 aliases, focusing on Egyptian market context and Arabic normalization.

## 1. Database & Data Import
- Create `search_aliases` table to store synonyms, typos, and Egyptian terms.
- Add `search_events` table for analytics (queries, click-through).
- Create a server-side importer for `تكة_فهرس_البحث_الذكي_15000.csv` to `search_aliases`.
- **Constraint:** SKUs in the CSV must match existing products; no phantom products.

## 2. Arabic Search Service
- Implement `normalizeText` utility (Arabic normalization: ا/أ/إ -> ا, ى -> ي, remove tashkeel).
- Build a multi-layered `unifiedSearch` server function:
  1. **SKU Exact:** Direct match (Score 1000).
  2. **Product Name Exact:** (Score 900).
  3. **Alias Exact:** Matching `search_aliases` (Score 800+).
  4. **Prefix/Token Match:** (Score 550+).
  5. **Typo Tolerance:** (Score 300, only for long queries).
- Group results by SKU to avoid duplicates.
- Apply boosts for availability (out of stock = lower rank).

## 3. UI/UX Refactor
- **Home Search:** Update placeholder and autocomplete logic.
- **Search Results (/search):**
  - Debounce input (250ms).
  - RTL-first cards with clear stock status.
  - "No results" handling with smart suggestions.
- **Admin Dashboard:**
  - Search Alias management (Approve/Reject/Weight).
  - Zero-result query reporting.
  - Audit logs for all search configuration changes.

## Technical Details
- **Tables:**
  - `public.search_aliases` (id, sku, search_term, normalized_term, match_type, weight, review_status).
  - `public.search_events` (id, query_original, query_normalized, results_count, clicked_sku).
- **Index:** `normalized_term` (B-tree) on `search_aliases`.
- **Logic:** Server-side ranking in `src/lib/catalog.server.ts`.
- **Accessibility:** ARIA labels in Arabic, keyboard navigation support.

## Acceptance Criteria
- "Indomie" and variants ("اندومي", "إندومي") show the same results.
- SKU search works instantly.
- Egyptian terms ("فراخ" -> "دجاج") map correctly.
- Admin can review and approve new aliases.
- No duplicate cards for the same product in results.
