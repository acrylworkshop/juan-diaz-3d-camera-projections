/**
 * The page of the Flat state. It is empty for now: the state exists so the state menu can switch to it, and its content comes later.
 */

/** The page: the same dark ground as the 3D space, and a line saying the state has nothing yet. */
export function flatPage(): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Flat</title>
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
      main {
        display: grid;
        height: 100%;
        place-content: center;
        gap: 6px;
        text-align: center;
      }
      h1 {
        margin: 0;
        font-size: 12px;
        font-weight: 600;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: #cfcfcf;
      }
      p {
        margin: 0;
        color: #8f8f8f;
      }
    </style>
  </head>
  <body>
    <main id="flat-state">
      <h1>Flat</h1>
      <p>Empty for now.</p>
    </main>
  </body>
</html>`
}
