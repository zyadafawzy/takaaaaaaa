# Plan: Storefront UX & Admin Robustness

Enhance the application's visual identity (based on the "Tekka" brand identity), fix performance/logic issues in the admin panel and cart, and implement new management features for delivery zones and WhatsApp automation.

## User Review Required

> [!IMPORTANT]
> - The new theme uses a palette of Deep Green (#1E4D3A), Lime Green (#7FB64B), and Yellow (#F2B705) as per the provided brand identity.
> - The WhatsApp integration will automatically use the number set in admin settings for all "Order via WhatsApp" actions.

## Proposed Changes

### 1. Visual Identity & Theme (Modern "Tekka" Style)
- **OKLCH System Update:** Refine `src/styles.css` with the new brand colors:
  - Primary: oklch(0.38 0.08 160) - Deep Green.
  - Success/Lime: oklch(0.72 0.14 145) - Lime Green.
  - Accent: oklch(0.75 0.16 85) - Brand Yellow.
- **Home Page Overhaul:** 
  - Update the Hero section to match the branding.
  - Add a "Our Values" (قيمنا) section as seen in the identity image (Quality, Speed, Trust).
  - Improve product grid spacing and card typography (Cairo font).

### 2. Admin Robustness & New Features
- **Delivery Zone Management:**
  - Add "Create Zone" (إضافة منطقة) functionality in `admin/settings`.
  - Add "Delete Zone" (حذف منطقة) functionality.
  - Fix zone list responsiveness.
- **WhatsApp Integration:**
  - Ensure the `whatsappNumber` from settings is dynamically injected into all storefront WhatsApp links.
  - Add a "Test WhatsApp" button in admin settings to verify the configured number.
- **Inventory Performance:**
  - Fix the "Quantity Stepper" issues (ensuring stock checks and state sync work for all products).
  - Add local optimistic updates to the inventory list for better responsiveness.

### 3. Storefront Performance & UX
- **Quantity Stepper Fix:** 
  - Debug and fix the "+" button behavior mentioned by the user.
  - Ensure the stepper handles fractional quantities (for KG items) vs integer (for pieces).
- **RTL/Arabic Polish:**
  - Audit all text alignments and ensuring consistent use of the Cairo font.

## Technical Details

- **Database:** No schema changes required for settings (already uses JSONB `app_settings`), but `delivery_zones` needs standard CRUD logic.
- **State Management:** Use TanStack Query `invalidateQueries` to ensure settings changes reflect immediately across the app.
- **Colors:**
  - `--primary`: #1E4D3A (oklch(0.38 0.08 160))
  - `--success`: #7FB64B (oklch(0.72 0.14 145))
  - `--accent`: #F2B705 (oklch(0.75 0.16 85))
