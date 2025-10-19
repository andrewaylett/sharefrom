import './style.css'
import QRCode from 'qrcode'
import { WebRTCConnection } from './webrtc'
import { trackPageView, trackConnectionSuccess, trackConnectionError, trackFileSent, trackFileReceived, trackError } from './analytics'

const app = document.querySelector<HTMLDivElement>('#app')!

let connection: WebRTCConnection | null = null

async function initLaptopView() {
  trackPageView('laptop')

  const sessionId = crypto.randomUUID()
  const url = `${window.location.origin}?session=${sessionId}`

  app.innerHTML = `
    <h1>Share from Phone</h1>
    <p>Scan this QR code with your phone to share files</p>
    <div id="qr-container">
      <canvas id="qr-code"></canvas>
    </div>
    <div id="status" class="status">Waiting for connection...</div>
    <div id="files" class="files"></div>
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

  // Setup WebRTC connection
  connection = new WebRTCConnection(sessionId)

  connection.setOnConnectionStateChange((state) => {
    const statusDiv = document.getElementById('status')!
    switch (state) {
      case 'connected':
        statusDiv.textContent = '✓ Connected. Waiting for phone...'
        statusDiv.className = 'status success'
        break
      case 'connecting':
        statusDiv.textContent = '⟳ Connecting...'
        statusDiv.className = 'status'
        break
      case 'disconnected':
        statusDiv.textContent = '⚠ Disconnected'
        statusDiv.className = 'status warning'
        break
      case 'failed':
        statusDiv.textContent = '✗ Connection failed'
        statusDiv.className = 'error'
        break
      default:
        statusDiv.textContent = `Connection: ${state}`
        statusDiv.className = 'status'
    }
  })

  connection.setOnError((error) => {
    const statusDiv = document.getElementById('status')!
    statusDiv.textContent = `✗ Error: ${error.message}`
    statusDiv.className = 'error'
    trackConnectionError('laptop', error.message)
    trackError('connection', error.message)
  })

  connection.setOnFileReceived((file) => {
    const filesDiv = document.getElementById('files')!
    const fileDiv = document.createElement('div')
    fileDiv.className = 'file-received'
    fileDiv.innerHTML = `
      <div>Received: ${file.name} (${formatFileSize(file.size)})</div>
      <button onclick="downloadFile('${file.name}')">Download</button>
    `
    filesDiv.appendChild(fileDiv)

    // Store file for download
    ;(window as any).receivedFiles = (window as any).receivedFiles || new Map()
    ;(window as any).receivedFiles.set(file.name, file)

    // Update status
    const statusDiv = document.getElementById('status')!
    statusDiv.textContent = `✓ Received ${file.name}`
    statusDiv.className = 'status success'

    // Track analytics
    trackFileReceived(file.size, file.type || 'unknown')
  })

  try {
    const statusDiv = document.getElementById('status')!
    statusDiv.textContent = '⟳ Connecting to signaling server...'
    await connection.connect()
    statusDiv.textContent = '✓ Connected. Waiting for phone...'
    statusDiv.className = 'status success'
  } catch (error) {
    console.error('Connection error:', error)
    const statusDiv = document.getElementById('status')!
    statusDiv.textContent = `✗ ${error instanceof Error ? error.message : 'Connection error. Please refresh.'}`
    statusDiv.className = 'error'
  }
}

async function initMobileView() {
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
      <button id="send-button" disabled>Send Files</button>
    </div>
    <div id="status" class="status">Connecting...</div>
    <div id="progress"></div>
  `

  const fileInput = document.getElementById('file-input') as HTMLInputElement
  const sendButton = document.getElementById('send-button') as HTMLButtonElement
  let selectedFiles: FileList | null = null

  fileInput.addEventListener('change', (event) => {
    const input = event.target as HTMLInputElement
    selectedFiles = input.files

    if (selectedFiles && selectedFiles.length > 0) {
      sendButton.disabled = false
      const statusDiv = document.getElementById('status')!
      statusDiv.textContent = `Selected ${selectedFiles.length} file(s)`
    }
  })

  sendButton.addEventListener('click', async () => {
    if (!selectedFiles || !connection) return

    sendButton.disabled = true
    const progressDiv = document.getElementById('progress')!

    for (let i = 0; i < selectedFiles.length; i++) {
      const file = selectedFiles[i]
      progressDiv.textContent = `Sending ${file.name}...`

      try {
        await connection.sendFile(file)
        progressDiv.textContent = `Sent ${i + 1}/${selectedFiles.length} files`
        trackFileSent(file.size, file.type || 'unknown')
      } catch (error) {
        console.error('Error sending file:', error)
        const errorMsg = error instanceof Error ? error.message : `Error sending ${file.name}`
        progressDiv.textContent = errorMsg
        trackError('file_send', errorMsg)
      }
    }

    progressDiv.textContent = 'All files sent!'
  })

  // Setup WebRTC connection
  connection = new WebRTCConnection(sessionId)

  connection.setOnConnectionStateChange((state) => {
    const statusDiv = document.getElementById('status')!
    switch (state) {
      case 'connected':
        statusDiv.textContent = '✓ Connected! Select files to send.'
        statusDiv.className = 'status success'
        sendButton.disabled = selectedFiles ? false : true
        break
      case 'connecting':
        statusDiv.textContent = '⟳ Connecting...'
        statusDiv.className = 'status'
        break
      case 'disconnected':
        statusDiv.textContent = '⚠ Disconnected from laptop'
        statusDiv.className = 'status warning'
        sendButton.disabled = true
        break
      case 'failed':
        statusDiv.textContent = '✗ Connection failed'
        statusDiv.className = 'error'
        sendButton.disabled = true
        break
      default:
        statusDiv.textContent = `Connection: ${state}`
        statusDiv.className = 'status'
    }
  })

  connection.setOnError((error) => {
    const statusDiv = document.getElementById('status')!
    statusDiv.textContent = `✗ Error: ${error.message}`
    statusDiv.className = 'error'
    sendButton.disabled = true
    trackConnectionError('phone', error.message)
    trackError('connection', error.message)
  })

  try {
    const statusDiv = document.getElementById('status')!
    statusDiv.textContent = '⟳ Connecting to laptop...'
    await connection.connect()
    // Phone creates the offer
    await connection.createOffer()
    statusDiv.textContent = '✓ Connected! Select files to send.'
    statusDiv.className = 'status success'
    trackConnectionSuccess('phone')
  } catch (error) {
    console.error('Connection error:', error)
    const statusDiv = document.getElementById('status')!
    const errorMsg = error instanceof Error ? error.message : 'Connection error. Please refresh.'
    statusDiv.textContent = `✗ ${errorMsg}`
    statusDiv.className = 'error'
    trackConnectionError('phone', errorMsg)
    trackError('connection', errorMsg)
  }
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

// Make downloadFile available globally
;(window as any).downloadFile = (fileName: string) => {
  const file = (window as any).receivedFiles?.get(fileName)
  if (!file) return

  const url = URL.createObjectURL(file)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  a.click()
  URL.revokeObjectURL(url)
}

// Show mobile view if session parameter is present, otherwise show laptop view
const urlParams = new URLSearchParams(window.location.search)
if (urlParams.has('session')) {
  initMobileView()
} else {
  initLaptopView()
}
