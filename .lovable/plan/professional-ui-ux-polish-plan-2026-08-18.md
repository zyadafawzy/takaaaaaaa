# Professional UI/UX Polish Plan

Elevate the project's visual identity to a "premium" level using advanced CSS techniques, refined typography, and cohesive design tokens, while maintaining the established Egyptian supermarket identity.

## Design Refinements
- **Typography**: Refine Cairo and IBM Plex Sans scales for better hierarchy.
- **Glassmorphism**: Apply consistent `.glass` effects to floating UI (Header, Nav, Cart summary).
- **Gradients & Shadows**: Implement a custom shadow system (`--shadow-premium`) and subtle oklch-based mesh gradients for depth.
- **Micro-interactions**: Add spring-based hover effects and smooth layout transitions.
- **Color Consistency**: Tighten the oklch palette to ensure high contrast and a "high-end" dark mode.

## Implementation Details

### 1. Global Styles (`src/styles.css`)
- Define refined shadow tokens (`--shadow-inner`, `--shadow-glow`).
- Update the `@theme` block with premium spacing and radius variables.
- Add utility classes for `.text-balance` (Arabic support) and `.premium-card`.

### 2. Layout Components
- **SiteHeader**: Enhance glass effect and add a subtle bottom border glow.
- **BottomNav**: Refine the floating island design with better active states and backdrop filters.
- **ProductCard**: Implement a "card-in-card" depth effect, smoother image transitions, and improved price prominence.

### 3. Interactive Elements
- **Buttons**: Add subtle internal glows and scale-on-press micro-interactions.
- **QuantityStepper**: Redesign with a more tactile, "premium physical" feel.
- **Skeletons**: Update with faster, smoother pulse animations.

### 4. Route Refinements
- **Home (`/`)**: Add a sophisticated background noise texture and refined section spacing.
- **Product Page**: Improve the image gallery and technical details presentation.

## Technical Details
- **Colors**: Strictly using `oklch` for better chroma control in dark/light transitions.
- **Animations**: CSS transitions with `cubic-bezier(0.34, 1.56, 0.64, 1)` for a "bouncy" premium feel.
- **Performance**: Ensuring `backdrop-filter` usage is optimized for mobile performance.
