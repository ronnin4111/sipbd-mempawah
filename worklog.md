---
Task ID: 1
Agent: Main
Task: Implement 4 feature requests for SIPBUDIK

Work Log:
- Updated stats API to separate Pembesaran (Kg) and Pembenihan (Ekor) production totals
- Fixed Total Kelompok to count unique group names (case-insensitive)
- Added password-protected column visibility on Data Produksi page
- Added inline edit/add/delete functionality on Data Produksi table with password protection
- Created CRUD API routes: POST /api/fish-farms/create, PUT /api/fish-farms/[id], DELETE /api/fish-farms/[id]
- Updated StatsResponse type in hooks to match new API response
- Updated dashboard stats cards to show Pembesaran (Kg) and Pembenihan (Ekor) separately
- Updated charts to show separated data (dual pie charts, grouped bar charts, separate trend lines)
- Updated report tables to show proper units per business type
- Updated export Excel route with proper unit separation
- Updated export PDF route with proper unit separation
- All pages returning 200 status code

Stage Summary:
- Feature 1: Column visibility now requires password (dkp2024) - click "Kolom" button prompts for password
- Feature 2: Pembesaran (Kg) and Pembenihan (Ekor) are now shown separately everywhere - dashboard cards, charts, tables, exports
- Feature 3: Total Kelompok now counts unique group names case-insensitively (e.g., "rezeki" = "Rezeki" = "REZEKI")
- Feature 4: Edit/Add/Delete available via "Admin" button on Data Produksi page - requires password to unlock
