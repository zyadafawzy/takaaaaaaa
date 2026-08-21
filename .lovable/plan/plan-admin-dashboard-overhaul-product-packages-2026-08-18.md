# Plan - Admin Dashboard Overhaul & Product Packages

Fixing admin settings, upgrading inventory visibility, and implementing product packages (bundles) with a high-end dark theme.

## User Review Required

> [!IMPORTANT]
> - I will be adding new tables (`product_bundles`, `bundle_items`) to handle the packages feature.
> - The inventory page will be switched to server-side pagination to handle all 1700+ products instead of just a few.
> - The admin visual style will be unified into a modern dark theme using our OKLCH palette.

## Proposed Changes

### 1. Fix Admin Settings
- Debug `adminUpdateSettings` server function and `upsert_app_setting` RPC.
- Ensure all form fields in `src/routes/admin.settings.tsx` correctly sync with the backend.
- Add success/error feedback that actually reflects the operation result.

### 2. High-Performance Inventory
- Replace the client-side filtering in `src/routes/admin.inventory.tsx` with server-side pagination.
- Allow viewing and editing all 1700+ products by fetching pages from Supabase.
- Add advanced search (name, SKU) that runs on the server.

### 3. Product Packages (Bundles)
- Implement `product_bundles` and `bundle_items` schema.
- Create an Admin UI to manage packages (Manual creation).
- Seed initial packages for the Egyptian market:
    - **Pasta Bukhari Package**: Pasta, tomato paste, spices, oil.
    - **Cream Caramel Package**: Milk, cream caramel powder, sugar.
    - **Breakfast Package**: Indomie, Pepsi, Cola (as requested).
- Feature these packages on the storefront.

### 4. Admin Visual & UX Upgrade
- Apply a modern dark theme to all admin pages (`admin.index.tsx`, `admin.inventory.tsx`, `admin.reports.tsx`).
- Enhance reports with more data: Revenue trends, cancellation rates per week, top categories.
- Add a "Sort Order" management tool in the admin catalog to let admin decide which products appear first.

### 5. SAS / Security Integration
- Strengthen `admin-guard.server.ts` checks.
- Audit all admin actions to the `audit_logs` table.

## Technical Details

- **Database**: Migration file `tmp/migration.sql` for bundles and `sort_order`.
- **Server Functions**: New `admin-bundles.functions.ts` for bundle management.
- **State Management**: Switch from `adminStore` (local storage) to direct Supabase calls for inventory and orders.
- **Styling**: Tailwind v4 with OKLCH semantic tokens.

```text
Database Schema:
product_bundles (id, name, slug, description, discount, active)
bundle_items (bundle_id, product_id, quantity)
```

## Next Steps

1. Apply the database migration.
2. Fix the settings persistence bug.
3. Refactor inventory to handle large datasets.
4. Build the bundle management UI and storefront display.
