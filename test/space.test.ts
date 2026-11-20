import assert from 'node:assert/strict'
import { mkdirSync } from 'node:fs'
import { mkdtemp, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { pinnedInstance, withPort } from '@acryldev/instance'
import { type App, createApp } from '../src/app.ts'
import { spacePage, spacePath } from '../plugins/space/page.ts'

/** Throwaway homes live inside the project, like the ones test/app.test.ts makes. */
const scratch = join(fileURLToPath(new URL('..', import.meta.url)), '.acrylblends', 'test')
mkdirSync(scratch, { recursive: true })

const projectRoot = fileURLToPath(new URL('..', import.meta.url))

async function withApp(run: (app: App) => Promise<void>) {
  const home = await mkdtemp(join(scratch, 'space-test-'))
  const app = await createApp(withPort(pinnedInstance(home, { root: projectRoot }), 0), { listen: false })
  try {
    await run(app)
  } finally {
    await app.stop()
    await rm(home, { recursive: true, force: true })
  }
}

test('GET /space renders the state 1 page with its HUD and the space module', () =>
  withApp(async (app) => {
    const response = await app.root.router.request('/space')
    assert.equal(response.status, 200)
    assert.match(response.headers.get('content-type') ?? '', /html/)
    const page = await response.text()
    assert.match(page, /<h1>3D<\/h1>/)
    assert.match(page, /<canvas id="space-canvas"/)
    assert.match(page, /data-view="front"/)
    assert.match(page, /data-view="top"/)
    // The vertical mesh bar: one button per solid, the cube chosen at the start.
    assert.match(page, /<aside id="space-meshes" aria-label="Meshes">/)
    for (const mesh of ['tetrahedron', 'cube', 'octahedron', 'dodecahedron', 'icosahedron'])
      assert.match(page, new RegExp(`data-mesh="${mesh}"`))
    assert.match(page, /data-mesh="cube" aria-pressed="true"/)
    assert.match(page, /<script type="module" src="\/space\/client\/space\.js"><\/script>/)
    // The import map points the browser module at the three.js build this plugin serves.
    assert.match(page, /"three":"\/space\/vendor\/three\.module\.js"/)
  }))

test('the page derives its URLs from the request path, so the frame prefix works', () => {
  assert.equal(spacePath('/space'), '/space')
  assert.equal(spacePath('/app/space'), '/app/space')
  assert.equal(spacePath('/app/space/'), '/app/space')
  const page = spacePage('/app/space')
  assert.match(page, /<script type="module" src="\/app\/space\/client\/space\.js"><\/script>/)
  assert.match(page, /"three":"\/app\/space\/vendor\/three\.module\.js"/)
  assert.doesNotMatch(page, /"three":"\/space\//)
})

test('a crafted request path cannot inject markup into the page', () => {
  const page = spacePage('/space/"><script>alert(1)</script>')
  assert.doesNotMatch(page, /<script>alert\(1\)<\/script>/)
  assert.match(page, /%22%3E%3Cscript%3E/)
})

test('the space module and the two three.js builds are served as JavaScript', () =>
  withApp(async (app) => {
    const module = await app.root.router.request('/space/client/space.js')
    assert.equal(module.status, 200)
    assert.match(module.headers.get('content-type') ?? '', /javascript/)
    const source = await module.text()
    assert.match(source, /from 'three'/)
    assert.match(source, /new THREE\.WebGLRenderer/)

    for (const file of ['three.module.js', 'three.core.js']) {
      const build = await app.root.router.request(`/space/vendor/${file}`)
      assert.equal(build.status, 200, file)
      assert.match(build.headers.get('content-type') ?? '', /javascript/)
      assert.ok((await build.text()).length > 1000, file)
    }
  }))

test('the vendor route serves its two files and nothing else', () =>
  withApp(async (app) => {
    assert.equal((await app.root.router.request('/space/vendor/package.json')).status, 404)
    assert.equal((await app.root.router.request('/space/vendor/../../package.json')).status, 404)
    assert.equal((await app.root.router.request('/space/vendor/three.cjs')).status, 404)
  }))
