---
Task ID: 1
Agent: main
Task: Implement Media Sosial (Social Media) section for SIPBD website

Work Log:
- Added `SocialMediaPost` model to Prisma schema with fields: platform, postUrl, embedUrl, caption, thumbnailUrl, isPinned, sortOrder, isActive, addedBy
- Ran `bun run db:push` to create the table
- Created API routes:
  - `/api/social-media` — GET (list posts), POST (add post), PUT (update post), DELETE (delete post)
  - `/api/social-media/accounts` — GET (list social media account links), POST (save account links)
- API routes include admin password verification for write operations
- Auto-generates embed URLs from post URLs for Instagram, YouTube, TikTok, Facebook, Twitter
- Created `MediaSosialSection` component with:
  - Beautiful Instagram-style gradient header banner
  - Social media account cards (Instagram, Facebook, YouTube) with links
  - Platform filter tabs (All, Instagram, YouTube, etc.)
  - Posts gallery with embedded content (iframe for Instagram, YouTube, TikTok, Facebook)
  - Fallback link cards for unsupported embed types
  - Expandable post modal for Instagram posts
  - Empty state when no posts exist
  - Full admin panel with 3 tabs: Add Post, Manage Posts, Accounts
  - Admin can add posts by URL, pin/unpin, show/hide, reorder, delete
  - Admin can configure social media account links (display name, username, URL)
- Added "Media Sosial" navigation item to NAV_ITEMS in constants.ts (with Share2 icon)
- Added MediaSosialSection to page.tsx switch statement
- Fixed SQLite sorting issue (can't sort by boolean DESC) — moved pinned-first sort to JS
- Added 3 demo posts for testing (2 Instagram, 1 YouTube)
- Verified all API endpoints return correct data
- No lint errors in new files

Stage Summary:
- Fully functional Media Sosial section integrated into SIPBD website
- Supports Instagram, Facebook, YouTube, TikTok, Twitter platforms
- Admin panel for managing posts and account links
- Instagram posts embed via iframe using `/embed/` URL pattern
- YouTube videos embed via standard iframe
- Demo data seeded for initial testing
