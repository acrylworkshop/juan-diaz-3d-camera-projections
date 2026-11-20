/** The Images state: the second state of the app, a page of its own, empty for now. */
import type { Context } from '@deepseek-ai/cordis'
import { Acryl } from '@acryldev/blends'
import { imagesPage } from './page.ts'

export const name = 'images'
export const inject = ['router']

export function apply(ctx: Context): void {
  const app = new Acryl().get('/', (c) => c.html(imagesPage()))
  ctx.router.route('/images', app)
}
