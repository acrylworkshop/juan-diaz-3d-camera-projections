/** The Flat state: the second state of the app, a page of its own, empty for now. */
import type { Context } from '@deepseek-ai/cordis'
import { Acryl } from '@acryldev/blends'
import { flatPage } from './page.ts'

export const name = 'flat'
export const inject = ['router']

export function apply(ctx: Context): void {
  const app = new Acryl().get('/', (c) => c.html(flatPage()))
  ctx.router.route('/flat', app)
}
