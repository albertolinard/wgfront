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

// ─── Mesh ─────────────────────────────────────────────────────────────────────

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

  it('nodes have finite numeric x and y', () => {
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

// ─── Hub-spoke ────────────────────────────────────────────────────────────────

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
    expect(Math.round(hub.x + 55)).toBe(Math.round(cx)); // 55 = NODE_W/2
    expect(Math.round(hub.y + 34)).toBe(Math.round(cy)); // 34 = NODE_H/2
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
