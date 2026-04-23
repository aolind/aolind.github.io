---
name: citation-analysis
description: Analyze academic citation snapshots and generate report.html from the report template. Invoke when user asks to regenerate the citation report, update citation analysis, or refresh report.html.
---

# Citation Analysis

Generates `report.html` by extracting data from PDF snapshots, persisting it to a cache, and injecting it into the UI template at `_layouts/report.html`.

---

## Phase 1 — Discover snapshots

List all PDF files in `citations/`. Each filename encodes a date as a 4-digit MMDD suffix. Parse it to derive an ISO date: MMDD 1101–1231 → year 2025; MMDD 0101–1031 → year 2026. Build a list of `{filename, isoDate}` sorted ascending.

---

## Phase 2 — Load cache

Read `citations/cache.json` if it exists. It maps each filename to the extracted snapshot data for that PDF. Diff against the current file list — only PDFs absent from the cache are "new" and need to be read.

---

## Phase 3 — Extract new PDFs

For each new PDF, read it and extract:
- **Summary box:** total citations, h-index, i10-index (all-time figures)
- **Publication table:** each paper's full title, cited-by count, and publication year

Normalize each title to a key using the **old normalization** (to stay consistent with existing cache entries): strip non-alphanumeric characters from the **first 50 chars of the title** (lowercase), i.e. `re.sub(r'[^a-z0-9]', '', title[:50].lower())`. Within a single PDF, if two rows share a key, sum their cited-by counts into one entry.

**Key matching for new entries:** After computing a key for a new paper, check if any existing cached paper shares a very similar title (SequenceMatcher ratio > 0.85 on normalized titles). If so, reuse the existing key rather than creating a new one. This prevents duplicate entries caused by minor title variations across snapshots.

Append the new entries to the cache and write `citations/cache.json`.

---

## Phase 4 — Build DATA object

Using all cache entries (not just new ones), construct:

- `author` — the profile owner's name (read from the PDF profile header)
- `generated` — today's ISO date
- `hIndex`, `i10Index` — from the most recent snapshot
- `dedupNotes` — list of `"<title A> vs <title B>"` strings for any normalized key that appeared under two or more distinct titles across snapshots; empty array if none
- `snapshots` — array of `{date, citations, hIndex, i10Index}` sorted ascending
- `papers` — array of `{id, title, year, series}` where `title` is the longest seen for that key, and `series` is `{date, count}` for each snapshot where the paper appeared

---

## Phase 5 — Inject and write

Read `_layouts/report.html`. Locate the placeholder block:

```
/*CITATION_DATA_START*/
const DATA = null;
/*CITATION_DATA_END*/
```

Replace it with:

```
/*CITATION_DATA_START*/
const DATA = <serialized JSON>;
/*CITATION_DATA_END*/
```

Write the result to `citations/report.html`.

---

## Phase 6 — Open and summarize

Run `open citations/report.html` (macOS) to open the report in the default browser.

Then report: new PDFs read vs loaded from cache, total snapshots, date range, distinct papers tracked, current citations (h-index, i10-index), output path.
