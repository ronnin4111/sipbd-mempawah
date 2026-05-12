---
Task ID: 1
Agent: main
Task: Fix AI chat returning "data tidak ada" for pembenih and anggota queries

Work Log:
- Investigated database structure: FishFarm table with businessType (Pembesaran/Pembenihan), groupName, farmerName
- Queried Turso production DB: 52 groups total, 15 Pembenihan, 37 Pembesaran, 0 both
- Identified root causes: (1) data context didn't include businessTypes per group, (2) targeted search didn't match on businessType, (3) member names not available for "anggota" queries
- Added RINGKASAN JENIS USAHA section to data context with Pembesaran/Pembenihan breakdown
- Added DAFTAR KELOMPOK PEMBENIHAN and PEMBESARAN lists in data context
- Show {Pembesaran/Pembenihan} business type in each group listing entry
- Added businessType matching in targeted search (including 'pembenih' → 'Pembenihan' fuzzy match)
- Added all-group member listing when searchTerms empty but questionType=specific
- Improved extractSearchTerms to skip business type keywords (pembenih/pembenihan/pembesaran)
- Added pembenih/pembesaran patterns to question classification
- Updated system prompt with anti-hallucination rules for data availability
- Seeded local SQLite from Turso for local testing (477 records)
- Verified data context endpoint returns correct business type data
- Pushed to GitHub for Vercel auto-deployment

Stage Summary:
- Data context now shows: 52 groups total, 15 Pembenihan, 37 Pembesaran
- Business types are properly included in group data
- AI should now correctly answer "berapa kelompok pembenih" → 15
- AI should now correctly list members of any kelompok
- Deployed to GitHub: commit a45154e
