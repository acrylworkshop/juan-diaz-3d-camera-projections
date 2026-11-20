/**
 * State 1: the 3D space. Draws a Blender-flavored Z-up world in three.js (grid, painted axes, nav gizmo) and lets the pointer grab it:
 * drag with the left or middle button to orbit, Shift + drag to pan, the wheel or Ctrl + middle drag to zoom, and the numpad points the view at
 * the standard sides.
 *
 * Plain JavaScript on purpose: the browser gets this file unchanged, so it needs no compile step and no type declarations for three.
 */
import * as THREE from 'three'

/** Blender's axis colors: X red, Y green, Z blue. */
const AXIS_X = 0xe0473f
const AXIS_Y = 0x8cc63f
const AXIS_Z = 0x3b82f6

/** The grid covers X and Y from -10 to 10, so the space reads as about 20 units across. */
const GRID_EXTENT = 10
const FRAME_DISTANCE = 26
const MIN_DISTANCE = 0.8
const MAX_DISTANCE = 160
/** Stop just short of the poles: looking straight down keeps the top view stable with world Z as the camera's up. */
const ELEVATION_LIMIT = Math.PI / 2 - 0.001

const GIZMO_SIZE = 96
const GIZMO_PAD = 12
const GIZMO_HIT = 16

const canvas = document.getElementById('space-canvas')
const statusEl = document.getElementById('space-status')
const errorEl = document.getElementById('space-error')
const projectionButton = document.getElementById('space-projection')
const frameButton = document.getElementById('space-frame')

/** The six standard sides, as the spherical angles of the camera's position around the pivot. */
const VIEWS = {
  front: { azimuth: -Math.PI / 2, elevation: 0 },
  back: { azimuth: Math.PI / 2, elevation: 0 },
  right: { azimuth: 0, elevation: 0 },
  left: { azimuth: Math.PI, elevation: 0 },
  top: { azimuth: -Math.PI / 2, elevation: ELEVATION_LIMIT },
  bottom: { azimuth: -Math.PI / 2, elevation: -ELEVATION_LIMIT },
}

const OPPOSITE = { front: 'back', back: 'front', right: 'left', left: 'right', top: 'bottom', bottom: 'top' }
/** Numpad 1, 3 and 7, also when NumLock is off (the codes the browser then reports). */
const VIEW_KEYS = {
  Numpad1: 'front',
  NumpadEnd: 'front',
  Numpad3: 'right',
  NumpadPageDown: 'right',
  Numpad7: 'top',
  NumpadHome: 'top',
}

let renderer
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true })
} catch (error) {
  errorEl.hidden = false
  errorEl.textContent = 'This browser cannot start WebGL, so the 3D space cannot be drawn.'
  statusEl.textContent = 'WebGL unavailable'
  console.error(error)
}

/** Say what went wrong in the HUD instead of leaving a blank viewport. */
function showFailure(message) {
  errorEl.hidden = false
  errorEl.textContent = message
}
window.addEventListener('error', (event) => showFailure(`The space stopped: ${event.message}`))
window.addEventListener('unhandledrejection', (event) => showFailure(`The space stopped: ${String(event.reason)}`))

if (renderer !== undefined) start(renderer)

function start(webgl) {
  webgl.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))

  const scene = new THREE.Scene()
  scene.background = new THREE.Color(0x1d1d1d)
  scene.add(makeGrid(), makeAxes(), makeLights())

  const perspective = new THREE.PerspectiveCamera(50, 1, 0.01, 1000)
  const orthographic = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.01, 2000)
  for (const camera of [perspective, orthographic]) camera.up.set(0, 0, 1)

  const gizmoScene = new THREE.Scene()
  const gizmoCamera = new THREE.OrthographicCamera(-1.7, 1.7, 1.7, -1.7, 0.1, 10)
  // The gizmo shows the world as the camera sees it, so it is Z-up like the space and matches the main camera.
  gizmoCamera.up.set(0, 0, 1)
  const gizmoBalls = makeGizmo()
  for (const ball of gizmoBalls) gizmoScene.add(ball.object)

  /** Where the camera looks from: a pivot, a distance, and two angles around it. */
  const view = {
    target: new THREE.Vector3(0, 0, 0),
    distance: FRAME_DISTANCE,
    azimuth: -0.62,
    elevation: 0.42,
    ortho: false,
  }

  let scheduled = false
  let fallback = 0
  let drag = null

  // ---- the scene -------------------------------------------------------------------------------------------------

  function makeGrid() {
    const positions = []
    const colors = []
    const minor = new THREE.Color(0x303030)
    const major = new THREE.Color(0x3d3d3d)
    for (let i = -GRID_EXTENT; i <= GRID_EXTENT; i += 1) {
      if (i === 0) continue // the painted axes take the center lines
      const color = i % 5 === 0 ? major : minor
      positions.push(i, -GRID_EXTENT, 0, i, GRID_EXTENT, 0)
      positions.push(-GRID_EXTENT, i, 0, GRID_EXTENT, i, 0)
      for (let vertex = 0; vertex < 4; vertex += 1) colors.push(color.r, color.g, color.b)
    }
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
    return new THREE.LineSegments(
      geometry,
      new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.95 }),
    )
  }

  /** X, Y and Z as Blender paints them: bright toward the positive side, dim toward the negative one, with an arrow and a letter at each tip. */
  function makeAxes() {
    const group = new THREE.Group()
    const positions = []
    const colors = []
    const x = new THREE.Color(AXIS_X)
    const y = new THREE.Color(AXIS_Y)
    const z = new THREE.Color(AXIS_Z)
    const segment = (from, to, color, shade) => {
      positions.push(...from, ...to)
      for (let vertex = 0; vertex < 2; vertex += 1) colors.push(color.r * shade, color.g * shade, color.b * shade)
    }
    segment([-GRID_EXTENT, 0, 0], [0, 0, 0], x, 0.42)
    segment([0, 0, 0], [GRID_EXTENT, 0, 0], x, 1)
    segment([0, -GRID_EXTENT, 0], [0, 0, 0], y, 0.42)
    segment([0, 0, 0], [0, GRID_EXTENT, 0], y, 1)
    segment([0, 0, -2.5], [0, 0, 0], z, 0.42)
    segment([0, 0, 0], [0, 0, GRID_EXTENT * 0.6], z, 1)

    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
    group.add(new THREE.LineSegments(geometry, new THREE.LineBasicMaterial({ vertexColors: true })))

    const tips = [
      { axis: 'X', color: AXIS_X, position: new THREE.Vector3(GRID_EXTENT, 0, 0), rotation: new THREE.Euler(0, 0, -Math.PI / 2) },
      { axis: 'Y', color: AXIS_Y, position: new THREE.Vector3(0, GRID_EXTENT, 0), rotation: new THREE.Euler(0, 0, 0) },
      { axis: 'Z', color: AXIS_Z, position: new THREE.Vector3(0, 0, GRID_EXTENT * 0.6), rotation: new THREE.Euler(Math.PI / 2, 0, 0) },
    ]
    for (const tip of tips) {
      const arrow = new THREE.Mesh(
        new THREE.ConeGeometry(0.14, 0.44, 20),
        new THREE.MeshBasicMaterial({ color: tip.color }),
      )
      // The cone points along +Y by default; move it so it points out along this axis and ends at the tip.
      const outward = tip.position.clone().normalize()
      arrow.position.copy(tip.position).addScaledVector(outward, -0.22)
      arrow.quaternion.setFromEuler(tip.rotation)
      group.add(arrow)

      const label = makeLetter(tip.axis, tip.color)
      label.position.copy(tip.position).addScaledVector(outward, 0.85)
      label.scale.setScalar(0.75)
      group.add(label)
    }
    return group
  }

  /** A letter drawn on a sprite, so it faces the camera and keeps its color from any side. */
  function makeLetter(text, color) {
    const size = 128
    const surface = document.createElement('canvas')
    surface.width = size
    surface.height = size
    const context = surface.getContext('2d')
    context.font = 'bold 92px ui-sans-serif, system-ui, sans-serif'
    context.textAlign = 'center'
    context.textBaseline = 'middle'
    context.fillStyle = `#${color.toString(16).padStart(6, '0')}`
    context.fillText(text, size / 2, size / 2 + 4)
    const texture = new THREE.CanvasTexture(surface)
    texture.colorSpace = THREE.SRGBColorSpace
    return new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false }))
  }

  /** Light for the solid the mesh bar adds: a soft sky light and a key from above, so its facets read from any side. */
  function makeLights() {
    const lights = new THREE.Group()
    lights.add(new THREE.HemisphereLight(0xffffff, 0x2f2f2f, 1.1))
    const key = new THREE.DirectionalLight(0xffffff, 1.6)
    key.position.set(5, -7, 10)
    const fill = new THREE.DirectionalLight(0xffffff, 0.5)
    fill.position.set(-7, 5, 3)
    lights.add(key, fill)
    return lights
  }

  /** The five Platonic solids the mesh bar offers, all with the same circumradius so they read at a similar size. */
  const SOLIDS = {
    tetrahedron: () => new THREE.TetrahedronGeometry(2.4),
    cube: () => new THREE.BoxGeometry(2.771, 2.771, 2.771),
    octahedron: () => new THREE.OctahedronGeometry(2.4),
    dodecahedron: () => new THREE.DodecahedronGeometry(2.4),
    icosahedron: () => new THREE.IcosahedronGeometry(2.4),
  }

  /** Turn a solid so one of its faces lies flat, and rest it on the grid. A projection target stands on the floor, not half inside it. */
  function standingGeometry(geometry) {
    const position = geometry.getAttribute('position')
    if (position !== undefined && position.count >= 3) {
      const a = new THREE.Vector3().fromBufferAttribute(position, 0)
      const b = new THREE.Vector3().fromBufferAttribute(position, 1)
      const c = new THREE.Vector3().fromBufferAttribute(position, 2)
      const normal = b.sub(a).cross(c.sub(a)).normalize()
      if (normal.dot(a) < 0) normal.negate()
      geometry.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(normal, new THREE.Vector3(0, 0, -1)))
    }
    geometry.computeBoundingBox()
    geometry.translate(0, 0, -(geometry.boundingBox?.min.z ?? 0))
    return geometry
  }

  /** The solid on the space, standing at the origin. The bar shows one at a time: choosing another replaces it. */
  let solid = null

  function showSolid(name) {
    const create = SOLIDS[name]
    if (create === undefined) return
    if (solid !== null) {
      scene.remove(solid)
      solid.traverse((child) => {
        if (child.geometry !== undefined) child.geometry.dispose()
        if (child.material !== undefined) child.material.dispose()
      })
      solid = null
    }
    const geometry = standingGeometry(create())
    const mesh = new THREE.Mesh(
      geometry,
      new THREE.MeshStandardMaterial({ color: 0xb9bfc6, roughness: 0.55, metalness: 0.05, flatShading: true }),
    )
    // The edges of the facets, so a projection surface reads as separate faces from any angle.
    mesh.add(
      new THREE.LineSegments(
        new THREE.EdgesGeometry(geometry, 25),
        new THREE.LineBasicMaterial({ color: 0x77808a }),
      ),
    )
    solid = mesh
    scene.add(mesh)
    for (const button of document.querySelectorAll('[data-mesh]')) {
      button.setAttribute('aria-pressed', String(button.dataset.mesh === name))
    }
    requestRender()
  }

  /** The top right navigation gizmo: an X, Y and Z ball that follows the view, each one a shortcut to look along its axis. */
  function makeGizmo() {
    const origin = new THREE.Vector3(0, 0, 0)
    const balls = [
      { view: 'right', color: AXIS_X, label: 'X', position: new THREE.Vector3(1, 0, 0) },
      { view: 'back', color: AXIS_Y, label: 'Y', position: new THREE.Vector3(0, 1, 0) },
      { view: 'top', color: AXIS_Z, label: 'Z', position: new THREE.Vector3(0, 0, 1) },
    ]
    return balls.map((ball) => {
      const group = new THREE.Group()
      const stem = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([origin, ball.position]),
        new THREE.LineBasicMaterial({ color: ball.color, transparent: true, opacity: 0.65 }),
      )
      const dot = new THREE.Mesh(
        new THREE.SphereGeometry(0.19, 20, 14),
        new THREE.MeshBasicMaterial({ color: ball.color }),
      )
      dot.position.copy(ball.position)
      const letter = makeLetter(ball.label, ball.color)
      letter.position.copy(ball.position).multiplyScalar(1.4)
      letter.scale.setScalar(0.6)
      group.add(stem, dot, letter)
      return { view: ball.view, color: ball.color, position: ball.position, object: group }
    })
  }

  // ---- the camera ------------------------------------------------------------------------------------------------

  function cameraDirection() {
    const flat = Math.cos(view.elevation)
    return new THREE.Vector3(
      flat * Math.cos(view.azimuth),
      flat * Math.sin(view.azimuth),
      Math.sin(view.elevation),
    )
  }

  function applyCamera() {
    const width = Math.max(1, canvas.clientWidth)
    const height = Math.max(1, canvas.clientHeight)
    const aspect = width / height
    const direction = cameraDirection()
    const position = view.target.clone().addScaledVector(direction, view.distance)

    perspective.aspect = aspect
    perspective.position.copy(position)
    perspective.lookAt(view.target)
    perspective.far = view.distance * 8 + 200
    perspective.updateProjectionMatrix()
    perspective.updateMatrixWorld()

    const halfHeight = view.distance * Math.tan(THREE.MathUtils.degToRad(perspective.fov / 2))
    const halfWidth = halfHeight * aspect
    orthographic.position.copy(position)
    orthographic.lookAt(view.target)
    orthographic.left = -halfWidth
    orthographic.right = halfWidth
    orthographic.top = halfHeight
    orthographic.bottom = -halfHeight
    orthographic.far = view.distance * 8 + 200
    orthographic.updateProjectionMatrix()
    orthographic.updateMatrixWorld()

    gizmoCamera.position.copy(direction).multiplyScalar(4)
    gizmoCamera.lookAt(0, 0, 0)
    gizmoCamera.updateMatrixWorld()
  }

  function activeCamera() {
    return view.ortho ? orthographic : perspective
  }

  /** The name Blender would show for the current view: a standard side, or User once the view was turned freely. */
  function viewName() {
    for (const [name, angles] of Object.entries(VIEWS)) {
      const turn = Math.PI * 2
      const offset = (((view.azimuth - angles.azimuth + Math.PI) % turn) + turn) % turn - Math.PI
      if (Math.abs(view.elevation - angles.elevation) < 0.02 && Math.abs(offset) < 0.02) {
        return name[0].toUpperCase() + name.slice(1)
      }
    }
    return 'User'
  }

  function updateStatus() {
    const target = view.target
    statusEl.textContent =
      `${view.ortho ? 'Orthographic' : 'Perspective'} · ${viewName()} view · ` +
      `target ${target.x.toFixed(2)}, ${target.y.toFixed(2)}, ${target.z.toFixed(2)} · ` +
      `distance ${view.distance.toFixed(1)}`
    projectionButton.textContent = view.ortho ? 'Orthographic' : 'Perspective'
  }

  // ---- drawing ---------------------------------------------------------------------------------------------------

  function requestRender() {
    if (scheduled) return
    scheduled = true
    // A hidden tab pauses animation frames, so a timer draws anyway: the view and the status stay current while the space is not on screen.
    const draw = () => {
      if (!scheduled) return
      scheduled = false
      clearTimeout(fallback)
      render()
    }
    requestAnimationFrame(draw)
    fallback = setTimeout(draw, 120)
  }

  function render() {
    applyCamera()
    updateStatus()

    const width = canvas.clientWidth
    const height = canvas.clientHeight
    webgl.setScissorTest(false)
    webgl.setViewport(0, 0, width, height)
    webgl.render(scene, activeCamera())

    // The gizmo over the top right corner of the same canvas, with its own depth buffer.
    const x = width - GIZMO_SIZE - GIZMO_PAD
    const y = height - GIZMO_SIZE - GIZMO_PAD
    webgl.autoClear = false
    webgl.setScissorTest(true)
    webgl.setViewport(x, y, GIZMO_SIZE, GIZMO_SIZE)
    webgl.setScissor(x, y, GIZMO_SIZE, GIZMO_SIZE)
    webgl.clearDepth()
    webgl.render(gizmoScene, gizmoCamera)
    webgl.setScissorTest(false)
    webgl.autoClear = true
  }

  function resize() {
    const width = canvas.clientWidth
    const height = canvas.clientHeight
    if (width === 0 || height === 0) return
    webgl.setSize(width, height, false)
    requestRender()
  }

  // ---- moving the view -------------------------------------------------------------------------------------------

  /** Point the camera at one of the six standard sides, the way Blender's numpad snaps there. */
  function goTo(name) {
    const angles = VIEWS[name]
    if (angles === undefined) return
    drag = null
    view.azimuth = angles.azimuth
    view.elevation = angles.elevation
    updateStatus()
    requestRender()
  }

  /** Frame the whole grid from the current direction. */
  function frame() {
    drag = null
    view.target.set(0, 0, 0)
    view.distance = FRAME_DISTANCE
    updateStatus()
    requestRender()
  }

  function toggleProjection() {
    view.ortho = !view.ortho
    updateStatus()
    requestRender()
  }

  function zoomBy(factor) {
    view.distance = THREE.MathUtils.clamp(view.distance * factor, MIN_DISTANCE, MAX_DISTANCE)
  }

  /** How much of the space one screen pixel covers at the pivot, so panning keeps the space under the pointer. */
  function worldPerPixel() {
    const height = Math.max(1, canvas.clientHeight)
    return (2 * view.distance * Math.tan(THREE.MathUtils.degToRad(perspective.fov / 2))) / height
  }

  function pan(deltaX, deltaY) {
    const unit = worldPerPixel()
    const right = new THREE.Vector3().setFromMatrixColumn(perspective.matrixWorld, 0)
    const up = new THREE.Vector3().setFromMatrixColumn(perspective.matrixWorld, 1)
    view.target.addScaledVector(right, -deltaX * unit).addScaledVector(up, deltaY * unit)
  }

  // ---- the pointer: orbit, pan and zoom ---------------------------------------------------------------------------

  function gizmoBox() {
    return { left: canvas.clientWidth - GIZMO_SIZE - GIZMO_PAD, top: GIZMO_PAD, size: GIZMO_SIZE }
  }

  /** The gizmo ball under the pointer, if any, as the view it points at. The nearest ball wins, so close ones cannot steal a click. */
  function gizmoUnder(event) {
    const bounds = canvas.getBoundingClientRect()
    const x = event.clientX - bounds.left
    const y = event.clientY - bounds.top
    const box = gizmoBox()
    let nearest
    let nearestDistance = GIZMO_HIT
    for (const ball of gizmoBalls) {
      const projected = ball.position.clone().project(gizmoCamera)
      const ballX = box.left + (projected.x * 0.5 + 0.5) * GIZMO_SIZE
      const ballY = box.top + (-projected.y * 0.5 + 0.5) * GIZMO_SIZE
      const distance = Math.hypot(x - ballX, y - ballY)
      if (distance <= nearestDistance) {
        nearest = ball.view
        nearestDistance = distance
      }
    }
    return nearest
  }

  function inGizmo(event) {
    const bounds = canvas.getBoundingClientRect()
    const x = event.clientX - bounds.left
    const y = event.clientY - bounds.top
    const box = gizmoBox()
    return x >= box.left && x <= box.left + box.size && y >= box.top && y <= box.top + box.size
  }

  canvas.addEventListener('pointerdown', (event) => {
    // Left and middle drag both grab the space; a right drag stays free for a context menu in a later state.
    if (event.button !== 0 && event.button !== 1) return
    if (inGizmo(event)) {
      const target = gizmoUnder(event)
      if (target !== undefined) {
        goTo(target)
        return
      }
    }
    event.preventDefault()
    canvas.setPointerCapture(event.pointerId)
    // Shift drags pan, Ctrl with the middle button zooms (Blender's dolly); everything else orbits, so holding the plain left button grabs the space.
    const mode =
      event.button === 1 && (event.ctrlKey || event.metaKey) ? 'zoom' : event.shiftKey ? 'pan' : 'orbit'
    drag = { mode, x: event.clientX, y: event.clientY }
  })

  canvas.addEventListener('pointermove', (event) => {
    if (drag === null) return
    const deltaX = event.clientX - drag.x
    const deltaY = event.clientY - drag.y
    drag.x = event.clientX
    drag.y = event.clientY
    if (drag.mode === 'orbit') {
      view.azimuth -= deltaX * 0.006
      view.elevation = THREE.MathUtils.clamp(view.elevation + deltaY * 0.006, -ELEVATION_LIMIT, ELEVATION_LIMIT)
    } else if (drag.mode === 'pan') {
      pan(deltaX, deltaY)
    } else {
      zoomBy(Math.exp(deltaY * 0.005))
    }
    updateStatus()
    requestRender()
  })

  function endDrag(event) {
    if (drag === null) return
    drag = null
    if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId)
  }
  canvas.addEventListener('pointerup', endDrag)
  canvas.addEventListener('pointercancel', endDrag)
  canvas.addEventListener('mousedown', (event) => {
    if (event.button === 1) event.preventDefault() // no middle click autoscroll
  })
  canvas.addEventListener('contextmenu', (event) => event.preventDefault())
  canvas.addEventListener(
    'wheel',
    (event) => {
      event.preventDefault()
      zoomBy(Math.exp(event.deltaY * 0.0015))
      updateStatus()
      requestRender()
    },
    { passive: false },
  )

  // ---- the keyboard: Blender's numpad views ------------------------------------------------------------

  window.addEventListener('keydown', (event) => {
    const element = event.target
    if (element instanceof HTMLElement && (element.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(element.tagName))) {
      return
    }
    if (event.key === 'Home' || event.key === '.' || event.code === 'NumpadDecimal') {
      event.preventDefault()
      frame()
      return
    }
    if (event.code === 'Numpad5' || event.code === 'NumpadClear') {
      event.preventDefault()
      toggleProjection()
      return
    }
    const target = VIEW_KEYS[event.code]
    if (target !== undefined) {
      event.preventDefault()
      goTo(event.ctrlKey || event.metaKey ? OPPOSITE[target] : target)
    }
  })

  // ---- the HUD ---------------------------------------------------------------------------------------------------

  for (const button of document.querySelectorAll('[data-view]')) {
    button.addEventListener('click', () => goTo(button.dataset.view))
  }
  projectionButton.addEventListener('click', toggleProjection)
  frameButton.addEventListener('click', frame)
  // The choice is shared with the Flat state, which draws the same solid unfolded.
  const selectionUrl = document.getElementById('space-root')?.dataset.selection
  let saving = Promise.resolve()
  for (const button of document.querySelectorAll('[data-mesh]')) {
    button.addEventListener('click', () => {
      showSolid(button.dataset.mesh)
      if (selectionUrl === undefined || selectionUrl === '') return
      // One request after another, so a burst of clicks cannot save an older solid last.
      saving = saving
        .then(() =>
          fetch(selectionUrl, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ solid: button.dataset.mesh }),
          }),
        )
        .then(
          () => undefined,
          () => undefined,
        )
    })
  }
  // The page comes with the shared selection already pressed.
  const chosen = document.querySelector('[data-mesh][aria-pressed="true"]')?.dataset.mesh
  showSolid(chosen ?? 'cube')

  new ResizeObserver(resize).observe(canvas)
  canvas.addEventListener('webglcontextlost', (event) => {
    event.preventDefault()
    errorEl.hidden = false
    errorEl.textContent = 'The browser lost the WebGL context. Reload the page to get the space back.'
  })

  resize()
  applyCamera()
  render()
}
