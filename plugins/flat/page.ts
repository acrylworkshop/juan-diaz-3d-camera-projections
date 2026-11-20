/**
 * The page of the Flat state: the solid the 3D state selected, unfolded into one flat sheet, the way paper comes apart.
 */
import type { Solid } from '../selection/index.ts'
import { netSvg } from './nets.ts'

const NAMES: Record<Solid, string> = {
  tetrahedron: 'Tetrahedron',
  cube: 'Cube',
  octahedron: 'Octahedron',
  dodecahedron: 'Dodecahedron',
  icosahedron: 'Icosahedron',
}

/** The page: the net on dark ground, with the state and the solid it belongs to above it. */
export function flatPage(solid: Solid): string {
  const name = NAMES[solid]
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Flat · ${name}</title>
    <style>
      :root {
        color-scheme: dark;
      }
      * {
        box-sizing: border-box;
      }
      html,
      body {
        height: 100%;
        margin: 0;
        overflow: hidden;
        background: #1d1d1d;
      }
      body {
        color: #e8e8e8;
        font: 13px/1.5 ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
      }
      #flat-state {
        display: flex;
        height: 100%;
        flex-direction: column;
        gap: 4px;
        padding: 16px;
      }
      #flat-head {
        display: flex;
        align-items: baseline;
        gap: 10px;
      }
      #flat-head h1 {
        margin: 0;
        font-size: 12px;
        font-weight: 600;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: #a9a9a9;
      }
      #flat-solid {
        margin: 0;
        font-size: 14px;
        color: #e8e8e8;
      }
      #flat-net {
        display: grid;
        flex: 1;
        margin: 0;
        min-height: 0;
        place-items: center;
      }
      #flat-net svg {
        width: 100%;
        height: 100%;
        max-width: 1100px;
        filter: drop-shadow(0 12px 26px rgba(0, 0, 0, 0.55));
      }
      #flat-net polygon {
        fill: #f4f0e6;
        stroke: #1a1a1a;
        stroke-width: 1.25;
        stroke-linejoin: round;
        vector-effect: non-scaling-stroke;
      }
      #flat-net .flat-dot {
        fill: #1a1a1a;
      }
    </style>
  </head>
  <body>
    <main id="flat-state">
      <header id="flat-head">
        <h1>Flat</h1>
        <p id="flat-solid">${name} · unfolded flat</p>
      </header>
      <figure id="flat-net">${netSvg(solid)}</figure>
    </main>
  </body>
</html>`
}
