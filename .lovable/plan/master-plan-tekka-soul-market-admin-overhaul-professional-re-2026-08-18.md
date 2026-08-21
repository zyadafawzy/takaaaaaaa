# Master Plan: Tekka / Soul Market Admin Overhaul & Professional Redesign

This plan follows the Master Prompt guidelines provided by the user to transform "Tekka" into a high-end, commercial-grade super-market platform.

## Phase 1: Data Infrastructure & Catalog Fixes
*   **Audit current schema**: Verify relations between `categories`, `products`, and `product_variants`.
*   **Fix catalog loading**: Address issues in `src/lib/catalog.functions.ts` to ensure all 1700+ products and their variations load correctly.
*   **Implement Server-side Pagination**: Transition from client-side filtering to server-driven catalog and order management.

## Phase 2: Design System & Mobile Optimization
*   **Visual Refresh**: Apply a cohesive minimal Arabic UI using Cairo (headings) and IBM Plex Sans (numbers).
*   **Theme Tokens**: Strict adherence to `styles.css` variables (Primary oklch(0.72 0.14 152), BG oklch(0.19 0.02 150)).
*   **Mobile-First UX**: Ensure tap targets are 44px+, safe-area-insets are respected, and navigation is thumb-friendly.

## Phase 3: Order Management Center (Admin)
*   **Unified Dashboard**: New admin routes for order processing with status-based counters.
*   **Role-Based Access Control (RBAC)**: Enforce permissions for `order_operator`, `store_manager`, `inventory_operator`, etc.
*   **Order Workflow**:
    *   `new` -> `awaiting_whatsapp` -> `preparing` -> `out_for_delivery` -> `delivered`.
    *   Integrated WhatsApp preview and triggers within the admin order card.

## Phase 4: Customer Tracking & Professional WhatsApp
*   **Tracking Page**: Professional timeline, RTL-safe, with product snapshots and status badges.
*   **WhatsApp Templates**: Refined messages with *Bold* and `Monospace` formatting, including one-click tracking links.

## Phase 5: Inventory & Catalog Administration
*   **SKU Management**: Tools for safe price updates, stock movements, and scheduled offers (`offer_until`).
*   **Audit Logging**: Every sensitive change (price, status, stock) recorded in `audit_logs`.

## Phase 6: Analytics & Hardening
*   **Store Analytics**: Funnel tracking, zero-result search reporting, and revenue metrics.
*   **Security**: RLS policy audit and hardening of all server functions.

## Technical Execution Steps
1.  **Read & Map**: Finalize mapping of all `createServerFn` to their respective server modules.
2.  **Migration**: Prepare SQL for any missing columns (e.g., `offer_until`, `audit_logs` fields).
3.  **Iterative Deployment**: Deploy one phase at a time with verified build outputs.

---
**Status**: Ready to proceed with Phase 1 after approval.
