# PRD: Interactive Masterplan (Plots + Availability + Admin Labeling)

## 1. Overview
This document defines requirements for an interactive real-estate **Masterplan** experience: a large masterplan image overlaid with color-coded plot labels (Available / Reserved / Sold). End-users can explore and click plots to see detailed information in a side panel. Administrators can precisely position labels via drag-and-drop and persist those positions via backend storage.

## 2. Goals
- Provide an immersive, high-quality Masterplan experience with:
  - Smooth pan/zoom interaction on a high-resolution masterplan image
  - Clearly visible plot labels with status colors
  - Clickable plots that open a polished details side panel
- Provide an Admin workflow to:
  - Create/edit plot metadata
  - Drag/drop plot labels with high positional accuracy
  - Save the final label coordinates to a persistent backend

## 3. Non-Goals
- Payments, booking/checkout, CRM integration
- Complex authentication/role management (can be added later)
- Advanced GIS features (parcel boundaries, polygon selection) in the first release

## 4. Personas
- **Visitor / Buyer**
  - Explores availability and information about units/plots
  - Uses masterplan as primary navigation to inventory
- **Sales Agent**
  - Uses masterplan to quickly answer availability questions
  - Opens plot details to communicate specs
- **Admin / Content Manager**
  - Positions plot labels precisely
  - Maintains plot details and status updates

## 5. User Stories
### 5.1 Visitor
- As a visitor, I can pan/zoom the masterplan image so I can inspect plots.
- As a visitor, I can identify plot availability by label color and legend.
- As a visitor, I can click a plot label to view plot details in a side drawer.
- As a visitor, I can open a map link to view the location on Google Maps.

### 5.2 Admin
- As an admin, I can toggle Admin mode to enable label repositioning.
- As an admin, I can drag/drop plot labels precisely on the masterplan image.
- As an admin, I can save the updated label positions to the backend.
- As an admin, I can change plot status (Available/Reserved/Sold).
- As an admin, I can edit plot details (area, bedrooms, bathrooms, description, blueprint, maps link).

## 6. Functional Requirements

### 6.1 Masterplan Canvas
- **Masterplan image**
  - Single large image displayed as the base layer
  - Supports high-resolution sources (e.g., 4K+) without becoming blurry when zooming in (within reasonable bounds)
- **Navigation**
  - Pan via click-drag / touch drag
  - Zoom via mouse wheel; optional pinch-to-zoom on touch devices
  - Provide a “Reset view” control to return to a fit-to-view baseline
- **Legend**
  - Visible status legend:
    - Green = Available
    - Yellow = Reserved
    - Red = Sold

### 6.2 Plot Labels
- Each plot has a label:
  - Visible at all zoom levels in a readable size (may scale with zoom or stay screen-sized depending on final UX)
  - Color-coded by status
- Clicking a label opens plot details.
- Label positions must be **stable** across viewport sizes.

### 6.3 Plot Details Side Drawer
When a user clicks a plot label, display a right-side drawer with:
- Plot ID / label
- Status badge
- Blueprint preview image
- Key metrics:
  - Area (sqft or m², configurable)
  - Bedrooms
  - Bathrooms
- Description
- CTA button: **Open in Google Maps**

### 6.4 Admin Label Positioning
- Admin mode can be enabled (e.g., via route, environment flag, or auth/role in later phase).
- In Admin mode:
  - Plot labels are draggable
  - Dragging updates coordinates in real-time
  - A “Save positions” button persists the new coordinates
  - UI indicates “unsaved changes”

### 6.5 Backend Persistence
- Provide a backend endpoint for reading plot data and saving updates.
- The backend must persist:
  - Plot label coordinates
  - Plot status
  - Plot metadata

## 7. Data Model (Conceptual)
### 7.1 Plot
- `id`: string (unique)
- `label`: string
- `status`: enum(`available`, `reserved`, `sold`)
- `position`:
  - Recommended: **normalized coordinates** relative to image size
  - `x`: number in [0..1]
  - `y`: number in [0..1]
- `blueprintSrc`: asset URL
- `area`: number
- `bedrooms`: number
- `bathrooms`: number
- `description`: string
- `mapsUrl`: string

### 7.2 Masterplan Image
- `src`: asset URL
- `width`: number (pixels)
- `height`: number (pixels)

## 8. UX / UI Requirements
- Visual quality: modern, premium real-estate aesthetic
- Smooth interactions:
  - Pan/zoom should feel responsive
  - Drawer should animate in/out
- Accessibility:
  - Labels should have sufficient contrast
  - Drawer should be keyboard-closable (Escape)
  - Focus management (move focus into drawer on open)

## 9. Accuracy Requirements (Label Positioning)
- Admin positioning must allow high accuracy.
- Coordinates should be stored in a resolution-independent way.
- Recommended behavior:
  - Use normalized coordinates (0..1) tied to base image dimensions
  - Ensure pointer-to-image coordinate conversion is precise
  - Optional “nudge” controls (keyboard arrows) for sub-pixel adjustments in later phase

## 10. Edge Cases & Error Handling
- Missing blueprint image: show a fallback state
- Backend save failure: preserve unsaved state in UI and show error feedback
- Invalid plot data: ignore invalid records and log/display a safe error

## 11. Security & Admin Controls (Future-Ready)
- Phase 1 may rely on an admin flag.
- Later phases should include:
  - Authentication (admin login)
  - Role-based access control for editing
  - Audit trail (who changed plot status/position)

## 12. Analytics (Optional)
- Track plot clicks (which units attract attention)
- Track usage of filters/status legend interactions

## 13. Acceptance Criteria
- User can open Masterplan page and:
  - Pan and zoom smoothly
  - See legend and plot labels with correct colors
  - Click a label to open a side drawer with plot details
  - Use Google Maps CTA successfully
- Admin can:
  - Enable Admin mode
  - Drag plot labels to new positions
  - Save positions and see them persist on refresh

## 14. Phases (No timing)
### Phase 1 — Core Masterplan Experience
- Masterplan image view with pan/zoom
- Status legend + colored plot labels
- Plot details side drawer with blueprint + specs + description + maps link
- Demo data wired end-to-end

### Phase 2 — Admin Positioning & Persistence
- Admin mode toggle
- Drag/drop label repositioning
- Save positions to backend + load persisted positions
- Basic error handling + unsaved-change indicator

### Phase 3 — Content Management Enhancements
- UI to add/edit plots (status, metadata, blueprint, maps link)
- Search/filter plots by status/ID
- Bulk status updates

### Phase 4 — Authentication & Permissions
- Admin login
- Role-based permissions
- Audit logs for changes

### Phase 5 — Production Hardening & Quality
- Accessibility improvements (focus, keyboard, ARIA)
- Mobile-first touch interactions (pinch zoom, label selection)
- Performance (image tiling or progressive loading if needed)
- Monitoring and analytics events
