# WireGuard Config Generator

Generate WireGuard configuration files entirely in your browser.
No server. No tracking. Just math.

**Live (upstream):** [wireguard.otaviomiranda.com.br](https://wireguard.otaviomiranda.com.br)

## Features

- **X25519 key generation** via Web Crypto API (no external dependencies)
- **Mesh topology** — full mesh, every node talks to every node
- **Hub-spoke topology** — spokes route entire subnet through hub(s)
- **Full tunnel** — route all traffic through VPN with `AllowedIPs = 0.0.0.0/0, ::/0`
- **Dual-stack IPv6** — ULA addresses (`fd10:100::X`) alongside IPv4
- **Live config preview** with syntax highlighting
- **Download all** as `.zip` or copy individual configs
- **Import from ZIP** — restore a previously saved config set
- **Topology diagram** — live SVG visualization of nodes and connections
- **Broken link detection** — flags unreachable mesh pairs (both peers behind NAT) and offers one-click conversion to hub-spoke
- **Peer grid column selector** — 1 / 2 / 3 columns, saved to `localStorage`
- **100% client-side** — nothing leaves your browser

## Tech Stack

| Layer | Choice |
|-------|--------|
| Framework | Astro (static output) |
| UI | Vanilla TypeScript |
| Crypto | Web Crypto API (X25519) |
| ZIP | fflate |
| Tests | Vitest |
| Font | JetBrains Mono (self-hosted) |

## Getting Started

```bash
npm install
npm run dev      # dev server
npm test         # run tests
npm run build    # static build → dist/
```

Requires Node.js >= 22.12.0.

## Docker

```bash
docker build -t wgfront .
docker run -p 8080:80 wgfront
```

The image is a two-stage build: Node 22 Alpine compiles the static site, nginx Alpine serves it.

## Browser Support

X25519 key generation requires:

- Chrome 113+
- Firefox 130+
- Safari 17.4+

## How It Works

1. Add nodes and fill in their details (name, IPs, WG octet)
2. Choose topology: **mesh** or **hub-spoke**
3. Optionally enable **full tunnel** per node
4. Keys are generated client-side via `crypto.subtle.generateKey({ name: 'X25519' })`
5. Download configs and deploy to your machines with `wg-quick`

## Config Generation Notes

- Hub nodes in hub-spoke topology and NAT gateway nodes receive `PostUp`/`PostDown` rules enabling IP forwarding and iptables `FORWARD` chains
- `PostDown` does **not** disable `ip_forward` globally — disabling it on shutdown would break other services that depend on forwarding (e.g. local DNS resolvers). The preview warns when forwarding rules are present and shows how to persist the setting via `/etc/sysctl.d/`
- Only the primary hub (the one with a public endpoint, or the first hub) gets forwarding rules; secondary hubs do not, to avoid duplicate rules

## Project Structure

```
src/
  components/       Astro components (Header, PeerList, ConfigPreview, etc.)
  layouts/          Base HTML layout
  lib/              Pure TypeScript logic
    crypto.ts         X25519 key generation
    config-generator  Config string builder
    diagram.ts        SVG topology layout engine
    store.ts          Observable state (pub/sub)
    validators.ts     Input validation
    zip.ts            ZIP download/import via fflate
  styles/           Global CSS (CRT cyberpunk theme)
  pages/            Single page (index.astro)
```

## License

MIT

## Author

**Otavio Miranda** — [otaviomiranda.com.br](https://www.otaviomiranda.com.br)

## Fork

Maintained by **Alberto Linard** — additional features and fixes listed above.
