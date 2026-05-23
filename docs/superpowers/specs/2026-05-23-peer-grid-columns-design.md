# Design: Peer Grid Column Selector

**Date:** 2026-05-23
**Status:** Approved

## Summary

Add a `[2] [3]` button group to the peer list section header, letting the user
choose how many peer cards appear per row. The preference persists across page
reloads via `localStorage`. The config preview section is unaffected and stays
full-width at all times.

## Scope

- **In scope:** column selector control, grid layout classes, localStorage
  persistence, anti-flash on reload.
- **Out of scope:** config preview layout changes, card content reflowing,
  mobile layout (always stays 1 column on ≤640px).

## UI

```
┌─────────────────────────────────────────────────────────────────┐
│  NÓS  [2] [3]                           [+ ADICIONAR NÓ]       │
└─────────────────────────────────────────────────────────────────┘
```

- Default column count: **2**.
- Active button: `--accent` border + `--glow-sm` box-shadow.
- Inactive buttons: default `.btn` style.
- Button group sits between the section title and the add-peer button inside
  `.peers__header`.

## Architecture

Three files change. No new files. No store changes.

### 1. `src/components/PeerList.astro`

**HTML** — add `.peers__col-group` between title and add button:

```html
<div class="peers__col-group" id="col-group">
  <button class="btn btn--sm peers__col-btn" data-cols="2">[2]</button>
  <button class="btn btn--sm peers__col-btn" data-cols="3">[3]</button>
</div>
```

**CSS** — grid modifier classes + active state + mobile override:

```css
.peers__grid--cols-2 { grid-template-columns: repeat(2, 1fr); }
.peers__grid--cols-3 { grid-template-columns: repeat(3, 1fr); }

.peers__col-group { display: flex; gap: 0.25rem; }

.peers__col-btn--active {
  border-color: var(--accent);
  color: var(--accent);
  box-shadow: var(--glow-sm);
}

@media (max-width: 640px) {
  .peers__grid--cols-2,
  .peers__grid--cols-3 { grid-template-columns: 1fr; }
}
```

**JS** — read on init, apply, handle clicks:

```ts
const STORAGE_KEY = 'peers-cols';
const grid = document.getElementById('peers-container')!;
const colGroup = document.getElementById('col-group')!;

function applyColCount(cols: string): void {
  grid.classList.remove('peers__grid--cols-2', 'peers__grid--cols-3');
  grid.classList.add(`peers__grid--cols-${cols}`);
  colGroup.querySelectorAll<HTMLElement>('.peers__col-btn').forEach((btn) => {
    btn.classList.toggle('peers__col-btn--active', btn.dataset.cols === cols);
  });
  document.body.dataset.cols = cols;
  localStorage.setItem(STORAGE_KEY, cols);
}

applyColCount(localStorage.getItem(STORAGE_KEY) ?? '2');

colGroup.addEventListener('click', (e) => {
  const btn = (e.target as HTMLElement).closest<HTMLElement>('.peers__col-btn');
  if (btn?.dataset.cols) applyColCount(btn.dataset.cols);
});
```

### 2. `src/layouts/Base.astro`

Add an inline `<script>` in `<head>` before any stylesheets apply:

```html
<script>
  document.body.dataset.cols = localStorage.getItem('peers-cols') ?? '2';
</script>
```

This sets the `body[data-cols]` attribute before first paint, preventing a
flash of the wrong column layout on reload.

### 3. `src/components/ConfigPreview.astro`

No changes. Preview stays full-width regardless of column count.

## Data Flow

```
User clicks [3]
  → applyColCount('3')
    → grid gets .peers__grid--cols-3
    → body.dataset.cols = '3'
    → localStorage.setItem('peers-cols', '3')
    → [3] button gets .peers__col-btn--active

Page reload
  → Base.astro <script> reads localStorage → body.dataset.cols = '3'  (no flash)
  → PeerList.astro script reads localStorage → applyColCount('3')
```

## Acceptance Criteria

1. Clicking `[2]` shows 2 peer cards per row; clicking `[3]` shows 3.
2. Active button has accent color + glow; inactive button has default style.
3. Preference survives a page reload.
4. On ≤640px viewport the grid is always 1 column regardless of the selected
   count.
5. Config preview section width is unchanged in both column modes.
