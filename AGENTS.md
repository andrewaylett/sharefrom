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
  - `[site]` section serves static assets from `dist/`
  - Durable Objects binding for SignalingServer class
- Worker serves both API routes (`/api/*`) and static assets (via ASSETS binding)

### Development Workflow
- `npm run dev` - frontend-only development with Vite HMR
- `npm run dev:worker` - full stack with Workers (slower, but tests real deployment)
- Always build before running worker dev server (Workers doesn't use Vite's dev server)

## Architecture Decisions

### Why Cloudflare Workers + Durable Objects?
- Global edge deployment for low latency signaling
- Durable Objects provide strong consistency for WebRTC session coordination
- Free tier sufficient for development and moderate usage
- Workers Sites pattern cleanly separates static assets from API logic

### Why WebRTC Data Channels?
- Peer-to-peer transfer keeps files private and reduces server costs
- No file size limits (unlike traditional uploads)
- Works across NAT with standard STUN servers
- Browser native support (no plugins needed)

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
