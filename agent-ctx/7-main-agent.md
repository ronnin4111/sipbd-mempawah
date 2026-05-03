# Task 7 - Fix charts not readable in PDF exports

## Summary
Fixed PDF chart rendering by switching to html2canvas-pro and repositioning PDF charts in the viewport.

## Changes Made

### 1. `/home/z/my-project/src/components/import-export/pdf-export-dialog.tsx`
- **Import change**: `html2canvas` → `html2canvas-pro` (better SVG support)
- **Pre-capture delay**: Added 800ms wait before chart capture loop
- **html2canvas options**: Added `allowTaint: true`, `width: el.scrollWidth`, `height: el.scrollHeight`
- **Retry logic**: 3 attempts with 500ms delay between retries
- **Validation**: Check `canvas.width > 0 && canvas.height > 0` before accepting capture

### 2. `/home/z/my-project/src/components/dashboard/charts.tsx`
- **Container positioning**: Changed from `position: absolute, left: -10000px` to `position: fixed, left: 0, top: 0, zIndex: -9999, pointerEvents: none`
- Charts are now in the viewport (ResponsiveContainer needs this for dimension calculation)
- Behind all other content (z-index: -9999) so not visible to users
- No opacity:0 or visibility:hidden (html2canvas requires visible elements)

## Lint Results
All lint errors are pre-existing and unrelated to these changes.
