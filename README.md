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

For local development, you need to run the Cloudflare Workers dev server (not the Vite dev server) because the application requires WebSocket support and the signaling server backend:

```bash
# Install dependencies
npm install

# Run local development server (includes both frontend and backend)
npm run dev

# The app will be available at http://localhost:8787
# The dev command automatically rebuilds when you change files
```

For other tasks:

```bash
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

## Why not use `vite dev`?

The Vite dev server doesn't support WebSocket proxying or Durable Objects, which are required for the WebRTC signaling. Use `npm run dev` which runs `wrangler dev` instead - this serves both the static assets and the Worker backend with WebSocket support.

## Deployment

### Cloudflare Setup

1. Create a Cloudflare account at https://cloudflare.com
2. Get your Account ID from the Workers dashboard
3. Create an API token with permissions for:
   - Workers Scripts: Edit
   - Account Settings: Read
   - Durable Objects: Edit

### GitHub Actions Deployment

This project includes a GitHub Actions workflow that automatically:
- Runs tests and type checking on all PRs
- Builds and deploys to Cloudflare on pushes to `main`

To set up automated deployment:

1. Go to your GitHub repository Settings → Secrets and variables → Actions
2. Add a new repository secret:
   - Name: `CLOUDFLARE_API_TOKEN`
   - Value: Your Cloudflare API token from above

The workflow will automatically deploy on every push to the `main` branch.

### Manual Deployment

```bash
# Build and deploy
npm run deploy
```

You'll need to configure Wrangler with your Cloudflare credentials first:

```bash
npx wrangler login
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
