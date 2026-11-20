import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { Solid } from '../plugins/selection/index.ts'
import { netOf, netSvg, verticesOf } from '../plugins/flat/nets.ts'
import { flatPage } from '../plugins/flat/page.ts'

/** Each solid: its corners, its faces, and how many sides each face has. */
const EXPECTED: Record<Solid, { vertices: number, faces: number, sides: number }> = {
  tetrahedron: { vertices: 4, faces: 4, sides: 3 },
  cube: { vertices: 8, faces: 6, sides: 4 },
  octahedron: { vertices: 6, faces: 8, sides: 3 },
  dodecahedron: { vertices: 20, faces: 12, sides: 5 },
  icosahedron: { vertices: 12, faces: 20, sides: 3 },
}

const solids = Object.keys(EXPECTED) as Solid[]

/** Whether a point lies strictly inside a polygon (not on its edge). */
function inside(point: { x: number, y: number }, polygon: readonly { x: number, y: number }[]): boolean {
  let hit = false
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const a = polygon[i]
    const b = polygon[j]
    if (a.y > point.y !== b.y > point.y && point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x) hit = !hit
  }
  return hit
}

/** Whether a point lies on a polygon's edge, where two unfolded faces are allowed to meet. */
function onBoundary(point: { x: number, y: number }, polygon: readonly { x: number, y: number }[]): boolean {
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const a = polygon[i]
    const b = polygon[j]
    const cross = (b.x - a.x) * (point.y - a.y) - (b.y - a.y) * (point.x - a.x)
    if (Math.abs(cross) > 1e-6) continue
    if (
      point.x >= Math.min(a.x, b.x) - 1e-6 &&
      point.x <= Math.max(a.x, b.x) + 1e-6 &&
      point.y >= Math.min(a.y, b.y) - 1e-6 &&
      point.y <= Math.max(a.y, b.y) + 1e-6
    )
      return true
  }
  return false
}

/** Whether two faces of a net lie on top of each other: a corner inside the other, or two edges crossing. */
function overlaps(a: readonly { x: number, y: number }[], b: readonly { x: number, y: number }[]): boolean {
  for (const point of a) if (inside(point, b) && !onBoundary(point, b)) return true
  for (const point of b) if (inside(point, a) && !onBoundary(point, a)) return true
  const side = (p: { x: number, y: number }, q: { x: number, y: number }, r: { x: number, y: number }): number =>
    Math.sign((q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x))
  for (let i = 0; i < a.length; i += 1) {
    for (let j = 0; j < b.length; j += 1) {
      const p = a[i]
      const q = a[(i + 1) % a.length]
      const r = b[j]
      const s = b[(j + 1) % b.length]
      if (side(p, q, r) * side(p, q, s) < 0 && side(r, s, p) * side(r, s, q) < 0) return true
    }
  }
  return false
}

test('each solid unfolds into the right number of faces, none on top of another', () => {
  for (const solid of solids) {
    const expected = EXPECTED[solid]
    assert.equal(verticesOf(solid).length, expected.vertices, solid)
    const net = netOf(solid)
    assert.equal(net.faces.length, expected.faces, solid)
    for (const face of net.faces) {
      assert.equal(face.length, expected.sides, solid)
      for (const point of face) assert.ok(Number.isFinite(point.x) && Number.isFinite(point.y), solid)
    }
    for (let i = 0; i < net.faces.length; i += 1)
      for (let j = i + 1; j < net.faces.length; j += 1)
        assert.equal(overlaps(net.faces[i], net.faces[j]), false, `${solid} faces ${i} and ${j} overlap`)
    assert.ok(net.width > 0 && net.height > 0, solid)
  }
})

test('the net drawing has one polygon per face and a fitted viewBox', () => {
  for (const solid of solids) {
    const svg = netSvg(solid)
    assert.equal(svg.split('<polygon').length - 1, EXPECTED[solid].faces, solid)
    assert.match(svg, /viewBox="[-\d. ]+"/)
    assert.doesNotMatch(svg, /NaN|Infinity/)
    assert.match(svg, new RegExp(`aria-label="${solid} unfolded flat"`))
  }
})

test('the Flat page names the solid and carries its net', () => {
  const page = flatPage('/flat', 'dodecahedron')
  assert.match(page, /<h1>Flat<\/h1>/)
  assert.match(page, /Dodecahedron · unfolded flat/)
  assert.match(page, /<figure id="flat-net">/)
  assert.match(page, /id="flat-camera" aria-pressed="false"/)
  assert.match(page, /id="flat-net-data"/)
  assert.equal(page.split('<polygon').length - 1, 12)
  const data = JSON.parse(page.slice(page.indexOf('id="flat-net-data">') + 'id="flat-net-data">'.length, page.indexOf('</script>', page.indexOf('id="flat-net-data">'))))
  assert.equal(data.faces.length, 12)
  assert.equal(data.viewBox.length, 4)
})
