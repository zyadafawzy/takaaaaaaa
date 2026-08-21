# Admin Page Overhaul & Optimization Plan

Implement a high-performance, visually stunning admin dashboard with proper database synchronization and new feature modules.

## User Goals
- **Fix Settings Persistence:** Ensure store settings save correctly to the database.
- **Scale Inventory:** Handle 1700+ products with server-side pagination and real-time DB updates (replace local storage patches).
- **Product Bundles (Packages):** Create a system for manual/automated bundles (e.g., Pasta Bukhari kit) with discounts.
- **Enhanced Sorting:** Add manual sort order control to feature specific products.
- **UI/UX Modernization:** Apply a high-end dark theme using OKLCH tokens for the dashboard and reports.

## Proposed Changes

### 1. Database & Backend
- **Migration:** (Already applied) `product_bundles`, `bundle_items`, and `sort_order` column.
- **Fix Settings RPC:** Debug and fix `upsert_app_setting` to ensure it persists to `app_settings` table.
- **Catalog Functions:**
    - Update `adminListProducts` to support full pagination and sorting by `sort_order`.
    - Create `adminSyncInventory` to batch update stock/availability directly to DB.
    - Add `adminBundleFunctions` for CRUD operations on packages.

### 2. Inventory Refactor
- **Infinite/Paginated Scroll:** Replace client-side filtering with server-side queries.
- **Direct DB Save:** Remove `adminStore` local storage overrides; updates now trigger Supabase mutations.
- **Search Optimization:** Ensure `ilike` search works efficiently on the large product set.

### 3. Product Packages (Bundles)
- **Bundle Management UI:** New route `/admin/bundles` to create kits.
- **Egyptian Market Presets:** Pre-populate some common bundles (e.g., "Full Breakfast", "Pasta Kit").
- **Storefront Integration:** Update product card/details to show "Frequently Bought Together" or "Bundle & Save".

### 4. Visual Overhaul
- **Dark Mode Optimization:** Fine-tune OKLCH variables in `src/styles.css` for higher contrast and "high-end" feel.
- **Dashboard Layout:** Add meaningful charts/reporting widgets (using mock logic or light DB aggregation).
- **Arabic Typography:** Ensure Cairo/IBM Plex Sans hierarchy is perfect for LTR/RTL readability.

## Technical Tasks
1. `src/lib/admin-catalog.functions.ts`: Refactor `adminListProducts` for performance.
2. `src/routes/admin.inventory.tsx`: Implement paginated data fetching and direct DB mutations.
3. `src/lib/admin-settings.functions.ts`: Fix settings persistence logic.
4. `src/routes/admin.settings.tsx`: Update UI to show success/fail states accurately.
5. `src/routes/admin.index.tsx`: Redesign dashboard with new visual identity.
6. `src/routes/admin.bundles.tsx`: Create the new bundle management interface.
7. `src/styles.css`: Enhance dark mode tokens.
