# sharefrom.xyz

A simple web service for sharing files from your phone to your laptop using WebRTC.

## How it works

1. Visit sharefrom.xyz on your laptop - a QR code is displayed
2. Scan the QR code with your phone
3. Select files on your phone to share
4. Files are transferred directly to your laptop via WebRTC (peer-to-peer)

## Architecture

- **Frontend**: Vite + TypeScript SPA with responsive design
  - Laptop view: displays QR code with session ID
  - Mobile view: file picker interface
- **Backend**: Cloudflare Workers + Durable Objects
  - Workers serve static assets and handle API requests
  - Durable Objects manage WebRTC signaling sessions
- **Transfer**: WebRTC Data Channels for peer-to-peer file transfer

## Development

```bash
# Install dependencies
npm install

# Run frontend dev server
npm run dev

# Run with Cloudflare Workers (requires build first)
npm run dev:worker

# Type check
npm run typecheck

# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with UI
npm run test:ui

# Generate coverage report
npm run test:coverage

# Build for production
npm run build

# Deploy to Cloudflare
npm run deploy
```

## Project Structure

```
├── src/              # Frontend TypeScript/CSS
├── worker/           # Cloudflare Workers backend
├── dist/             # Built static assets
├── index.html        # HTML entry point
├── wrangler.toml     # Cloudflare Workers config
└── package.json      # Dependencies and scripts
```

## Why WebRTC?

WebRTC enables direct peer-to-peer file transfer without uploading files to a server. This means:
- Faster transfers (no intermediary server)
- Better privacy (files never touch the server)
- Lower infrastructure costs (no storage needed)
- Works across NAT with STUN/TURN fallback
