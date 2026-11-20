import assert from 'node:assert/strict'
import { mkdirSync } from 'node:fs'
import { mkdtemp, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { pinnedInstance, withPort } from '@acryldev/instance'
import { type App, createApp } from '../src/app.ts'

/** Throwaway homes live inside the project, like the ones test/app.test.ts makes. */
const scratch = join(fileURLToPath(new URL('..', import.meta.url)), '.acrylblends', 'test')
mkdirSync(scratch, { recursive: true })
const projectRoot = fileURLToPath(new URL('..', import.meta.url))

const boot = (home: string): Promise<App> =>
  createApp(withPort(pinnedInstance(home, { root: projectRoot }), 0), { listen: false })

const count = (page: string, fragment: string): number => page.split(fragment).length - 1

/** Boot the app in a throwaway home, run the test, always stop it and remove the home. */
async function withApp(run: (app: App) => Promise<void>): Promise<void> {
  const home = await mkdtemp(join(scratch, 'selection-test-'))
  const app = await boot(home)
  try {
    await run(app)
  } finally {
    await app.stop()
    await rm(home, { recursive: true, force: true })
  }
}

const choose = (app: App, solid: unknown) =>
  app.root.router.request('/selection', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ solid }),
  })

test('the selection starts as the cube and both states show it', () =>
  withApp(async (app) => {
    const selection = await (await app.root.router.request('/selection')).json()
    assert.deepEqual(selection, { solid: 'cube', camera: false, faces: {} })

    const space = await (await app.root.router.request('/space')).text()
    assert.match(space, /data-mesh="cube" aria-pressed="true"/)
    assert.match(space, /data-selection="\/selection"/)

    const flat = await (await app.root.router.request('/flat')).text()
    assert.match(flat, /Cube · unfolded flat/)
    assert.equal(count(flat, '<polygon'), 6)
  }))

test('choosing a solid changes the Flat net and the 3D pressed button', () =>
  withApp(async (app) => {
    const answer = await choose(app, 'icosahedron')
    assert.equal(answer.status, 200)
    assert.deepEqual(await answer.json(), { solid: 'icosahedron', camera: false, faces: {} })
    assert.deepEqual(await (await app.root.router.request('/selection')).json(), { solid: 'icosahedron', camera: false, faces: {} })

    const flat = await (await app.root.router.request('/flat')).text()
    assert.match(flat, /Icosahedron · unfolded flat/)
    assert.equal(count(flat, '<polygon'), 20)

    const space = await (await app.root.router.request('/space')).text()
    assert.match(space, /data-mesh="icosahedron" aria-pressed="true"/)
    assert.match(space, /data-mesh="cube" aria-pressed="false"/)
  }))

test('the camera is shared by both states and starts off', () =>
  withApp(async (app) => {
    const on = await app.root.router.request('/selection', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ camera: true }),
    })
    assert.equal(on.status, 200)
    assert.deepEqual(await on.json(), { solid: 'cube', camera: true, faces: {} })
    assert.deepEqual(await (await app.root.router.request('/selection')).json(), { solid: 'cube', camera: true, faces: {} })

    const space = await (await app.root.router.request('/space')).text()
    assert.match(space, /data-camera="on"/)
    assert.match(space, /id="space-camera" aria-pressed="true"/)
    const flat = await (await app.root.router.request('/flat')).text()
    assert.match(flat, /data-camera="on"/)
    assert.match(flat, /id="flat-camera" aria-pressed="true"/)
  }))

test('a camera value that is not a boolean is refused', () =>
  withApp(async (app) => {
    const wrong = await app.root.router.request('/selection', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ camera: 'yes' }),
    })
    assert.equal(wrong.status, 400)
    const empty = await app.root.router.request('/selection', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
    })
    assert.equal(empty.status, 400)
  }))

test('face styles are shared, kept per solid, and validated', () =>
  withApp(async (app) => {
    const faces = {
      '1.000,0.000,0.000': { filter: 'hue', hue: 120, orientation: 'right' },
      '0.000,1.000,0.000': { filter: 'mono', hue: 0, orientation: 'flipV' },
    }
    const answer = await app.root.router.request('/selection', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ faces }),
    })
    assert.equal(answer.status, 200)
    assert.deepEqual(await answer.json(), { solid: 'cube', camera: false, faces })
    assert.deepEqual((await (await app.root.router.request('/selection')).json()).faces, faces)

    // Another solid keeps its own map.
    assert.equal((await choose(app, 'octahedron')).status, 200)
    assert.deepEqual((await (await app.root.router.request('/selection')).json()).faces, {})
    assert.equal((await choose(app, 'cube')).status, 200)
    assert.deepEqual((await (await app.root.router.request('/selection')).json()).faces, faces)

    const flat = await (await app.root.router.request('/flat')).text()
    assert.match(flat, /"filter":"hue"/)
    const space = await (await app.root.router.request('/space')).text()
    assert.match(space, /id="space-faces"/)

    const wrongFilter = await app.root.router.request('/selection', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ faces: { '1.000,0.000,0.000': { filter: 'blur', hue: 0, orientation: 'none' } } }),
    })
    assert.equal(wrongFilter.status, 400)
    const wrongDirection = await app.root.router.request('/selection', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ faces: { '1.000,0.000,0.000': { filter: 'hue', hue: 0, orientation: 'sideways' } } }),
    })
    assert.equal(wrongDirection.status, 400)
  }))

test('a solid the app does not know is refused and changes nothing', () =>
  withApp(async (app) => {
    assert.equal((await choose(app, 'sphere')).status, 400)
    const malformed = await app.root.router.request('/selection', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: 'not json',
    })
    assert.equal(malformed.status, 400)
    assert.deepEqual(await (await app.root.router.request('/selection')).json(), { solid: 'cube', camera: false, faces: {} })
  }))

test('the chosen solid survives a restart', async () => {
  const home = await mkdtemp(join(scratch, 'selection-restart-'))
  try {
    const first = await boot(home)
    try {
      assert.equal((await choose(first, 'dodecahedron')).status, 200)
      // The camera is a run-time switch only: it goes off with the app, while the solid is kept.
      await first.root.router.request('/selection', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ camera: true }),
      })
    } finally {
      await first.stop()
    }
    const second = await boot(home)
    try {
      assert.deepEqual(await (await second.root.router.request('/selection')).json(), { solid: 'dodecahedron', camera: false, faces: {} })
      const flat = await (await second.root.router.request('/flat')).text()
      assert.equal(count(flat, '<polygon'), 12)
    } finally {
      await second.stop()
    }
  } finally {
    await rm(home, { recursive: true, force: true })
  }
})
