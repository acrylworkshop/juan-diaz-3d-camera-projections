/**
 * The page of state 1: a full-viewport 3D space with a HUD over it. Every URL in the document is derived from the request path, so the same page works
 * on the app's own server (`/space`) and under the frame's canvas prefix (`/app/space`) without naming that prefix here.
 */

/** The page's own URL, canonical and safe to put into HTML and JSON: `/space`, or `/app/space` in the frame. */
export function spacePath(requestPath: string): string {
  const segments = requestPath
    .split('/')
    .filter((segment) => segment !== '')
    .map((segment) => encodeURIComponent(segment))
  return `/${segments.join('/')}`
}

/** An import map entry, with `<` escaped so a path can never close the script element. */
function importMap(threeUrl: string): string {
  return JSON.stringify({ imports: { three: threeUrl } }).replaceAll('<', '\\u003c')
}

/** The page: dark Blender-like viewport, the controls of the HUD, and the module that paints the space. */
export function spacePage(requestPath: string): string {
  const base = spacePath(requestPath)
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>3D</title>
    <style>
      :root {
        color-scheme: dark;
        --axis-x: #e0473f;
        --axis-y: #8cc63f;
        --axis-z: #3b82f6;
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
        font: 13px/1.45 ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
        color: #e8e8e8;
      }
      #space-root {
        position: relative;
        height: 100%;
      }
      #space-canvas {
        display: block;
        width: 100%;
        height: 100%;
        touch-action: none;
        cursor: grab;
      }
      #space-canvas:active {
        cursor: grabbing;
      }
      #space-meshes {
        position: absolute;
        top: 12px;
        left: 12px;
        display: flex;
        flex-direction: column;
        gap: 4px;
        width: 142px;
        padding: 10px;
        border: 1px solid #363636;
        border-radius: 10px;
        background: rgba(16, 16, 16, 0.74);
      }
      #space-meshes h2 {
        margin: 0 0 4px;
        font-size: 11px;
        font-weight: 600;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: #a9a9a9;
      }
      #space-meshes button {
        padding: 6px 9px;
        font: inherit;
        font-size: 12px;
        text-align: left;
        color: #dcdcdc;
        background: #2a2a2a;
        border: 1px solid #3c3c3c;
        border-radius: 6px;
        cursor: pointer;
      }
      #space-meshes button:hover {
        background: #343434;
      }
      #space-meshes button:focus-visible {
        outline: 2px solid var(--axis-z);
        outline-offset: 1px;
      }
      #space-meshes button[aria-pressed="true"] {
        background: #223247;
        border-color: #37506e;
        color: #ffffff;
      }
      #space-hud {
        position: absolute;
        top: 12px;
        left: 166px;
        width: min(330px, calc(100% - 340px));
        padding: 12px 14px;
        border: 1px solid #363636;
        border-radius: 10px;
        background: rgba(16, 16, 16, 0.74);
      }
      #space-hud h1 {
        margin: 0 0 9px;
        font-size: 12px;
        font-weight: 600;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }
      #space-views {
        display: flex;
        flex-wrap: wrap;
        gap: 4px;
        margin-bottom: 9px;
      }
      #space-views button {
        padding: 3px 8px;
        font: inherit;
        font-size: 12px;
        color: #dcdcdc;
        background: #2a2a2a;
        border: 1px solid #3c3c3c;
        border-radius: 6px;
        cursor: pointer;
      }
      #space-views button:hover {
        background: #343434;
      }
      #space-views button:focus-visible {
        outline: 2px solid var(--axis-z);
        outline-offset: 1px;
      }
      #space-legend {
        margin: 0;
        padding: 0;
        list-style: none;
        font-size: 12px;
        color: #a9a9a9;
      }
      #space-legend b {
        font-weight: 600;
        color: #d0d0d0;
      }
      #space-status {
        position: absolute;
        left: 166px;
        bottom: 12px;
        margin: 0;
        padding: 6px 10px;
        border: 1px solid #363636;
        border-radius: 8px;
        background: rgba(16, 16, 16, 0.74);
        color: #c4c4c4;
        font-variant-numeric: tabular-nums;
      }
      #space-error {
        position: absolute;
        top: 45%;
        right: 20%;
        left: 20%;
        margin: 0;
        padding: 10px 12px;
        border: 1px solid #6b3b3b;
        border-radius: 8px;
        background: rgba(48, 20, 20, 0.85);
        color: #f0c8c8;
      }
      #space-error[hidden] {
        display: none;
      }
    </style>
  </head>
  <body>
    <div id="space-root">
      <canvas id="space-canvas" aria-label="3D space"></canvas>
      <aside id="space-meshes" aria-label="Meshes">
        <h2>Mesh</h2>
        <button type="button" data-mesh="tetrahedron" aria-pressed="false">Tetrahedron</button>
        <button type="button" data-mesh="cube" aria-pressed="true" title="Cube (hexahedron)">Cube</button>
        <button type="button" data-mesh="octahedron" aria-pressed="false">Octahedron</button>
        <button type="button" data-mesh="dodecahedron" aria-pressed="false">Dodecahedron</button>
        <button type="button" data-mesh="icosahedron" aria-pressed="false">Icosahedron</button>
      </aside>
      <section id="space-hud" aria-label="3D space controls">
        <h1>3D</h1>
        <div id="space-views">
          <button type="button" data-view="front">Front</button>
          <button type="button" data-view="right">Right</button>
          <button type="button" data-view="top">Top</button>
          <button type="button" data-view="back">Back</button>
          <button type="button" data-view="left">Left</button>
          <button type="button" data-view="bottom">Bottom</button>
          <button type="button" id="space-projection">Perspective</button>
          <button type="button" id="space-frame">Frame</button>
        </div>
        <ul id="space-legend">
          <li><b>Orbit</b> drag with the left or middle button</li>
          <li><b>Pan</b> Shift + drag</li>
          <li><b>Zoom</b> wheel, or Ctrl + middle drag</li>
          <li><b>Views</b> numpad 1, 3, 7 (Ctrl for the opposite side), 5 toggles orthographic, Home or . frames the space</li>
          <li><b>Gizmo</b> click X, Y or Z at the top right to look along that axis</li>
        </ul>
      </section>
      <p id="space-status" role="status">Perspective · User view · target 0.00, 0.00, 0.00</p>
      <p id="space-error" role="alert" hidden></p>
    </div>
    <script type="importmap">${importMap(`${base}/vendor/three.module.js`)}</script>
    <script type="module" src="${base}/client/space.js"></script>
  </body>
</html>`
}
