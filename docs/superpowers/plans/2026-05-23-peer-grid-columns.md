# Peer Grid Column Selector — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `[2] [3]` button group to the peer list header so users can choose how many peer cards appear per row, persisted to `localStorage`.

**Architecture:** CSS modifier classes (`.peers__grid--cols-2/3`) drive the grid layout. `PeerList.astro` owns the button group, applies the class, and persists the choice to `localStorage`. `Base.astro` gets a single inline script that restores `body.dataset.cols` from `localStorage` before first paint to prevent a flash of the wrong column count on reload. `ConfigPreview.astro` is untouched.

**Tech Stack:** Astro, vanilla TypeScript (inline component scripts), CSS Grid, `localStorage`.

---

## File Map

| Action | File | What changes |
|--------|------|--------------|
| Modify | `src/layouts/Base.astro:61` | Add `<script is:inline>` as first child of `<body>` |
| Modify | `src/components/PeerList.astro:5-8` | Add `.peers__col-group` button group inside `.peers__header` |
| Modify | `src/components/PeerList.astro:15-46` | Add modifier classes + active-button style + mobile override to `<style>` |
| Modify | `src/components/PeerList.astro:48-55` | Add column-selector JS at top of `<script>` block |

---

## Task 1: Anti-flash script in Base.astro

This script must run before anything is painted so the grid renders at the
correct column count immediately on reload (no flash of wrong layout).

**Files:**
- Modify: `src/layouts/Base.astro:61`

- [ ] **Step 1: Add inline script as first child of `<body>`**

  In `src/layouts/Base.astro`, replace:

  ```astro
    <body>
      <slot />
  ```

  with:

  ```astro
    <body>
      <script is:inline>
        document.body.dataset.cols = localStorage.getItem('peers-cols') ?? '2';
      </script>
      <slot />
  ```

  `is:inline` tells Astro not to bundle this script — it runs synchronously
  during HTML parsing, before any component scripts execute.

- [ ] **Step 2: Verify the dev server still starts**

  ```bash
  npm run dev
  ```

  Expected: dev server starts with no build errors. Open the browser, open
  DevTools → Elements, confirm `<body>` has `data-cols="2"` before any
  interaction.

- [ ] **Step 3: Commit**

  ```bash
  git add src/layouts/Base.astro
  git commit -m "feat: restore peer grid column count from localStorage before paint"
  ```

---

## Task 2: Column selector in PeerList.astro

All three changes (HTML, CSS, JS) live in the same file. Make them in order
so the file is always in a consistent state.

**Files:**
- Modify: `src/components/PeerList.astro`

### Step 2a — HTML: add button group to header

- [ ] **Step 1: Update `.peers__header` markup**

  In `src/components/PeerList.astro`, replace lines 5–8:

  ```astro
    <div class="peers__header">
      <h2 class="peers__title text-secondary">Nós</h2>
      <button class="btn btn--accent" id="add-peer-btn">[+ ADICIONAR NÓ]</button>
    </div>
  ```

  with:

  ```astro
    <div class="peers__header">
      <div class="peers__header-left">
        <h2 class="peers__title text-secondary">Nós</h2>
        <div class="peers__col-group" id="col-group">
          <button class="btn btn--sm peers__col-btn" data-cols="2">[2]</button>
          <button class="btn btn--sm peers__col-btn" data-cols="3">[3]</button>
        </div>
      </div>
      <button class="btn btn--accent" id="add-peer-btn">[+ ADICIONAR NÓ]</button>
    </div>
  ```

### Step 2b — CSS: grid modifier classes + active state + mobile override

- [ ] **Step 2: Update the `<style>` block**

  In `src/components/PeerList.astro`, replace the entire `<style>` block
  (lines 15–46) with:

  ```astro
  <style>
    .peers__header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 1rem;
    }

    .peers__header-left {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }

    .peers__title {
      font-size: 1rem;
      text-transform: uppercase;
      letter-spacing: 0.08em;
    }

    .peers__col-group {
      display: flex;
      gap: 0.25rem;
    }

    .peers__col-btn--active {
      border-color: var(--accent);
      color: var(--accent);
      box-shadow: var(--glow-sm);
    }

    .peers__grid {
      display: grid;
      gap: 1rem;
      grid-template-columns: repeat(auto-fill, minmax(360px, 1fr));
    }

    .peers__grid--cols-2 { grid-template-columns: repeat(2, 1fr); }
    .peers__grid--cols-3 { grid-template-columns: repeat(3, 1fr); }

    .peers__empty {
      text-align: center;
      padding: 2rem;
      font-size: 1rem;
    }

    @media (max-width: 640px) {
      .peers__grid,
      .peers__grid--cols-2,
      .peers__grid--cols-3 {
        grid-template-columns: 1fr;
      }
    }
  </style>
  ```

  The modifier classes are declared before the `@media` block so the mobile
  override wins via cascade order.

### Step 2c — JS: column selection logic

- [ ] **Step 3: Add column-selector JS at the top of the `<script>` block**

  In `src/components/PeerList.astro`, after the existing element queries on
  lines 52–54 (right after `const addBtn = ...`), insert:

  ```typescript
  const STORAGE_KEY = 'peers-cols';
  const colGroup = document.getElementById('col-group')!;

  function applyColCount(cols: string): void {
    container.classList.remove('peers__grid--cols-2', 'peers__grid--cols-3');
    container.classList.add(`peers__grid--cols-${cols}`);
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

  `container` is already declared on line 52 (`getElementById('peers-container')`),
  so `applyColCount` can reference it directly.

### Step 2d — Manual verification

- [ ] **Step 4: Start dev server and verify**

  ```bash
  npm run dev
  ```

  Check each acceptance criterion in the browser:

  1. **Default:** On first load (clear `localStorage` first via DevTools →
     Application → Local Storage → delete `peers-cols`), the grid shows 2
     columns and `[2]` has accent border + glow.
  2. **Switch:** Click `[3]` — grid reflows to 3 columns, `[3]` becomes active,
     `[2]` returns to default style.
  3. **Persist:** Click `[3]`, reload the page — grid opens at 3 columns
     immediately with no flash.
  4. **Mobile:** Resize viewport to ≤640px — grid collapses to 1 column
     regardless of the active button.
  5. **Preview untouched:** The config preview section stays full-width in both
     column modes.

- [ ] **Step 5: Commit**

  ```bash
  git add src/components/PeerList.astro
  git commit -m "feat: add column selector to peer grid with localStorage persistence"
  ```

---

## Self-Review Checklist

- [x] **Spec coverage:** Anti-flash (Base.astro) ✓, button group HTML ✓,
  CSS modifier classes ✓, active-button styling ✓, mobile override ✓,
  JS logic ✓, localStorage persistence ✓, ConfigPreview unchanged ✓.
- [x] **No placeholders:** All steps contain exact code.
- [x] **Type consistency:** `applyColCount(cols: string)` — `cols` is always
  a string (`'2'` or `'3'`), matching `dataset.cols` (always string) and
  `localStorage.getItem` return type.
