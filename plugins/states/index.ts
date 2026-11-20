/**
 * The state menu: a bar at the top of every state page for switching between them (3D orbit, Images), and the list of states it shows.
 *
 * The bar is added to a state page's own HTML as the page leaves the app, so a state plugin owns its page's layout and knows nothing about the menu.
 * A page that is not a state (`/about`, the app's JSON root) is left exactly as it is.
 */
import type { Context } from '@deepseek-ai/cordis'
import { locateState, STATE_MENU_STYLE, stateMenu } from './menu.ts'

export const name = 'states'
export const inject = ['router']

interface PageContext {
  res: Response
  req: { path: string }
}

export function apply(ctx: Context): void {
  /** Put the bar in a state page's HTML: its styles in the head, its links before the body ends. */
  const addMenu = async (c: PageContext, next: () => Promise<void>): Promise<void> => {
    await next()
    if (!(c.res.headers.get('content-type') ?? '').includes('text/html')) return
    const located = locateState(c.req.path)
    if (located === undefined) return
    let html = await c.res.text()
    if (html.includes('id="state-menu"')) return
    const headers = new Headers(c.res.headers)
    headers.delete('content-length')
    html = html.includes('</head>') ? html.replace('</head>', `${STATE_MENU_STYLE}</head>`) : STATE_MENU_STYLE + html
    const bar = stateMenu(located)
    html = html.includes('</body>') ? html.replace('</body>', `${bar}</body>`) : html + bar
    c.res = new Response(html, { status: c.res.status, headers })
  }
  // A wrapper sees every response, including pages of plugins that started before this one, so the bar follows a state page whatever mounted it.
  ctx.router.wrap(addMenu as never)
}
