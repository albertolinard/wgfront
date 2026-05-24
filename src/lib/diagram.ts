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
  broken: boolean; // true when neither endpoint has a public IP — peers can't initiate to each other
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

// Returns false for empty strings, RFC1918 private IPs, and loopback — none
// of these are reachable from the internet, so they don't count as endpoints.
export function isPublicEndpoint(endpoint: string): boolean {
  if (!endpoint) return false;
  if (/^10\./.test(endpoint)) return false;
  if (/^172\.(1[6-9]|2[0-9]|3[01])\./.test(endpoint)) return false;
  if (/^192\.168\./.test(endpoint)) return false;
  if (/^127\./.test(endpoint)) return false;
  return true;
}

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
    const angle = ((2 * Math.PI) / n) * i - Math.PI / 2;
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
        broken: !isPublicEndpoint(peers[i].publicEndpointIp) && !isPublicEndpoint(peers[j].publicEndpointIp),
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
          const angle = ((2 * Math.PI) / hubs.length) * i - Math.PI / 2;
          const innerR = NODE_W * 0.8;
          return {
            id: hub.id,
            x: cx + innerR * Math.cos(angle),
            y: cy + innerR * Math.sin(angle),
          };
        });

  const spokeCenters = spokes.map((spoke, i) => {
    const angle = ((2 * Math.PI) / Math.max(spokes.length, 1)) * i - Math.PI / 2;
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
      broken: false,
    })),
  );

  return { nodes, edges, viewWidth, viewHeight };
}
