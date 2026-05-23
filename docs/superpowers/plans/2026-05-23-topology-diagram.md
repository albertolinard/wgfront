# Topology Diagram Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `TOPOLOGIA` section between PeerList and ConfigPreview that renders a live SVG network diagram updating reactively as peers and settings change.

**Architecture:** A pure layout function in `src/lib/diagram.ts` computes node positions and edges from store state; `TopologyDiagram.astro` subscribes to the store, calls the layout function, and replaces its SVG innerHTML on every update — the same innerHTML-replacement pattern used by `ConfigPreview.astro`.

**Tech Stack:** Vanilla TypeScript, Astro component scripting, inline SVG string building, Vitest.

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `src/lib/diagram.ts` | Create | Pure layout: types + `buildDiagramLayout()` |
| `src/lib/__tests__/diagram.test.ts` | Create | Unit tests for layout function |
| `src/components/TopologyDiagram.astro` | Create | SVG rendering + store subscription |
| `src/pages/index.astro` | Modify | Insert `<TopologyDiagram />` between PeerList and ConfigPreview |

---

### Task 1: Tests for `buildDiagramLayout`

**Files:**
- Create: `src/lib/__tests__/diagram.test.ts`

- [ ] **Step 1: Create the test file**

```typescript
// src/lib/__tests__/diagram.test.ts
import { describe, it, expect } from 'vitest';
import { buildDiagramLayout } from '../diagram';
import type { Peer, NetworkConfig } from '../types';

function makePeer(overrides: Partial<Peer> = {}): Peer {
  return {
    id: '1',
    name: 'peer1',
    label: 'Peer 1',
    lanIp: '',
    publicEndpointIp: '',
    wgOctet: 1,
    role: 'hub',
    fullTunnel: false,
    natGateway: false,
    natInterface: 'eth0',
    keys: { privateKey: 'pk', publicKey: 'pubk' },
    ...overrides,
  };
}

const NET: NetworkConfig = {
  subnet: '10.100.0',
  port: 51820,
  keepalive: 25,
  topology: 'mesh',
};

const HUB_SPOKE_NET: NetworkConfig = { ...NET, topology: 'hub-spoke' };

// ─── Mesh ────────────────────────────────────────────────────────────────────

describe('buildDiagramLayout — mesh', () => {
  it('2 peers produce 1 edge', () => {
    const peers = [
      makePeer({ id: '1', wgOctet: 1, role: 'hub' }),
      makePeer({ id: '2', wgOctet: 2, role: 'spoke' }),
    ];
    const layout = buildDiagramLayout(peers, NET);
    expect(layout.edges).toHaveLength(1);
  });

  it('3 peers produce 3 edges', () => {
    const peers = [
      makePeer({ id: '1', wgOctet: 1, role: 'hub' }),
      makePeer({ id: '2', wgOctet: 2, role: 'spoke' }),
      makePeer({ id: '3', wgOctet: 3, role: 'spoke' }),
    ];
    const layout = buildDiagramLayout(peers, NET);
    expect(layout.edges).toHaveLength(3);
  });

  it('4 peers produce 6 edges', () => {
    const peers = Array.from({ length: 4 }, (_, i) =>
      makePeer({ id: String(i + 1), wgOctet: i + 1, role: i === 0 ? 'hub' : 'spoke' }),
    );
    const layout = buildDiagramLayout(peers, NET);
    expect(layout.edges).toHaveLength(6);
  });

  it('nodes have numeric x and y', () => {
    const peers = [
      makePeer({ id: '1', wgOctet: 1 }),
      makePeer({ id: '2', wgOctet: 2, role: 'spoke' }),
    ];
    const layout = buildDiagramLayout(peers, NET);
    for (const node of layout.nodes) {
      expect(typeof node.x).toBe('number');
      expect(typeof node.y).toBe('number');
      expect(Number.isFinite(node.x)).toBe(true);
      expect(Number.isFinite(node.y)).toBe(true);
    }
  });

  it('wgIp is subnet.wgOctet', () => {
    const peers = [
      makePeer({ id: '1', wgOctet: 5, role: 'hub' }),
      makePeer({ id: '2', wgOctet: 6, role: 'spoke' }),
    ];
    const layout = buildDiagramLayout(peers, NET);
    expect(layout.nodes[0].wgIp).toBe('10.100.0.5');
    expect(layout.nodes[1].wgIp).toBe('10.100.0.6');
  });

  it('endpoint is publicEndpointIp or empty string', () => {
    const peers = [
      makePeer({ id: '1', wgOctet: 1, publicEndpointIp: '203.0.113.1' }),
      makePeer({ id: '2', wgOctet: 2, role: 'spoke', publicEndpointIp: '' }),
    ];
    const layout = buildDiagramLayout(peers, NET);
    expect(layout.nodes[0].endpoint).toBe('203.0.113.1');
    expect(layout.nodes[1].endpoint).toBe('');
  });

  it('node count matches peer count', () => {
    const peers = [
      makePeer({ id: '1', wgOctet: 1 }),
      makePeer({ id: '2', wgOctet: 2, role: 'spoke' }),
      makePeer({ id: '3', wgOctet: 3, role: 'spoke' }),
    ];
    const layout = buildDiagramLayout(peers, NET);
    expect(layout.nodes).toHaveLength(3);
  });

  it('viewWidth and viewHeight are positive numbers', () => {
    const peers = [
      makePeer({ id: '1', wgOctet: 1 }),
      makePeer({ id: '2', wgOctet: 2, role: 'spoke' }),
    ];
    const layout = buildDiagramLayout(peers, NET);
    expect(layout.viewWidth).toBeGreaterThan(0);
    expect(layout.viewHeight).toBeGreaterThan(0);
  });
});

// ─── Hub-spoke ───────────────────────────────────────────────────────────────

describe('buildDiagramLayout — hub-spoke', () => {
  it('1 hub, 2 spokes: 2 edges (hub↔spoke only)', () => {
    const peers = [
      makePeer({ id: '1', wgOctet: 1, role: 'hub' }),
      makePeer({ id: '2', wgOctet: 2, role: 'spoke' }),
      makePeer({ id: '3', wgOctet: 3, role: 'spoke' }),
    ];
    const layout = buildDiagramLayout(peers, HUB_SPOKE_NET);
    expect(layout.edges).toHaveLength(2);
  });

  it('2 hubs, 2 spokes: 4 edges (each spoke connects to each hub)', () => {
    const peers = [
      makePeer({ id: '1', wgOctet: 1, role: 'hub' }),
      makePeer({ id: '2', wgOctet: 2, role: 'hub' }),
      makePeer({ id: '3', wgOctet: 3, role: 'spoke' }),
      makePeer({ id: '4', wgOctet: 4, role: 'spoke' }),
    ];
    const layout = buildDiagramLayout(peers, HUB_SPOKE_NET);
    expect(layout.edges).toHaveLength(4);
  });

  it('single hub is placed at center of viewBox', () => {
    const peers = [
      makePeer({ id: '1', wgOctet: 1, role: 'hub' }),
      makePeer({ id: '2', wgOctet: 2, role: 'spoke' }),
      makePeer({ id: '3', wgOctet: 3, role: 'spoke' }),
    ];
    const layout = buildDiagramLayout(peers, HUB_SPOKE_NET);
    const hub = layout.nodes.find((n) => n.role === 'hub')!;
    const cx = layout.viewWidth / 2;
    const cy = layout.viewHeight / 2;
    expect(Math.round(hub.x + 55)).toBe(Math.round(cx));  // 55 = NODE_W/2
    expect(Math.round(hub.y + 34)).toBe(Math.round(cy));  // 34 = NODE_H/2
  });

  it('no edges when there are no spokes', () => {
    const peers = [
      makePeer({ id: '1', wgOctet: 1, role: 'hub' }),
      makePeer({ id: '2', wgOctet: 2, role: 'hub' }),
    ];
    const layout = buildDiagramLayout(peers, HUB_SPOKE_NET);
    expect(layout.edges).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail (module not found)**

```
npm test -- --reporter=verbose src/lib/__tests__/diagram.test.ts
```

Expected: FAIL — `Cannot find module '../diagram'`

---

### Task 2: Implement `src/lib/diagram.ts`

**Files:**
- Create: `src/lib/diagram.ts`

- [ ] **Step 1: Create the file**

```typescript
// src/lib/diagram.ts
import type { Peer, NetworkConfig, PeerRole } from './types';

export interface DiagramNode {
  id: string;
  name: string;
  wgIp: string;
  endpoint: string;
  role: PeerRole;
  x: number;
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

const NODE_W = 110;
const NODE_H = 68;
const PAD = 40;

export function buildDiagramLayout(
  peers: Peer[],
  network: NetworkConfig,
): DiagramLayout {
  return network.topology === 'hub-spoke'
    ? buildHubSpokeLayout(peers, network)
    : buildMeshLayout(peers, network);
}

function buildMeshLayout(peers: Peer[], network: NetworkConfig): DiagramLayout {
  const n = peers.length;
  const r = Math.max(NODE_W, NODE_H) * n * 0.45;
  const viewWidth = Math.max(2 * r + NODE_W + 2 * PAD, 300);
  const viewHeight = Math.max(2 * r + NODE_H + 2 * PAD, 200);
  const cx = viewWidth / 2;
  const cy = viewHeight / 2;

  const centers: { x: number; y: number }[] = [];

  const nodes: DiagramNode[] = peers.map((peer, i) => {
    const angle = ((2 * Math.PI) / n) * i;
    const px = cx + r * Math.cos(angle);
    const py = cy + r * Math.sin(angle);
    centers.push({ x: px, y: py });
    return {
      id: peer.id,
      name: peer.name,
      wgIp: `${network.subnet}.${peer.wgOctet}`,
      endpoint: peer.publicEndpointIp,
      role: peer.role,
      x: px - NODE_W / 2,
      y: py - NODE_H / 2,
    };
  });

  const edges: DiagramEdge[] = [];
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      edges.push({
        x1: centers[i].x,
        y1: centers[i].y,
        x2: centers[j].x,
        y2: centers[j].y,
      });
    }
  }

  return { nodes, edges, viewWidth, viewHeight };
}

function buildHubSpokeLayout(
  peers: Peer[],
  network: NetworkConfig,
): DiagramLayout {
  const hubs = peers.filter((p) => p.role === 'hub');
  const spokes = peers.filter((p) => p.role === 'spoke');

  const r = Math.max(NODE_W, NODE_H) * Math.max(spokes.length, 2) * 0.45;
  const viewWidth = Math.max(2 * r + NODE_W + 2 * PAD, 300);
  const viewHeight = Math.max(2 * r + NODE_H + 2 * PAD, 200);
  const cx = viewWidth / 2;
  const cy = viewHeight / 2;

  const hubCenters =
    hubs.length === 1
      ? [{ id: hubs[0].id, x: cx, y: cy }]
      : hubs.map((hub, i) => {
          const angle = ((2 * Math.PI) / hubs.length) * i;
          const innerR = NODE_W * 0.8;
          return {
            id: hub.id,
            x: cx + innerR * Math.cos(angle),
            y: cy + innerR * Math.sin(angle),
          };
        });

  const spokeCenters = spokes.map((spoke, i) => {
    const angle = ((2 * Math.PI) / Math.max(spokes.length, 1)) * i;
    return {
      id: spoke.id,
      x: cx + r * Math.cos(angle),
      y: cy + r * Math.sin(angle),
    };
  });

  const nodes: DiagramNode[] = [
    ...hubs.map((hub) => {
      const c = hubCenters.find((h) => h.id === hub.id)!;
      return {
        id: hub.id,
        name: hub.name,
        wgIp: `${network.subnet}.${hub.wgOctet}`,
        endpoint: hub.publicEndpointIp,
        role: hub.role,
        x: c.x - NODE_W / 2,
        y: c.y - NODE_H / 2,
      };
    }),
    ...spokes.map((spoke) => {
      const c = spokeCenters.find((s) => s.id === spoke.id)!;
      return {
        id: spoke.id,
        name: spoke.name,
        wgIp: `${network.subnet}.${spoke.wgOctet}`,
        endpoint: spoke.publicEndpointIp,
        role: spoke.role,
        x: c.x - NODE_W / 2,
        y: c.y - NODE_H / 2,
      };
    }),
  ];

  const edges: DiagramEdge[] = hubCenters.flatMap((hc) =>
    spokeCenters.map((sc) => ({
      x1: hc.x,
      y1: hc.y,
      x2: sc.x,
      y2: sc.y,
    })),
  );

  return { nodes, edges, viewWidth, viewHeight };
}
```

- [ ] **Step 2: Run tests to verify they pass**

```
npm test -- --reporter=verbose src/lib/__tests__/diagram.test.ts
```

Expected: all tests PASS.

- [ ] **Step 3: Run full test suite to verify no regressions**

```
npm test
```

Expected: all tests PASS (existing 29 tests + new diagram tests).

- [ ] **Step 4: Commit**

```bash
git add src/lib/diagram.ts src/lib/__tests__/diagram.test.ts
git commit -m "feat(diagram): add buildDiagramLayout pure function with tests"
```

---

### Task 3: Create `TopologyDiagram.astro`

**Files:**
- Create: `src/components/TopologyDiagram.astro`

- [ ] **Step 1: Create the component**

```astro
---
---

<section class="section" id="topology-section" hidden>
  <h2 class="topology__title text-secondary">Topologia</h2>
  <div class="topology__diagram" id="topology-svg-container"></div>
</section>

<style>
  .topology__title {
    font-size: 1rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    margin-bottom: 1rem;
  }

  .topology__diagram {
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 1rem;
    overflow: hidden;
  }
</style>

<script>
  import { subscribe, getState } from '../lib/store';
  import { buildDiagramLayout } from '../lib/diagram';
  import type { DiagramNode, DiagramEdge, DiagramLayout } from '../lib/diagram';

  const section = document.getElementById('topology-section')!;
  const svgContainer = document.getElementById('topology-svg-container')!;

  const NODE_W = 110;
  const NODE_H = 68;

  function esc(s: string): string {
    return s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function renderNode(node: DiagramNode): string {
    const isHub = node.role === 'hub';
    const borderColor = isHub ? '#00ff9f' : '#556677';
    const borderWidth = isHub ? 2 : 1;
    const nameColor = isHub ? '#e0e0e0' : '#8899aa';
    const badgeStroke = isHub ? '#00ff9f' : '#556677';
    const badgeTextColor = isHub ? '#00ff9f' : '#556677';
    const badgeLabel = isHub ? 'HUB' : 'SPOKE';
    const endpointText = node.endpoint || '(no endpoint)';

    return `<g class="diagram-node" data-role="${node.role}">
  <rect x="${node.x}" y="${node.y}" width="${NODE_W}" height="${NODE_H}" rx="4" fill="#141c27" stroke="${borderColor}" stroke-width="${borderWidth}"/>
  <text x="${node.x + NODE_W / 2}" y="${node.y + 20}" text-anchor="middle" font-family="monospace" font-size="11" font-weight="bold" fill="${nameColor}">${esc(node.name)}</text>
  <text x="${node.x + NODE_W / 2}" y="${node.y + 36}" text-anchor="middle" font-family="monospace" font-size="9" fill="#00ff9f">${esc(node.wgIp)}</text>
  <text x="${node.x + NODE_W / 2}" y="${node.y + 49}" text-anchor="middle" font-family="monospace" font-size="8" fill="#556677">${esc(endpointText)}</text>
  <rect x="${node.x + 27}" y="${node.y + 55}" width="56" height="11" rx="2" fill="#0a0e14" stroke="${badgeStroke}" stroke-width="0.8"/>
  <text x="${node.x + NODE_W / 2}" y="${node.y + 64}" text-anchor="middle" font-family="monospace" font-size="7" fill="${badgeTextColor}">${badgeLabel}</text>
</g>`;
  }

  function renderEdge(edge: DiagramEdge, isMesh: boolean): string {
    const dash = isMesh ? '' : ' stroke-dasharray="5,4"';
    return `<line x1="${edge.x1}" y1="${edge.y1}" x2="${edge.x2}" y2="${edge.y2}" stroke="#1e2d3d" stroke-width="1.5"${dash}/>`;
  }

  function renderSvg(layout: DiagramLayout, isMesh: boolean): string {
    const edges = layout.edges.map((e) => renderEdge(e, isMesh)).join('\n');
    const nodes = layout.nodes.map(renderNode).join('\n');
    return `<svg viewBox="0 0 ${layout.viewWidth} ${layout.viewHeight}" width="100%" xmlns="http://www.w3.org/2000/svg">
${edges}
${nodes}
</svg>`;
  }

  function update(): void {
    const { peers, network } = getState();

    if (peers.length < 2) {
      section.hidden = true;
      return;
    }

    section.hidden = false;
    const layout = buildDiagramLayout(peers, network);
    const isMesh = network.topology === 'mesh';
    svgContainer.innerHTML = renderSvg(layout, isMesh);
  }

  subscribe(update);
  update();
</script>
```

- [ ] **Step 2: Verify file is well-formed TypeScript (no type errors)**

```
npm run build 2>&1 | grep -i error || echo "No errors"
```

Expected: `No errors` (or a clean build).

---

### Task 4: Wire `TopologyDiagram` into the page

**Files:**
- Modify: `src/pages/index.astro`

Current `src/pages/index.astro`:

```astro
---
import Base from '../layouts/Base.astro';
import Header from '../components/Header.astro';
import NetworkSettings from '../components/NetworkSettings.astro';
import PeerList from '../components/PeerList.astro';
import ConfigPreview from '../components/ConfigPreview.astro';
import ActionBar from '../components/ActionBar.astro';
import Footer from '../components/Footer.astro';

const title =
  'Gerador de Configuração WireGuard — WireGuard Config Generator';
const description =
  'Gere arquivos de configuração WireGuard direto no navegador. Sem servidor, sem rastreamento. Suporte a topologia mesh e hub-spoke com chaves X25519.';
---

<Base title={title} description={description}>
  <main class="container">
    <Header />
    <NetworkSettings />
    <PeerList />
    <ConfigPreview />
    <ActionBar />
    <Footer />
  </main>
</Base>
```

- [ ] **Step 1: Add the import and component to `src/pages/index.astro`**

Replace the frontmatter import block and usage:

```astro
---
import Base from '../layouts/Base.astro';
import Header from '../components/Header.astro';
import NetworkSettings from '../components/NetworkSettings.astro';
import PeerList from '../components/PeerList.astro';
import TopologyDiagram from '../components/TopologyDiagram.astro';
import ConfigPreview from '../components/ConfigPreview.astro';
import ActionBar from '../components/ActionBar.astro';
import Footer from '../components/Footer.astro';

const title =
  'Gerador de Configuração WireGuard — WireGuard Config Generator';
const description =
  'Gere arquivos de configuração WireGuard direto no navegador. Sem servidor, sem rastreamento. Suporte a topologia mesh e hub-spoke com chaves X25519.';
---

<Base title={title} description={description}>
  <main class="container">
    <Header />
    <NetworkSettings />
    <PeerList />
    <TopologyDiagram />
    <ConfigPreview />
    <ActionBar />
    <Footer />
  </main>
</Base>
```

- [ ] **Step 2: Build to verify no errors**

```
npm run build 2>&1 | tail -5
```

Expected: clean build ending with something like `▶ Completed in Xs`.

- [ ] **Step 3: Run full test suite**

```
npm test
```

Expected: all tests PASS.

- [ ] **Step 4: Commit**

```bash
git add src/components/TopologyDiagram.astro src/pages/index.astro
git commit -m "feat(topology): add TOPOLOGIA SVG diagram section between PeerList and ConfigPreview"
```

---

### Task 5: Manual smoke test

Start the dev server and verify all acceptance criteria.

- [ ] **Step 1: Start the dev server**

```
npm run dev
```

Open `http://localhost:4321` in the browser.

- [ ] **Step 2: Verify section is hidden with 0–1 peers**

Add 0 peers → `#topology-section` must have `hidden` attribute. Add 1 peer → still hidden.

- [ ] **Step 3: Verify section appears with 2+ peers (mesh)**

Add a second peer. Topology = Mesh (default). The `TOPOLOGIA` section appears between the peer list and config preview. Two nodes visible on a circle with 1 solid line between them.

- [ ] **Step 4: Verify mesh with 4 peers**

Add two more peers (4 total). All 4 nodes on a circle. 6 solid edges connecting every pair.

- [ ] **Step 5: Verify hub-spoke rendering**

Switch topology to Hub-Spoke. Hub node(s) move to center with `#00ff9f` accent border (2px). Spoke nodes on outer ring with `#556677` muted border (1px). Edges become dashed lines.

- [ ] **Step 6: Verify node content**

Each node shows: hostname (bold), WG IP in `#00ff9f`, endpoint or `(no endpoint)` in `#556677`, role badge.

- [ ] **Step 7: Verify reactive updates**

Edit a peer name → diagram updates immediately. Add/remove peer → diagram updates. Change topology → diagram updates.

- [ ] **Step 8: Verify responsive SVG**

Resize the browser window. The SVG stretches/shrinks to fill the container width.
