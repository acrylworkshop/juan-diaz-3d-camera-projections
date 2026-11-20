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
    assert.deepEqual(selection, { solid: 'cube' })

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
    assert.deepEqual(await answer.json(), { solid: 'icosahedron' })
    assert.deepEqual(await (await app.root.router.request('/selection')).json(), { solid: 'icosahedron' })

    const flat = await (await app.root.router.request('/flat')).text()
    assert.match(flat, /Icosahedron · unfolded flat/)
    assert.equal(count(flat, '<polygon'), 20)

    const space = await (await app.root.router.request('/space')).text()
    assert.match(space, /data-mesh="icosahedron" aria-pressed="true"/)
    assert.match(space, /data-mesh="cube" aria-pressed="false"/)
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
    assert.deepEqual(await (await app.root.router.request('/selection')).json(), { solid: 'cube' })
  }))

test('the chosen solid survives a restart', async () => {
  const home = await mkdtemp(join(scratch, 'selection-restart-'))
  try {
    const first = await boot(home)
    try {
      assert.equal((await choose(first, 'dodecahedron')).status, 200)
    } finally {
      await first.stop()
    }
    const second = await boot(home)
    try {
      assert.deepEqual(await (await second.root.router.request('/selection')).json(), { solid: 'dodecahedron' })
      const flat = await (await second.root.router.request('/flat')).text()
      assert.equal(count(flat, '<polygon'), 12)
    } finally {
      await second.stop()
    }
  } finally {
    await rm(home, { recursive: true, force: true })
  }
})
