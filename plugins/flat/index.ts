/** The Flat state: the solid the 3D state selected, unfolded into one flat sheet. */
import type { Context } from '@deepseek-ai/cordis'
import { Acryl } from '@acryldev/blends'
import type {} from '../selection/index.ts'
import { flatPage } from './page.ts'

export const name = 'flat'
export const inject = ['router', 'selection']

export function apply(ctx: Context): void {
  const app = new Acryl().get('/', (c) => c.html(flatPage(ctx.selection.solid)))
  ctx.router.route('/flat', app)
}
