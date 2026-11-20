/**
 * State 1: a three.js 3D space with Blender-like navigation (orbit, pan, zoom, numpad views) and painted X, Y and Z axes.
 *
 * The page is served at `/space` (the frame's canvas shows it at `/app/space`). The page, the browser module and the two three.js builds all come from
 * this plugin, and the page derives its URLs from the request path, so nothing here names the frame's prefix.
 */
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import type { Context } from '@deepseek-ai/cordis'
import { Acryl } from '@acryldev/blends'
import type {} from '../selection/index.ts'
import { spacePage } from './page.ts'

export const name = 'space'
export const inject = ['router', 'selection']

/** The only files below three's `build/` that are served: the module and the core it re-exports. */
const THREE_FILES = new Set(['three.module.js', 'three.core.js'])
const JAVASCRIPT = 'text/javascript; charset=utf-8'
const HEADERS = { 'content-type': JAVASCRIPT, 'cache-control': 'no-cache' }

/** The folder of three's browser builds, or `undefined` when three is not installed. */
function threeBuildDir(): string | undefined {
  // `three` has no "./package.json" export, so resolve the package entry itself; the app's own folder is the second guess for a plugin staged
  // somewhere else (a live install) that cannot see the app's node_modules from its own URL.
  for (const base of [import.meta.url, join(process.cwd(), 'package.json')]) {
    try {
      return dirname(createRequire(base).resolve('three'))
    } catch {
      // try the next base
    }
  }
  return undefined
}

export function apply(ctx: Context): void {
  const build = threeBuildDir()
  const files = new Map<string, string | undefined>()

  /** A file of this plugin, read once; `undefined` when it is not there. */
  const own = (relative: string): string | undefined => {
    if (!files.has(relative)) {
      try {
        files.set(relative, readFileSync(new URL(relative, import.meta.url), 'utf8'))
      } catch {
        files.set(relative, undefined)
      }
    }
    return files.get(relative)
  }

  /** A browser build of three, by its exact file name. */
  const vendor = (file: string): string | undefined => {
    if (build === undefined || !THREE_FILES.has(file)) return undefined
    const key = `vendor/${file}`
    if (!files.has(key)) {
      try {
        files.set(key, readFileSync(join(build, file), 'utf8'))
      } catch {
        files.set(key, undefined)
      }
    }
    return files.get(key)
  }

  const app = new Acryl()
    .get('/', (c) => c.html(spacePage(c.req.path, ctx.selection.solid, ctx.selection.camera, ctx.selection.faces)))
    .get('/client/space.js', (c) => {
      const source = own('./client/space.js')
      return source === undefined
        ? c.text('the space module is missing', 500)
        : c.body(source, 200, HEADERS)
    })
    .get('/vendor/:file', (c) => {
      const source = vendor(c.req.param('file'))
      return source === undefined
        ? c.text('not found', 404)
        : c.body(source, 200, HEADERS)
    })

  ctx.router.route('/space', app)
}
