# Plan - Multi-Tenant Supermarket Platform Completion

Comprehensive implementation of store creation features, dynamic delivery zones, AI-generated assets, and advanced admin controls.

## User Experience (Storefront)
- **Advanced Theme System**: Implement Light/Dark mode toggles for each store based on their branding configuration.
- **Scrollable Catalog**: Update storefront catalog to support infinite scroll/large lists for 1700+ products, showing image, description, and price clearly.
- **Dynamic Delivery Zones**: Implement hierarchical location selection (Governorate -> Area) for storefront delivery calculation.

## Store Creation & Control
- **Developer Control Center Enhancements**: 
  - Add Logo and Hero image upload during store creation.
  - Implement AI Image generation integration (via Lovable AI Gateway) to provide stock images for store menus/categories.
  - Add "Delivery Zones" configuration to the store creation wizard.
- **Admin Authentication Overhaul**:
  - Replace Email/Password login for store dashboards with a single "Admin Password" box at `/s/$slug/dash-admin`.
  - Password management moved to the Developer Control Center (Platform Owner).

## Technical Details
- **Database Schema**: 
  - Extend `stores` table to include `admin_password_hash`.
  - Add `location_tree` table or similar for hierarchical Egyptian governorates/areas.
- **Server Functions**:
  - `generateStoreAsset`: AI image generation function.
  - `updateStoreAdminPassword`: Secure password hashing for store dash.
- **Components**:
  - `LocationSelector`: Two-step dropdown for shipping address.
  - `StoreCatalogList`: Virtualized or efficient large-list renderer for products.

## Security
- Store admin passwords will be salted and hashed.
- Access to dashboard via single password will still be session-based once verified.
- Platform owner overrides remain fixed to fixed owner email.

---
*Verified project status: Supabase connection active. Admin routes for reports, team, and settings exist. Catalog is multi-tenant.*
