---
Task ID: 1
Agent: Main Agent
Task: Add Nama Pembudidaya and Nama Kelompok columns to production data table

Work Log:
- Added `farmerName` (String, default "") and `groupName` (String, default "") to Prisma schema
- Pushed schema changes with `bun run db:push` and regenerated Prisma client
- Added `farmerName` and `groupName` to FishFarm interface in use-fish-farms.ts hook
- Added `farmerName` and `groupName` columns to data-table.tsx with proper formatting
- Added column visibility labels for the new columns
- Updated all API routes (main, stats, export, export-pdf, import) to include new fields in search OR clause
- Updated export route to include new columns in Excel headers/rows
- Updated import route to accept and store new fields
- Updated import dialog to include new fields in REQUIRED_HEADERS and preview table
- Updated seed.ts with realistic Indonesian farmer names and group names
- Re-seeded database with new data

Stage Summary:
- Database now includes farmerName and groupName fields with data
- Data table shows two new columns: "Nama Pembudidaya" and "Nama Kelompok"
- Import/export functionality supports the new fields
- Search functionality includes the new fields

---
Task ID: 2
Agent: Main Agent
Task: Make year filter dynamic based on database data

Work Log:
- Created new API endpoint `/api/fish-farms/years/route.ts` that returns distinct years from database
- Added `useAvailableYears` hook in use-fish-farms.ts with 5-minute cache
- Updated filter-bar.tsx to use dynamic years from API instead of static YEARS constant
- Updated YEARS constant to include 2025 for seed data
- Re-seeded database to include 2025 records

Stage Summary:
- Year filter now dynamically loads available years from database
- If 2025 data is imported, it automatically appears in the year filter
- Fallback to static years if API hasn't loaded yet

---
Task ID: 3
Agent: Main Agent
Task: Implement Leaflet marker clustering with hierarchy

Work Log:
- Installed `leaflet.markercluster` and `@types/leaflet.markercluster` packages
- Completely rewrote map-inner.tsx with MarkerClusterGroup implementation
- Custom cluster icons with color-coded size (small/medium/large) based on count
- Kecamatan-level custom icon with name and count for fallback mode
- Clustering disabled at zoom level 15+ so individual markers show
- Chunked loading for performance with large datasets
- Detailed popup content with fish type, business type, production, and farmer name
- SpiderfyOnMaxZoom and zoomToBoundsOnClick enabled for UX

Stage Summary:
- Map now uses leaflet.markercluster for automatic marker grouping
- Zoom out: markers cluster by proximity (kecamatan-level grouping)
- Zoom in: clusters split to desa-level and then individual markers
- Individual markers show at zoom 15+
- Custom styled cluster icons with count badges
