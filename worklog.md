---
Task ID: 1
Agent: Main
Task: Implement 3 new features for SIPBUDIK - PDF export with checklist, bar chart value labels, and search filter fix

Work Log:
- Read and analyzed all relevant source files (charts, export-section, pdf-export route, filter-bar, data-table, stats API, hooks, report-tables)
- Installed html2canvas and html2canvas-pro for chart capture in PDF
- Fixed search filter badge count (was not counting search term, showing 0 when only search active)
- Added search badge to active filter badges display
- Fixed case-insensitive search in export-pdf route (added ciContains helper)
- Added renderBarLabel function to charts.tsx for showing values on top of bar charts
- Applied label prop to both KecamatanBarChart and ContainerBarChart Bar components
- Increased chart height and top margin to accommodate labels
- Added id attributes to chart DOM elements for html2canvas capture
- Created PdfExportDialog component with 8 section checkboxes (5 tables + 3 charts)
- Updated ExportSection to use new PDF dialog instead of direct download
- Rewrote PDF generation client-side using jsPDF + html2canvas + jspdf-autotable
- Fixed TypeScript errors with Recharts label prop type and dynamic JSON data typing

Stage Summary:
- Feature 1 (PDF checklist): Complete - Users can now select which sections to include in PDF export via a dialog with checkboxes for 8 sections
- Feature 2 (Bar chart labels): Complete - Bar charts now display values at the top of each bar for readability in PDF
- Feature 3 (Search fix): Complete - Badge count now includes search term, search badge displayed in active filters, export-pdf route uses case-insensitive search
- Key files modified: charts.tsx, filter-bar.tsx, export-section.tsx, export-pdf/route.ts
- Key files created: pdf-export-dialog.tsx
