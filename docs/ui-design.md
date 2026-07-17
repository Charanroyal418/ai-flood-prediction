# UI/UX & Figma Design System

## 1. Design Philosophy
The FloodSense AI application interface is designed to evoke trust, urgency, and clarity. It must feel like a modern, premium SaaS application while retaining the authority of a government portal. It utilizes clean typography, ample whitespace, subtle glassmorphism for map overlays, and accessible high-contrast colors for alerts.

## 2. Figma Design System (Tokens)

### Colors
- **Primary Brand**: `#1A56DB` (Trustworthy Blue - Government feel)
- **Secondary**: `#FACC15` (Warning Yellow)
- **Background (Light Mode)**: `#F9FAFB`
- **Background (Dark Mode)**: `#111827` (Sleek dark mode for rescue teams operating at night)
- **Status/Alerts**:
  - **Critical/Danger**: `#E02424` (Red)
  - **Warning/High**: `#FF8A4C` (Orange)
  - **Normal/Safe**: `#31C48D` (Green)
- **Text**: `#1F2937` (Light mode) / `#F3F4F6` (Dark mode)

### Typography
- **Font Family**: `Inter` (Primary, Data heavy tables) & `Outfit` (Headings, Dashboard metrics)
- **Scale**:
  - H1: 32px Bold (Page Titles)
  - H2: 24px SemiBold (Section Headers)
  - Body: 16px Regular
  - Caption: 12px Medium (Timestamps, Map Legends)

### Grid & Spacing
- 12-column fluid grid system.
- 8pt spacing system (8, 16, 24, 32, 48, 64px) for padding and margins.

### Components
- **Buttons**: Fully rounded corners (`rounded-full`), soft drop shadows, hover micro-animations (scale 1.02, slight brightness increase).
- **Cards**: Glassmorphic effect on map overlays (backdrop-blur), solid white/dark-gray with slight border (`border-gray-200`) and soft shadow (`shadow-sm`) on dashboard.
- **Badges/Status Chips**: Pill-shaped with subtle background tint of the status color (e.g., `bg-red-100 text-red-800`).
- **Inputs**: Minimalist borders, focus ring matching primary brand color.
- **Dialogs/Modals**: Centered, blurred backdrop, dismissible.

## 3. Screen Designs & Layouts

### 1. Landing Page (Public)
- **Hero Section**: Dynamic vector illustration/map of TN, clear value proposition, "Check Local Status" search bar.
- **Live Ticker**: Scrolling active alerts from TNDMA across the top.
- **Navigation**: Clean header with Login/Signup, Maps, Public Guidelines.
- **Responsive**: Stacks to a vertical scroll on mobile.

### 2. Authentication (Login/Signup)
- **Layout**: Split screen. Left side contains a beautiful flood-rescue illustration or TN landscape. Right side contains a minimal, focused form.
- **Elements**: Roles dropdown for official logins (Collector vs Admin).

### 3. Main Dashboard (Admin/Collector)
- **Layout**: Sidebar navigation (collapsible), Top app bar (Profile, Global Search, Notifications).
- **Tamil Nadu Map**: Interactive choropleth map coloring districts by risk level.
- **Weather/Risk Cards**: Top row KPI cards (Active Alerts, Rivers at Danger Mark, Total Rainfall).
- **Charts**: Dual-axis line chart for Rainfall vs River Level over 7 days.
- **District Ranking**: Table ranking districts by vulnerability score with sparklines.

### 4. District Page (e.g., "Chennai District")
- **Header**: District name, Current Weather icon, Risk Status Chip.
- **Grid Layout**:
  - **Left Column**: Rainfall Trend (Bar chart), River Levels (Gauge charts).
  - **Right Column**: Recent Alerts timeline, Historical Floods summary, Safe Zones count.
- **Action Buttons**: "View Shelters", "Issue Alert" (if authorized).

### 5. Live GIS Map Screen
- **Full-Screen Map**: Mapbox base layer (Dark, Light, or Satellite view).
- **Floating Panel (Left)**: Layer toggles (District Boundaries, Flood Zones, Rainfall Radar, River Network, Shelters, Hospitals, Road Closures, Safe Routes).
- **Legend (Bottom Right)**: Color scales for water depth and risk.
- **Interactivity**: Clicking a river sensor point opens a tooltip with current discharge/level.

### 6. Alerts & Notifications
- **Alerts Feed**: Chronological list of warnings with severity styling.
- **Creation Modal**: Form for Collectors to draft and push alerts, previewing how it looks on SMS and App Push Notification.

### 7. Shelters & Relief Centers
- **Table View**: Sortable list of shelters by capacity, current occupancy, and resources.
- **Map View**: Points on a map with occupancy visualized by circle size.

### 8. Citizen Reports
- **Grid View**: Gallery of photo-reports (Waterlogging, road blocks) submitted by citizens, mapped to local areas.

### 9. Profile & Settings
- **Preferences**: Notification settings (SMS vs Email), Dark Mode toggle, Language selector (English/Tamil).

## 4. Accessibility & Responsiveness
- **Mobile First**: All citizen-facing pages (Landing, Alerts, Shelters) are optimized for mobile phones with bottom navigation bars.
- **WCAG 2.1 AA**: High contrast ratios for all text, screen-reader friendly aria-labels on GIS elements, and keyboard navigability for the dashboard.
