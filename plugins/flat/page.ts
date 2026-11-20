/**
 * The page of the Flat state: the solid the 3D state selected, unfolded into one flat sheet, the way paper comes apart.
 *
 * The sheet is drawn as SVG. With the camera on, a canvas over it draws the same faces with the live frame on each one; the SVG stays as the
 * paper the state shows when the camera is off.
 */
import type { FaceStyles, Solid } from '../selection/index.ts'
import { netDotRadius, netOf, netSvg, netViewBox } from './nets.ts'

const NAMES: Record<Solid, string> = {
  tetrahedron: 'Tetrahedron',
  cube: 'Cube',
  octahedron: 'Octahedron',
  dodecahedron: 'Dodecahedron',
  icosahedron: 'Icosahedron',
}

/** The net's polygons as data for the canvas: its viewBox, one polygon per face, and the dot. */
function netData(solid: Solid): string {
  const net = netOf(solid)
  const round = (value: number): number => Math.round(value * 1000) / 1000
  return JSON.stringify({
    viewBox: netViewBox(net).map(round),
    faces: net.faces.map((face) => face.map((point) => [round(point.x), round(point.y)])),
    keys: net.keys,
    dot: { x: round(net.dot.x), y: round(net.dot.y), r: round(netDotRadius(net)) },
  }).replaceAll('<', '\\u003c')
}

/** The page: the net on dark ground, with the state, the solid, and the camera toggle above it. */
export function flatPage(requestPath: string, solid: Solid = 'cube', camera = false, faces: FaceStyles = {}): string {
  const name = NAMES[solid]
  const page = `/${requestPath
    .split('/')
    .filter((segment) => segment !== '')
    .map((segment) => encodeURIComponent(segment))
    .join('/')}`
  const appBase = page.endsWith('/flat') ? page.slice(0, -'/flat'.length) : ''
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Flat · ${name}</title>
    <style>
      :root {
        color-scheme: dark;
      }
      * {
        box-sizing: border-box;
      }
      html,
      body {
        height: 100%;
        margin: 0;
        overflow: hidden;
        background: #1d1d1d;
      }
      body {
        color: #e8e8e8;
        font: 13px/1.5 ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
      }
      #flat-state {
        display: flex;
        height: 100%;
        flex-direction: column;
        gap: 4px;
        padding: 16px;
      }
      #flat-head {
        display: flex;
        align-items: baseline;
        gap: 10px;
      }
      #flat-head h1 {
        margin: 0;
        font-size: 12px;
        font-weight: 600;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: #a9a9a9;
      }
      #flat-solid {
        margin: 0;
        font-size: 14px;
        color: #e8e8e8;
      }
      #flat-camera {
        margin-left: auto;
        padding: 4px 10px;
        font: inherit;
        font-size: 12px;
        color: #dcdcdc;
        background: #2a2a2a;
        border: 1px solid #3c3c3c;
        border-radius: 6px;
        cursor: pointer;
      }
      #flat-camera:hover {
        background: #343434;
      }
      #flat-camera:focus-visible {
        outline: 2px solid #3b82f6;
        outline-offset: 1px;
      }
      #flat-camera[aria-pressed="true"] {
        background: #223247;
        border-color: #37506e;
        color: #ffffff;
      }
      #flat-randomize {
        padding: 4px 10px;
        font: inherit;
        font-size: 12px;
        color: #dcdcdc;
        background: #2a2a2a;
        border: 1px solid #3c3c3c;
        border-radius: 6px;
        cursor: pointer;
      }
      #flat-randomize:hover {
        background: #343434;
      }
      #flat-randomize:focus-visible {
        outline: 2px solid #3b82f6;
        outline-offset: 1px;
      }
      #flat-net {
        display: grid;
        flex: 1;
        margin: 0;
        min-height: 0;
        place-items: center;
      }
      #flat-net svg {
        width: 100%;
        height: 100%;
        max-width: 1100px;
        filter: drop-shadow(0 12px 26px rgba(0, 0, 0, 0.55));
      }
      #flat-net polygon {
        fill: #f4f0e6;
        stroke: #1a1a1a;
        stroke-width: 1.25;
        stroke-linejoin: round;
        vector-effect: non-scaling-stroke;
      }
      #flat-net .flat-dot {
        fill: #1a1a1a;
      }
      #flat-video {
        position: absolute;
        width: 1px;
        height: 1px;
        opacity: 0;
        pointer-events: none;
      }
      #flat-canvas {
        display: none;
        width: 100%;
        height: 100%;
      }
      #flat-net.camera #flat-canvas {
        display: block;
      }
      #flat-net.camera > svg {
        display: none;
      }
      #flat-error {
        margin: 0;
        padding: 8px 10px;
        border: 1px solid #6b3b3b;
        border-radius: 8px;
        background: rgba(48, 20, 20, 0.85);
        color: #f0c8c8;
      }
      #flat-error[hidden] {
        display: none;
      }
    </style>
  </head>
  <body>
    <main id="flat-state" data-selection="${appBase}/selection" data-camera="${camera ? 'on' : 'off'}">
      <header id="flat-head">
        <h1>Flat</h1>
        <p id="flat-solid">${name} · unfolded flat</p>
        <button type="button" id="flat-camera" aria-pressed="${camera ? 'true' : 'false'}" title="Show the camera on every face">Camera</button>
        <button type="button" id="flat-randomize" title="Pick a random face and one of Hue, Black and white, Sepia, Invert, and give every face a random direction">Randomize</button>
      </header>
      <video id="flat-video" playsinline muted aria-hidden="true"></video>
      <figure id="flat-net">
        ${netSvg(solid)}
        <canvas id="flat-canvas" aria-label="${name} unfolded flat, camera on every face"></canvas>
      </figure>
      <p id="flat-error" role="alert" hidden></p>
    </main>
    <script type="application/json" id="flat-net-data">${netData(solid)}</script>
    <script type="application/json" id="flat-faces">${JSON.stringify(faces).replaceAll('<', '\\u003c')}</script>
    <script type="module">
      const state = document.getElementById('flat-state')
      const figure = document.getElementById('flat-net')
      const button = document.getElementById('flat-camera')
      const canvas = document.getElementById('flat-canvas')
      const error = document.getElementById('flat-error')
      const net = JSON.parse(document.getElementById('flat-net-data').textContent)
      let styles = JSON.parse(document.getElementById('flat-faces').textContent)
      const context = canvas.getContext('2d')
      const videoElement = document.getElementById('flat-video')
      const randomizeButton = document.getElementById('flat-randomize')
      const PLAIN = { filter: 'none', hue: 0, orientation: 'none' }
      const RANDOM_FILTERS = ['hue', 'mono', 'sepia', 'invert']
      const RANDOM_ORIENTATIONS = ['none', 'flipV', 'right', 'left']
      const pick = (list) => list[Math.floor(Math.random() * list.length)]

      function filterOf(style) {
        if (style.filter === 'hue') return 'hue-rotate(' + style.hue + 'deg)'
        if (style.filter === 'mono') return 'grayscale(1)'
        if (style.filter === 'sepia') return 'sepia(0.85)'
        if (style.filter === 'invert') return 'invert(1)'
        return 'none'
      }

      function randomize() {
        if (net.keys.length === 0) return
        const next = {}
        for (const key of net.keys) {
          const current = styles[key] ?? PLAIN
          next[key] = { ...current, orientation: pick(RANDOM_ORIENTATIONS) }
        }
        const key = pick(net.keys)
        next[key] = { ...next[key], filter: pick(RANDOM_FILTERS), hue: Math.floor(Math.random() * 360) }
        styles = next
        if (on) draw()
        save({ faces: next })
      }
      const selectionUrl = state.dataset.selection
      let stream = null
      let video = null
      let on = false
      let frame = 0
      let pixelRatio = 1
      let saving = Promise.resolve()

      function showError(message) {
        error.hidden = false
        error.textContent = message
      }

      function save(body) {
        if (selectionUrl === undefined || selectionUrl === '') return
        saving = saving
          .then(() =>
            fetch(selectionUrl, {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify(body),
            }),
          )
          .then(
            () => undefined,
            () => undefined,
          )
      }

      function fit() {
        const width = figure.clientWidth
        const height = figure.clientHeight
        if (width === 0 || height === 0) return
        pixelRatio = Math.min(window.devicePixelRatio || 1, 2)
        canvas.width = Math.round(width * pixelRatio)
        canvas.height = Math.round(height * pixelRatio)
      }

      function placement() {
        const [x, y, width, height] = net.viewBox
        const scale = Math.min(canvas.width / width, canvas.height / height)
        return {
          scale,
          offsetX: (canvas.width - width * scale) / 2 - x * scale,
          offsetY: (canvas.height - height * scale) / 2 - y * scale,
        }
      }

      function facePath(face, place) {
        const path = new Path2D()
        face.forEach(([x, y], index) => {
          const px = place.offsetX + x * place.scale
          const py = place.offsetY + y * place.scale
          if (index === 0) path.moveTo(px, py)
          else path.lineTo(px, py)
        })
        path.closePath()
        return path
      }

      function draw() {
        if (!on) return
        frame = requestAnimationFrame(draw)
        if (video === null || video.readyState < 2 || canvas.width === 0) return
        const place = placement()
        context.clearRect(0, 0, canvas.width, canvas.height)
        // Every face shows the whole frame, cropped to the face's shape, with its own filter and direction.
        for (let index = 0; index < net.faces.length; index += 1) {
          const face = net.faces[index]
          const style = styles[net.keys[index]] ?? PLAIN
          const path = facePath(face, place)
          let minX = Infinity
          let maxX = -Infinity
          let minY = Infinity
          let maxY = -Infinity
          for (const [x, y] of face) {
            const px = place.offsetX + x * place.scale
            const py = place.offsetY + y * place.scale
            minX = Math.min(minX, px)
            maxX = Math.max(maxX, px)
            minY = Math.min(minY, py)
            maxY = Math.max(maxY, py)
          }
          const boxWidth = Math.max(maxX - minX, 1)
          const boxHeight = Math.max(maxY - minY, 1)
          const turned = style.orientation === 'right' || style.orientation === 'left'
          const videoWidth = video.videoWidth || 16
          const videoHeight = video.videoHeight || 9
          const faceWidth = turned ? boxHeight : boxWidth
          const faceHeight = turned ? boxWidth : boxHeight
          const cover = Math.max(faceWidth / videoWidth, faceHeight / videoHeight)
          const drawWidth = videoWidth * cover
          const drawHeight = videoHeight * cover
          context.save()
          context.clip(path)
          context.translate(minX + boxWidth / 2, minY + boxHeight / 2)
          if (style.orientation === 'flipV') context.scale(1, -1)
          else if (style.orientation === 'right') context.rotate(Math.PI / 2)
          else if (style.orientation === 'left') context.rotate(-Math.PI / 2)
          context.filter = filterOf(style)
          context.drawImage(video, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight)
          context.restore()
        }
        context.strokeStyle = '#1a1a1a'
        context.lineWidth = 1.25 * pixelRatio
        context.lineJoin = 'round'
        for (const face of net.faces) context.stroke(facePath(face, place))
        context.fillStyle = '#1a1a1a'
        context.beginPath()
        context.arc(place.offsetX + net.dot.x * place.scale, place.offsetY + net.dot.y * place.scale, Math.max(net.dot.r * place.scale, 2), 0, Math.PI * 2)
        context.fill()
      }

      function stop(saveFlag = true) {
        if (stream !== null) for (const track of stream.getTracks()) track.stop()
        stream = null
        if (video !== null) {
          video.pause()
          video.srcObject = null
        }
        video = null
        on = false
        cancelAnimationFrame(frame)
        figure.classList.remove('camera')
        button.setAttribute('aria-pressed', 'false')
        error.hidden = true
        if (saveFlag) save({ camera: false })
      }

      async function start() {
        if (stream !== null) return
        if (navigator.mediaDevices?.getUserMedia === undefined) {
          showError('This browser cannot open a camera.')
          return
        }
        try {
          stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false })
          video = videoElement
          video.muted = true
          video.playsInline = true
          video.autoplay = true
          video.srcObject = stream
          await video.play()
          on = true
          error.hidden = true
          figure.classList.add('camera')
          button.setAttribute('aria-pressed', 'true')
          fit()
          draw()
          save({ camera: true })
        } catch (failure) {
          stop(false)
          showError('The camera did not start: ' + (failure instanceof Error ? failure.message : String(failure)))
        }
      }

      button.addEventListener('click', () => {
        if (on) stop()
        else void start()
      })
      randomizeButton.addEventListener('click', randomize)
      new ResizeObserver(() => {
        if (on) fit()
      }).observe(figure)
      window.addEventListener('resize', () => {
        if (on) fit()
      })
      window.addEventListener('pagehide', () => stop(false))
      if (state.dataset.camera === 'on') void start()
    </script>
  </body>
</html>`
}
