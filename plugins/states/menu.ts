/**
 * The app's states, as the state menu lists them, and the bar that switches between them.
 *
 * A state is a page of its own, served by its own plugin (3D by `space`, Flat by `flat`). The bar carries a link to each of them, with the
 * page's own path kept as the app writes it, so it works on the app's own server and under the frame's canvas prefix alike.
 */

export interface AppState {
  readonly id: string
  readonly title: string
  /** The page's path as the app serves it, without the prefix the host mounts the app at. */
  readonly path: string
}

/** The states, in the order the menu shows them. The first one is the app's main state. */
export const STATES: readonly AppState[] = [
  { id: '3d', title: '3D', path: '/space' },
  { id: 'flat', title: 'Flat', path: '/flat' },
]

export interface LocatedState {
  readonly state: AppState
  /** The prefix the app is mounted at: `''` on its own server, `/app` in the frame's canvas. */
  readonly base: string
}

/** The path with every segment re-encoded, so a path taken from a request is safe in HTML and in an href. */
function canonicalPath(requestPath: string): string {
  const segments = requestPath
    .split('/')
    .filter((segment) => segment !== '')
    .map((segment) => encodeURIComponent(segment))
  return `/${segments.join('/')}`
}

/** The state a request path belongs to, with the prefix before it, or `undefined` for a page that is not a state. */
export function locateState(requestPath: string): LocatedState | undefined {
  const path = canonicalPath(requestPath)
  for (const state of STATES) {
    if (path === state.path || path.endsWith(state.path)) {
      return { state, base: path.slice(0, path.length - state.path.length) }
    }
  }
  return undefined
}

/** The bar itself: one link per state, the current page marked. */
export function stateMenu(located: LocatedState): string {
  const links = STATES.map((state) => {
    const current = state.id === located.state.id ? ' aria-current="page"' : ''
    return `<a href="${located.base}${state.path}"${current}>${state.title}</a>`
  }).join('')
  return `<nav id="state-menu" aria-label="App states">${links}</nav>`
}

/** The bar's styles, with the room it takes at the top of the page it is added to. */
export const STATE_MENU_STYLE = `<style>
  #state-menu {
    position: fixed;
    inset: 0 0 auto 0;
    z-index: 100;
    display: flex;
    align-items: center;
    gap: 4px;
    height: 46px;
    padding: 0 12px;
    background: #141414;
    border-bottom: 1px solid #303030;
    font: 13px/1 ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
  }
  #state-menu a {
    padding: 6px 12px;
    border: 1px solid transparent;
    border-radius: 7px;
    color: #c4c4c4;
    text-decoration: none;
    white-space: nowrap;
  }
  #state-menu a:hover {
    background: #242424;
    color: #ffffff;
  }
  #state-menu a:focus-visible {
    outline: 2px solid #3b82f6;
    outline-offset: 1px;
  }
  #state-menu a[aria-current="page"] {
    background: #223247;
    border-color: #37506e;
    color: #ffffff;
  }
  body {
    box-sizing: border-box;
    padding-top: 46px;
  }
</style>`
