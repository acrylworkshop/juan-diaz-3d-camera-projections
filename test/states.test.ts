import assert from 'node:assert/strict'
import { mkdirSync } from 'node:fs'
import { mkdtemp, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { pinnedInstance, withPort } from '@acryldev/instance'
import { type App, createApp } from '../src/app.ts'
import { locateState, stateMenu, STATES } from '../plugins/states/menu.ts'

/** Throwaway homes live inside the project, like the ones test/app.test.ts makes. */
const scratch = join(fileURLToPath(new URL('..', import.meta.url)), '.acrylblends', 'test')
mkdirSync(scratch, { recursive: true })

const projectRoot = fileURLToPath(new URL('..', import.meta.url))

async function withApp(run: (app: App) => Promise<void>) {
  const home = await mkdtemp(join(scratch, 'states-test-'))
  const app = await createApp(withPort(pinnedInstance(home, { root: projectRoot }), 0), { listen: false })
  try {
    await run(app)
  } finally {
    await app.stop()
    await rm(home, { recursive: true, force: true })
  }
}

test('the state menu lists the app states and marks the page it is on', () =>
  withApp(async (app) => {
    const response = await app.root.router.request('/space')
    assert.equal(response.status, 200)
    const page = await response.text()
    assert.match(page, /<nav id="state-menu" aria-label="App states">/)
    assert.match(page, /<a href="\/space" aria-current="page">3D orbit<\/a>/)
    assert.match(page, /<a href="\/images">Images<\/a>/)
    // The bar reserves its height at the top of the page, so the state's own layout starts below it.
    assert.match(page, /padding-top: 46px/)
  }))

test('the Images state is a page of its own, empty for now, with Images marked in the menu', () =>
  withApp(async (app) => {
    const response = await app.root.router.request('/images')
    assert.equal(response.status, 200)
    assert.match(response.headers.get('content-type') ?? '', /html/)
    const page = await response.text()
    assert.match(page, /<h1>Images<\/h1>/)
    assert.match(page, /Empty for now\./)
    assert.match(page, /<a href="\/space">3D orbit<\/a>/)
    assert.match(page, /<a href="\/images" aria-current="page">Images<\/a>/)
  }))

test('a page that is not a state gets no menu', () =>
  withApp(async (app) => {
    const page = await (await app.root.router.request('/about')).text()
    assert.doesNotMatch(page, /state-menu/)
  }))

test('the menu follows the prefix the app is mounted at', () => {
  assert.deepEqual(STATES.map((state) => state.id), ['orbit', 'images'])
  const located = locateState('/app/space')
  assert.equal(located?.state.id, 'orbit')
  assert.equal(located?.base, '/app')
  const bar = stateMenu({ state: located!.state, base: located!.base })
  assert.match(bar, /href="\/app\/space" aria-current="page"/)
  assert.match(bar, /href="\/app\/images"/)
  assert.doesNotMatch(bar, /href="\/app\/app\//)
})

test('a crafted request path cannot inject markup through the menu', () => {
  const located = locateState('/x"><script>alert(1)</script>/space')
  assert.equal(located?.state.id, 'orbit')
  const bar = stateMenu(located!)
  assert.doesNotMatch(bar, /<script>/)
  assert.match(bar, /%22%3E%3Cscript%3E/)
})
