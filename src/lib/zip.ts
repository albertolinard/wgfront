import { zipSync, unzipSync, strToU8, strFromU8 } from 'fflate';
import { downloadBlob } from './download';
import type { NetworkConfig, Peer } from './types';

interface ZipEntry {
  filename: string;
  content: string;
}

export function downloadZip(entries: ZipEntry[], zipFilename: string): void {
  const files: Record<string, Uint8Array> = {};
  for (const entry of entries) {
    files[entry.filename] = strToU8(entry.content);
  }
  const zipped = zipSync(files);
  const blob = new Blob([zipped], { type: 'application/zip' });
  downloadBlob(blob, zipFilename);
}

export interface ImportResult {
  network: NetworkConfig;
  peers: Peer[];
}

export function parseImportZip(buffer: ArrayBuffer): ImportResult {
  const bytes = new Uint8Array(buffer);
  const files = unzipSync(bytes);

  // Prefer metadata.json for full fidelity
  const metaRaw = files['metadata.json'];
  if (metaRaw) {
    const meta = JSON.parse(strFromU8(metaRaw)) as ImportResult;
    return meta;
  }

  // Fallback: infer from .conf files
  const peers: Peer[] = [];
  let network: NetworkConfig = {
    subnet: '10.100.0',
    port: 51820,
    keepalive: 25,
    topology: 'mesh',
  };

  for (const [filename, content] of Object.entries(files)) {
    if (!filename.endsWith('.conf')) continue;
    const text = strFromU8(content);
    const name = filename.replace('.conf', '');

    const subnetMatch = text.match(/Address\s*=\s*(\d+\.\d+\.\d+)\.\d+\/24/);
    if (subnetMatch) network.subnet = subnetMatch[1];

    const portMatch = text.match(/ListenPort\s*=\s*(\d+)/);
    if (portMatch) network.port = parseInt(portMatch[1], 10);

    const keepMatch = text.match(/PersistentKeepalive\s*=\s*(\d+)/);
    if (keepMatch) network.keepalive = parseInt(keepMatch[1], 10);

    const octetMatch = text.match(/Address\s*=\s*\d+\.\d+\.\d+\.(\d+)\/24/);
    const octet = octetMatch ? parseInt(octetMatch[1], 10) : 1;

    const privMatch = text.match(/PrivateKey\s*=\s*(.+)/);
    const pubMatch = text.match(/PublicKey\s*=\s*(.+)/);

    // Scan peer blocks for endpoint
    const endpointMatches = [...text.matchAll(/Endpoint\s*=\s*([^:]+):/g)];
    const publicEndpointIp = endpointMatches.length > 0 ? endpointMatches[0][1] : '';

    peers.push({
      id: String(peers.length + 1),
      name,
      label: name,
      lanIp: '',
      publicEndpointIp,
      wgOctet: octet,
      keys: {
        privateKey: privMatch?.[1]?.trim() ?? '',
        publicKey: pubMatch?.[1]?.trim() ?? '',
      },
      role: 'spoke',
      fullTunnel: false,
      natGateway: false,
      natInterface: 'eth0',
    });
  }

  return { network, peers };
}
