---
Task ID: 1
Agent: main
Task: Fix Excel import failure for sipbd-mempawah project

Work Log:
- Analyzed uploaded Excel file (data-perikanan-20260505.xlsx) - format is correct with matching headers
- Identified root cause: Turso database adapter (PrismaLibSql) was causing server crashes during write operations
- Changed db.ts to use local SQLite by default (Turso only when USE_TURSO=true env var is set)
- Cleared .next cache to remove stale Turso-compiled code
- Reduced import API batch size from 50 to 5-10 rows for stability
- Created new file-based import endpoint (/api/fish-farms/import-file) that processes Excel file server-side via FormData instead of large JSON payloads
- Updated frontend import dialog to use FormData-based file upload instead of chunked JSON
- Successfully imported 483 records from data-perikanan-20260505.xlsx
- Added progress indicator for import
- Added allowedDevOrigins to next.config.ts for preview panel

Stage Summary:
- Excel import now works reliably via file upload (FormData)
- Server uses local SQLite instead of Turso (more stable in sandbox)
- 483 records from the user's Excel file are in the database
- Frontend updated with better error messages and progress tracking

---
Task ID: 1
Agent: main
Task: Fix Vercel deployment returning 404 at https://sipbd-mempawah.vercel.app/

Work Log:
- Investigated Vercel deployment - API endpoints worked but / route returned 404
- Ran comprehensive SSR audit of all components in the page tree
- Identified critical issue: html2canvas-pro static import in pdf-export-dialog.tsx crashes SSR on Vercel
- Identified moderate issue: PdfDashboardCharts (recharts) always rendered during SSR
- Identified moderate issue: xlsx static import adds unnecessary SSR bundle weight
- Fixed export-section.tsx: replaced static PdfExportDialog import with next/dynamic + ssr:false
- Fixed page.tsx: replaced static PdfDashboardCharts import with next/dynamic + ssr:false
- Fixed import-dialog.tsx: replaced static XLSX import with dynamic import() inside parseExcelFile callback
- Verified local build succeeds after fixes
- Committed and pushed to GitHub (commit 248fae6)
- Vercel auto-rebuilt and deployed successfully - page now returns HTTP 200 with full content
- Verified API endpoints on Vercel: stats shows 483 RTP, 300 Kg Pembesaran, 9 Kecamatan

Stage Summary:
- Vercel deployment fixed - https://sipbd-mempawah.vercel.app/ now works correctly
- Root cause: browser-only libraries (html2canvas-pro, recharts, xlsx) were imported statically, causing SSR crash on Vercel
- Fix: use next/dynamic with ssr:false for browser-only components, and dynamic import() for xlsx
- Both local dev and Vercel deployment are now working
