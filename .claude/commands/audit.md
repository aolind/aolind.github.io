---
description: Audit recent changes (working tree by default, or a commit range) with Opus 4.7
argument-hint: "[<commit-ish>]  e.g. main..HEAD, HEAD~3..HEAD, or omit to audit working tree"
model: claude-opus-4-7
allowed-tools: Bash, Read, Grep, Glob
---

# Audit recent changes

You are performing a code review of recent changes to this Jekyll-based personal academic site. Use the project's `CLAUDE.md` and existing conventions as the reference for what "correct" looks like.

## Scope

If `$ARGUMENTS` is non-empty, it is a git commit-ish range (e.g. `main..HEAD`, `HEAD~3..HEAD`, a single SHA). Audit those commits.

If `$ARGUMENTS` is empty, audit the **working tree**: staged + unstaged + untracked files. Run these in parallel to gather context:

- `git status --short`
- `git diff --staged`
- `git diff` (unstaged)
- `git log --oneline -10` (for recent context, even though they aren't being audited)

For a commit-range audit, also run:

- `git log --oneline $ARGUMENTS`
- `git diff $ARGUMENTS`

## What to look for

Walk through every changed file. For each, evaluate:

1. **Correctness** — does the change actually do what it claims? Trace control flow. Look for off-by-one, wrong operators, copy-paste errors, swapped arguments.
2. **Regressions** — does this break adjacent functionality? Variable scope conflicts (e.g. duplicate `const` declarations like the `i10Idx` bug we previously hit), broken selectors, lost CSS rules, dead links.
3. **Conventions** — does it match the project's patterns documented in `CLAUDE.md`? Author-name styling rules, font-color conventions, layout hierarchy, citation format.
4. **JavaScript embedded in HTML** — for any `<script>` block changes: would `node --check`-style syntax validation pass? Are template literals balanced? Any `<X` substrings that the HTML parser would treat as tags?
5. **Data integrity** — for citation-analysis changes (cache.json, report data), are keys consistent across snapshots? Any duplicate or stale entries?
6. **Security** — secrets, tokens, credentials accidentally committed; XSS risks from un-escaped user data; unsafe innerHTML interpolation.
7. **Hooks/CI** — if `.claude/settings.json`, `scripts/`, or build-related files changed, will the hooks still fire correctly? Test the command logic mentally against the documented stdin payload.

## How to investigate

- Read the **full** changed file when context matters (don't rely on the diff alone for non-trivial changes).
- For HTML/JS changes, mentally execute the script with realistic DATA. The most common bug class on this site is JS errors that blank the page.
- For Markdown changes (publications, services, CV, index), open the file and check that link targets resolve, that author-name styling matches the convention (`<u><b>Aolin Ding</b></u>` in publications, `<b>Aolin Ding</b>` in prose), and that `<font color>` tags are well-formed and closed.
- Cross-reference against neighboring code — if a function is renamed or a variable repurposed, grep for other call sites.

## Output format

Produce a single report with this structure:

```
# Audit — <range or "working tree">

## Summary
<2–3 sentences: overall verdict, biggest risks, ship-readiness.>

## Findings

### 🔴 Critical (blocks merge/commit)
- **<file>:<line>** — <one-sentence problem>
  Why it matters: <impact>
  Fix: <specific change>

### 🟡 Should-fix (non-blocking but real)
- ...

### 🔵 Nits / suggestions
- ...

## Verified clean
- <file> — <one-line note on what you checked and confirmed good>
```

Order findings by severity, then by file. Be specific — cite line numbers, paste the offending snippet inline if it clarifies. If you cannot reach a confident verdict on something, say so explicitly under a `## Open questions` section rather than guessing.

If the changeset is small (≤3 files, ≤50 lines), keep the report tight. If it's large, be thorough — the user is relying on this audit to ship safely.
