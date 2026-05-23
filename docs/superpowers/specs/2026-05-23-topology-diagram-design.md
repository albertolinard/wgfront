# Design: Topology Diagram Section

**Date:** 2026-05-23
**Status:** Approved

## Summary

Add a new `TOPOLOGIA` section between PeerList and ConfigPreview that renders a
live SVG diagram of the WireGuard network topology. The diagram updates
reactively as peers and topology settings change. It is hidden when fewer than
2 peers exist.

## Scope

- **In scope:** SVG diagram, circular/hub-center layout, rectangular info-dense
  nodes, reactive updates, mesh and hub-spoke rendering.
- **Out of scope:** node interactivity (hover, click), animation, zoom/pan,
  export to PNG/SVG file.

## Visual Design

### Node style (rectangular, 110×68px)

```
┌──────────────────────────────┐
│          hostname            │  ← bold, #e0e0e0 (hub) / #8899aa (spoke)
│        10.100.0.X            │  ← WG IP, #00ff9f accent
│      203.0.113.5             │  ← public endpoint or "(no endpoint)", #556677
│ ┌──────────────────────────┐ │
│ │    HUB  /  SPOKE         │ │  ← role badge, small monospace
│ └──────────────────────────┘ │
└──────────────────────────────┘
```

**Hub node:** `#00ff9f` border (2px), badge border `#00ff9f`, name text `#e0e0e0`
**Spoke node:** `#556677` border (1px), badge border `#556677`, name text `#8899aa`
**WG IP:** always `#00ff9f`
**Endpoint row:** `#556677`, shows `(no endpoint)` when `publicEndpointIp` is empty

### Edges

**Mesh:** solid lines `#1e2d3d`, 1.5px, all pairs (deduplicated — draw A→B once)
**Hub-spoke:** dashed lines `#1e2d3d`, 1.5px, `stroke-dasharray="5,4"`, hub↔spoke only

### Layout

**Mesh:** all nodes evenly spaced on a circle.
- `angle = (2π / n) * i`
- `x = cx + r * cos(angle)`, `y = cy + r * sin(angle)`
- Radius scales with node count to avoid overlap.

**Hub-spoke:**
- Hub(s) placed at center (single hub) or on a small inner ring (multiple hubs).
- Spokes placed on an outer ring around the hub cluster center.

### ViewBox

Computed dynamically:
- `NODE_W = 110`, `NODE_H = 68`
- Padding: 20px on all sides
- `viewBox = "0 0 {width} {height}"` with `width="100%"` on the SVG element
  so the diagram is responsive.

## Architecture

Three files touched:

| File | Action | Responsibility |
|------|--------|----------------|
| `src/lib/diagram.ts` | Create | Pure function: computes node positions + edges from `Peer[]` + `NetworkConfig` |
| `src/components/TopologyDiagram.astro` | Create | Renders SVG from layout data; subscribes to store |
| `src/pages/index.astro` | Modify | Import and insert `<TopologyDiagram />` between PeerList and ConfigPreview |

## `src/lib/diagram.ts`

### Types

```typescript
export interface DiagramNode {
  id: string;
  name: string;
  wgIp: string;        // "{subnet}.{wgOctet}"
  endpoint: string;    // publicEndpointIp or ''
  role: PeerRole;
  x: number;           // top-left corner of node rect
  y: number;
}

export interface DiagramEdge {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface DiagramLayout {
  nodes: DiagramNode[];
  edges: DiagramEdge[];
  viewWidth: number;
  viewHeight: number;
}
```

### `buildDiagramLayout(peers, network): DiagramLayout`

Constants:
```
NODE_W = 110, NODE_H = 68, PAD = 40
```

**Mesh layout:**
- `cx = viewWidth / 2`, `cy = viewHeight / 2`
- `r = max(NODE_W, NODE_H) * n * 0.45` (scales with node count)
- Node center: `(cx + r*cos(angle), cy + r*sin(angle))`
- Node top-left: `(cx - NODE_W/2, cy - NODE_H/2)`
- Edges: all unique pairs `{i < j}` using centers as endpoints

**Hub-spoke layout:**
- Hubs placed at center (if 1 hub) or on inner ring of radius `NODE_W * 0.8`
- Spokes placed on outer ring of radius `r` (same formula as mesh, using spoke count)
- Edges: each spoke connects to each hub (center-to-center)

**ViewBox:**
- Collect all node rects, compute bounding box + PAD
- `viewWidth = max(bounding box width + 2*PAD, 300)`
- `viewHeight = max(bounding box height + 2*PAD, 200)`

## `src/components/TopologyDiagram.astro`

- Section `id="topology-section"`, hidden when `peers.length < 2`
- Title: `TOPOLOGIA` (matches existing uppercase section title style)
- SVG element: `width="100%"`, `viewBox` set from layout
- On store update: recompute layout and re-render SVG innerHTML
- SVG rendering is done by a `renderSvg(layout)` function that returns an SVG
  string built from the layout data (no DOM diffing needed — replace `innerHTML`
  on each render, same pattern as `ConfigPreview`)

### SVG string structure

```
<svg viewBox="0 0 W H" ...>
  <!-- edges first (behind nodes) -->
  <line x1=... y1=... x2=... y2=... stroke=... />
  ...
  <!-- nodes -->
  <g class="diagram-node" data-role="hub|spoke">
    <rect x=... y=... width=110 height=68 rx=4 />
    <text>name</text>
    <text>10.100.0.X</text>
    <text>endpoint or (no endpoint)</text>
    <rect class="diagram-badge" />
    <text>HUB / SPOKE</text>
  </g>
  ...
</svg>
```

## Data Flow

```
store.subscribe(render)
  → getState() → { peers, network }
  → if peers.length < 2: hide section, return
  → buildDiagramLayout(peers, network) → DiagramLayout
  → renderSvg(layout) → SVG string
  → svgEl.innerHTML = svgString
```

## Page Integration

In `src/pages/index.astro`, add `<TopologyDiagram />` between `<PeerList />` and
`<ConfigPreview />`:

```astro
<PeerList />
<TopologyDiagram />
<ConfigPreview />
```

## Acceptance Criteria

1. Section is hidden when fewer than 2 peers exist; visible with ≥ 2 peers.
2. Mesh topology: all nodes on a circle, all pairs connected with solid muted lines.
3. Hub-spoke topology: hub(s) at center with accent border; spokes on outer
   ring with muted border; dashed lines hub↔spoke only.
4. Each node shows: hostname (bold), WG IP (accent green), endpoint or
   `(no endpoint)` (muted), role badge.
5. Diagram updates immediately when peers are added/removed/edited or topology
   is changed.
6. SVG is responsive (fills container width).
7. `buildDiagramLayout` is a pure function with unit tests covering mesh and
   hub-spoke edge generation and node positioning.
