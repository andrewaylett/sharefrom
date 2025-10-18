import './style.css'
import QRCode from 'qrcode'

const app = document.querySelector<HTMLDivElement>('#app')!

async function initLaptopView() {
  const sessionId = crypto.randomUUID()
  const url = `${window.location.origin}?session=${sessionId}`
  
  app.innerHTML = `
    <h1>Share from Phone</h1>
    <p>Scan this QR code with your phone to share files</p>
    <div id="qr-container">
      <canvas id="qr-code"></canvas>
    </div>
    <div id="status" class="status">Waiting for connection...</div>
  `

  const canvas = document.getElementById('qr-code') as HTMLCanvasElement
  await QRCode.toCanvas(canvas, url, {
    width: 300,
    margin: 2,
    color: {
      dark: '#000000',
      light: '#FFFFFF'
    }
  })

  console.log('Session ID:', sessionId)
  console.log('Share URL:', url)
}

function initMobileView() {
  const urlParams = new URLSearchParams(window.location.search)
  const sessionId = urlParams.get('session')

  if (!sessionId) {
    app.innerHTML = `
      <h1>Share from Phone</h1>
      <div class="error">
        <p>Invalid or missing session. Please scan the QR code from your laptop.</p>
      </div>
    `
    return
  }

  app.innerHTML = `
    <h1>Share Files</h1>
    <p>Select files to share to your laptop</p>
    <div id="file-input-container">
      <input type="file" id="file-input" multiple accept="*/*">
    </div>
    <div id="status" class="status">Session: ${sessionId.substring(0, 8)}...</div>
  `

  const fileInput = document.getElementById('file-input') as HTMLInputElement
  fileInput.addEventListener('change', handleFileSelection)
}

function handleFileSelection(event: Event) {
  const input = event.target as HTMLInputElement
  const files = input.files
  
  if (!files || files.length === 0) {
    return
  }

  const statusDiv = document.getElementById('status')!
  statusDiv.textContent = `Selected ${files.length} file(s). Transfer not yet implemented.`
  
  console.log('Selected files:', Array.from(files).map(f => f.name))
}

// Show mobile view if session parameter is present, otherwise show laptop view
const urlParams = new URLSearchParams(window.location.search)
if (urlParams.has('session')) {
  initMobileView()
} else {
  initLaptopView()
}
