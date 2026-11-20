/**
 * The solid both states show: the 3D state picks it with its mesh bar, the Flat state draws it unfolded.
 *
 * One selection for the whole app, kept in a JSON file in the app's home so it survives a reload, and served at `/selection` for the page's browser
 * code. `ctx.selection` is the shared value itself, for a page that renders on the server.
 */
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Context } from '@deepseek-ai/cordis'
import { Acryl } from '@acryldev/blends'
import type {} from '@acryldev/instance'

export const name = 'selection'
export const inject = ['router', 'appInstance']

/** The solids the app can show, in the order the mesh bar offers them. The ids match its `data-mesh` buttons. */
export const SOLIDS = ['tetrahedron', 'cube', 'octahedron', 'dodecahedron', 'icosahedron'] as const
export type Solid = (typeof SOLIDS)[number]

/** The catalogue of filters a face can show over the camera feed. */
export const FILTERS = ['none', 'hue', 'mono', 'sepia', 'invert'] as const
export type FaceFilter = (typeof FILTERS)[number]

/** How the feed is turned on a face. */
export const ORIENTATIONS = ['none', 'flipV', 'right', 'left'] as const
export type FaceOrientation = (typeof ORIENTATIONS)[number]

/** One face's look: the filter, its hue (for `hue`), and the feed's direction. */
export interface FaceStyle {
  readonly filter: FaceFilter
  readonly hue: number
  readonly orientation: FaceOrientation
}

/** The faces of one solid by their outward normal (`x,y,z` to three places), so the 3D solid and the unfolded net agree on which face is which. */
export type FaceStyles = Readonly<Record<string, FaceStyle>>

/** The default look: no filter, the feed as it comes. */
export const PLAIN_FACE: FaceStyle = { filter: 'none', hue: 0, orientation: 'none' }

/** The shared selection: one solid, and the way to change it. */
export interface Selection {
  /** The solid the states show now. */
  readonly solid: Solid
  /**
   * Whether the pages show the camera on the solid and its net. Kept in memory only: switching states keeps it, but a restart starts with the
   * camera off, so a camera is never opened without the person asking in this run.
   */
  readonly camera: boolean
  /** Choose a solid and write it down. */
  choose(solid: Solid): Solid
  /** Turn the camera on or off for both states. */
  showCamera(on: boolean): boolean
  /** The face styles of the solid shown now. */
  readonly faces: FaceStyles
  /** Replace the face styles of the solid shown now (the page that randomized sends its whole map). */
  setFaces(faces: FaceStyles): FaceStyles
}

declare module '@deepseek-ai/cordis' {
  interface Context {
    selection: Selection
  }
}

export const isSolid = (value: unknown): value is Solid =>
  typeof value === 'string' && (SOLIDS as readonly string[]).includes(value)

const isFilter = (value: unknown): value is FaceFilter => typeof value === 'string' && (FILTERS as readonly string[]).includes(value)
const isOrientation = (value: unknown): value is FaceOrientation =>
  typeof value === 'string' && (ORIENTATIONS as readonly string[]).includes(value)

/** A face style map from a request: filter and direction known, hue a real number, at most 64 faces. */
export function isFaceStyles(value: unknown): value is FaceStyles {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false
  const entries = Object.entries(value)
  if (entries.length > 64) return false
  return entries.every(([key, style]) => {
    if (key.length === 0 || key.length > 80) return false
    if (typeof style !== 'object' || style === null) return false
    const face = style as { filter?: unknown, hue?: unknown, orientation?: unknown }
    return isFilter(face.filter) && isOrientation(face.orientation) && typeof face.hue === 'number' && Number.isFinite(face.hue)
  })
}

const emptyStyles = (): Record<Solid, FaceStyles> => ({
  tetrahedron: {},
  cube: {},
  octahedron: {},
  dodecahedron: {},
  icosahedron: {},
})

/** What the file holds, or the cube when it is missing or says something this app does not know. */
function readSelection(file: string): Solid {
  if (!existsSync(file)) return 'cube'
  try {
    const parsed: unknown = JSON.parse(readFileSync(file, 'utf8'))
    const solid = (parsed as { solid?: unknown } | null)?.solid
    return isSolid(solid) ? solid : 'cube'
  } catch {
    return 'cube'
  }
}

/** A whole-file write through a temporary file and a rename, so a crash never leaves half a selection. */
function writeSelection(file: string, solid: Solid): void {
  mkdirSync(join(file, '..'), { recursive: true })
  const temporary = `${file}.${String(process.pid)}.tmp`
  writeFileSync(temporary, `${JSON.stringify({ solid }, null, 2)}\n`)
  renameSync(temporary, file)
}

export function apply(ctx: Context): void {
  const file = join(ctx.appInstance.home, `${name}.json`)
  let current = readSelection(file)
  let camera = false
  // Face styles belong to a solid and to this run only, like the camera: they are not written down.
  let styles = emptyStyles()
  const selection: Selection = {
    get solid() {
      return current
    },
    get camera() {
      return camera
    },
    choose(solid) {
      current = solid
      writeSelection(file, solid)
      return solid
    },
    showCamera(on) {
      camera = on
      return camera
    },
    get faces() {
      return styles[current]
    },
    setFaces(faces) {
      styles = { ...styles, [current]: faces }
      return styles[current]
    },
  }
  ctx.provide('selection', selection)
  const state = () => ({ solid: selection.solid, camera: selection.camera, faces: selection.faces })
  const app = new Acryl()
    .get('/', (c) => c.json(state()))
    .post('/', async (c) => {
      const body = (await c.req.json().catch(() => ({}))) as { solid?: unknown, camera?: unknown, faces?: unknown }
      if (body.solid === undefined && body.camera === undefined && body.faces === undefined)
        return c.json({ error: 'send a solid, a camera state or faces' }, 400)
      if (body.solid !== undefined && !isSolid(body.solid)) return c.json({ error: `solid must be one of: ${SOLIDS.join(', ')}` }, 400)
      if (body.camera !== undefined && typeof body.camera !== 'boolean') return c.json({ error: 'camera must be true or false' }, 400)
      if (body.faces !== undefined && !isFaceStyles(body.faces)) return c.json({ error: 'faces must map face normals to a filter, a hue and a direction' }, 400)
      if (isSolid(body.solid)) selection.choose(body.solid)
      if (typeof body.camera === 'boolean') selection.showCamera(body.camera)
      if (isFaceStyles(body.faces)) selection.setFaces(body.faces)
      return c.json(state())
    })
  ctx.router.route('/selection', app)
}
