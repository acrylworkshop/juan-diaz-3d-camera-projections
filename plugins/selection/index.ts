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
}

declare module '@deepseek-ai/cordis' {
  interface Context {
    selection: Selection
  }
}

export const isSolid = (value: unknown): value is Solid =>
  typeof value === 'string' && (SOLIDS as readonly string[]).includes(value)

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
  }
  ctx.provide('selection', selection)
  const app = new Acryl()
    .get('/', (c) => c.json({ solid: selection.solid, camera: selection.camera }))
    .post('/', async (c) => {
      const body = (await c.req.json().catch(() => ({}))) as { solid?: unknown, camera?: unknown }
      if (body.solid === undefined && body.camera === undefined) return c.json({ error: 'send a solid or a camera state' }, 400)
      if (body.solid !== undefined && !isSolid(body.solid)) return c.json({ error: `solid must be one of: ${SOLIDS.join(', ')}` }, 400)
      if (body.camera !== undefined && typeof body.camera !== 'boolean') return c.json({ error: 'camera must be true or false' }, 400)
      if (isSolid(body.solid)) selection.choose(body.solid)
      if (typeof body.camera === 'boolean') selection.showCamera(body.camera)
      return c.json({ solid: selection.solid, camera: selection.camera })
    })
  ctx.router.route('/selection', app)
}
