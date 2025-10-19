# Agent Notes

## Project Setup

### Build System
- Using Vite for frontend bundling and development
- TypeScript with strict mode enabled
- Separate tsconfig.json for worker code (needs @cloudflare/workers-types)
- Build process: typecheck both frontend and worker, then bundle with Vite
- Vitest for testing with happy-dom environment
- Test files use `*.test.ts` naming convention

### Cloudflare Workers Integration
- Worker code lives in `worker/` directory
- `wrangler.toml` configures Workers deployment:
  - `main` points to worker entry point
  - `[assets]` section serves static assets from `dist/` directory with ASSETS binding
  - Durable Objects binding for SignalingServer class
- Worker serves both API routes (`/api/*`) and static assets (via ASSETS binding)
- SignalingServer is a Durable Object that manages WebSocket connections
  - One instance per session (using session ID as Durable Object name)
  - Handles WebSocket upgrade and relays signaling messages
  - First connection is laptop, second is phone
  - Automatically cleans up when both peers disconnect

### Development Workflow
- `npm run dev` - runs Wrangler dev server with live reload (http://localhost:8787)
  - Serves static assets from dist/ (after building)
  - Runs Worker with WebSocket and Durable Objects support
  - Rebuilds automatically on file changes
- DO NOT use `vite dev` for this project - it doesn't support WebSockets or Durable Objects
- Always build before starting dev server (dev script does this automatically)

## Architecture Decisions

### Why Cloudflare Workers + Durable Objects?
- Global edge deployment for low latency signaling
- Durable Objects provide strong consistency for WebRTC session coordination
- Free tier sufficient for development and moderate usage
- Workers Sites pattern cleanly separates static assets from API logic

### Why WebRTC Data Channels?
- Peer-to-peer transfer keeps files private and reduces server costs
- No file size limits (unlike traditional uploads)
- Works across NAT with standard STUN servers (using Google's public STUN)
- Browser native support (no plugins needed)
- Files are sent in 16KB chunks to avoid overwhelming the data channel
- Metadata (filename, size, type) sent before file data
- Phone initiates the WebRTC offer, laptop responds with answer

### Session Management Approach
- Session ID generated on laptop, encoded in QR code URL
- Phone scans QR to get session ID
- View selection based solely on presence of `?session=` query parameter
  - No session parameter → laptop view (generates QR code)
  - Session parameter present → mobile view (shows file picker)
- User agent detection is NOT used - works regardless of device type
- Both sides connect to signaling server using session ID
- Session timeout prevents resource leaks (to be implemented)

## Known Issues

### TypeScript Path Issues
- Initially hit "tsc: command not found" because devDependencies weren't installed
- Running `npm install` without flags sometimes skips devDependencies
- Solution: explicitly run `npm install --include=dev` or ensure NODE_ENV != 'production'

## CI/CD

### GitHub Actions Workflow
- Runs on all pushes and pull requests
- Tests: typecheck → test → build
- Deployment: only on push to main branch after tests pass
- Requires CLOUDFLARE_API_TOKEN secret in GitHub repository settings
- Build artifacts are cached between test and deploy jobs for efficiency
