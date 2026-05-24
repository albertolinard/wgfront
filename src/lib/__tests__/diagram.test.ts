import { describe, it, expect } from 'vitest';
import { buildDiagramLayout, isPublicEndpoint } from '../diagram';
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

  it('hub-spoke edges are never broken', () => {
    const peers = [
      makePeer({ id: '1', wgOctet: 1, role: 'hub', publicEndpointIp: '' }),
      makePeer({ id: '2', wgOctet: 2, role: 'spoke', publicEndpointIp: '' }),
      makePeer({ id: '3', wgOctet: 3, role: 'spoke', publicEndpointIp: '' }),
    ];
    const layout = buildDiagramLayout(peers, HUB_SPOKE_NET);
    for (const edge of layout.edges) {
      expect(edge.broken).toBe(false);
    }
  });
});

// ─── Broken edge detection ─────────────────────────────────────────────────

describe('buildDiagramLayout — broken edges', () => {
  it('edge between two no-endpoint peers is broken', () => {
    const peers = [
      makePeer({ id: '1', wgOctet: 1, publicEndpointIp: '' }),
      makePeer({ id: '2', wgOctet: 2, role: 'spoke', publicEndpointIp: '' }),
    ];
    const layout = buildDiagramLayout(peers, NET);
    expect(layout.edges[0].broken).toBe(true);
  });

  it('edge where one peer has endpoint is not broken', () => {
    const peers = [
      makePeer({ id: '1', wgOctet: 1, publicEndpointIp: '1.2.3.4' }),
      makePeer({ id: '2', wgOctet: 2, role: 'spoke', publicEndpointIp: '' }),
    ];
    const layout = buildDiagramLayout(peers, NET);
    expect(layout.edges[0].broken).toBe(false);
  });

  it('edge where both peers have endpoints is not broken', () => {
    const peers = [
      makePeer({ id: '1', wgOctet: 1, publicEndpointIp: '1.2.3.4' }),
      makePeer({ id: '2', wgOctet: 2, role: 'spoke', publicEndpointIp: '5.6.7.8' }),
    ];
    const layout = buildDiagramLayout(peers, NET);
    expect(layout.edges[0].broken).toBe(false);
  });

  it('only no-endpoint pairs are broken in a mixed mesh', () => {
    const peers = [
      makePeer({ id: '1', wgOctet: 1, publicEndpointIp: '1.2.3.4' }),        // public
      makePeer({ id: '2', wgOctet: 2, role: 'spoke', publicEndpointIp: '' }), // none
      makePeer({ id: '3', wgOctet: 3, role: 'spoke', publicEndpointIp: '' }), // none
    ];
    const layout = buildDiagramLayout(peers, NET);
    // 3 edges: 1-2 (ok), 1-3 (ok), 2-3 (broken)
    expect(layout.edges).toHaveLength(3);
    const brokenEdges = layout.edges.filter((e) => e.broken);
    expect(brokenEdges).toHaveLength(1);
  });

  it('RFC1918 private IP is treated as no public endpoint', () => {
    const peers = [
      makePeer({ id: '1', wgOctet: 1, publicEndpointIp: '192.168.0.156' }), // LAN IP
      makePeer({ id: '2', wgOctet: 2, role: 'spoke', publicEndpointIp: '192.168.0.26' }), // LAN IP
    ];
    const layout = buildDiagramLayout(peers, NET);
    expect(layout.edges[0].broken).toBe(true);
  });

  it('private IP + public IP pair is not broken', () => {
    const peers = [
      makePeer({ id: '1', wgOctet: 1, publicEndpointIp: '150.230.69.217' }), // public
      makePeer({ id: '2', wgOctet: 2, role: 'spoke', publicEndpointIp: '192.168.0.26' }), // LAN
    ];
    const layout = buildDiagramLayout(peers, NET);
    expect(layout.edges[0].broken).toBe(false);
  });
});

// ─── isPublicEndpoint ─────────────────────────────────────────────────────────

describe('isPublicEndpoint', () => {
  it('returns false for empty string', () => expect(isPublicEndpoint('')).toBe(false));
  it('returns false for 10.x.x.x', () => expect(isPublicEndpoint('10.0.0.1')).toBe(false));
  it('returns false for 192.168.x.x', () => expect(isPublicEndpoint('192.168.1.50')).toBe(false));
  it('returns false for 172.16-31.x.x', () => {
    expect(isPublicEndpoint('172.16.0.1')).toBe(false);
    expect(isPublicEndpoint('172.31.255.255')).toBe(false);
  });
  it('returns false for 127.x.x.x', () => expect(isPublicEndpoint('127.0.0.1')).toBe(false));
  it('returns true for public IP', () => expect(isPublicEndpoint('150.230.69.217')).toBe(true));
  it('returns true for DDNS hostname', () => expect(isPublicEndpoint('wg.example.com')).toBe(true));
  it('returns true for 172.15.x.x (not RFC1918)', () => expect(isPublicEndpoint('172.15.0.1')).toBe(true));
  it('returns true for 172.32.x.x (not RFC1918)', () => expect(isPublicEndpoint('172.32.0.1')).toBe(true));
});
