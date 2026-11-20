/**
 * The nets of the five Platonic solids: each solid's faces unfolded into one flat piece, the way paper comes apart.
 *
 * The solids are given by their corner points; their faces are the supporting planes of three corners, so the cube's squares and the dodecahedron's
 * pentagons come out of the same arithmetic. A breadth-first walk over the faces unfolds them: a face next to one already laid down is turned about
 * the edge they share until it lies in the same plane, on the other side of that edge.
 */
import type { Solid } from '../selection/index.ts'

type Vec3 = readonly [number, number, number]

interface Point {
  readonly x: number
  readonly y: number
}

const PHI = (1 + Math.sqrt(5)) / 2
const INVERSE_PHI = 1 / PHI

/** The corners of each solid, all on a sphere of radius about 1.6, which the drawing scales away. */
export function verticesOf(solid: Solid): Vec3[] {
  const points: Vec3[] = []
  if (solid === 'tetrahedron') {
    for (const a of [-1, 1]) for (const b of [-1, 1]) for (const c of [-1, 1]) if (a * b * c > 0) points.push([a, b, c])
    return points
  }
  if (solid === 'cube') {
    for (const a of [-1, 1]) for (const b of [-1, 1]) for (const c of [-1, 1]) points.push([a, b, c])
    return points
  }
  if (solid === 'octahedron') {
    for (const axis of [0, 1, 2]) for (const sign of [-1, 1]) {
      const point: [number, number, number] = [0, 0, 0]
      point[axis] = sign
      points.push(point)
    }
    return points
  }
  if (solid === 'icosahedron') {
    for (const a of [-1, 1]) for (const b of [-1, 1]) {
      points.push([0, a, b * PHI], [a, b * PHI, 0], [a * PHI, 0, b])
    }
    return points
  }
  // Dodecahedron: the cube's corners, then three rings of four.
  for (const a of [-1, 1]) for (const b of [-1, 1]) for (const c of [-1, 1]) points.push([a, b, c])
  for (const a of [-1, 1]) for (const b of [-1, 1]) {
    points.push([0, a * INVERSE_PHI, b * PHI], [a * INVERSE_PHI, b * PHI, 0], [a * PHI, 0, b * INVERSE_PHI])
  }
  return points
}

const subtract = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]]
const scale = (a: Vec3, k: number): Vec3 => [a[0] * k, a[1] * k, a[2] * k]
const dot = (a: Vec3, b: Vec3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const cross = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
]
const length = (a: Vec3): number => Math.hypot(a[0], a[1], a[2])
const unit = (a: Vec3): Vec3 => scale(a, 1 / length(a))
const average = (points: readonly Vec3[]): Vec3 => scale(points.reduce((sum, point) => add(sum, point), [0, 0, 0] as Vec3), 1 / points.length)

/** A face as the plane found it: its corners, and the plane's outward normal. */
interface PlaneFace {
  readonly indices: number[]
  readonly normal: Vec3
}

/** The corners' faces: every supporting plane of three corners, with the plane's outward normal. */
function facesOf(vertices: readonly Vec3[]): PlaneFace[] {
  const found = new Map<string, PlaneFace>()
  for (let a = 0; a < vertices.length - 2; a += 1) {
    for (let b = a + 1; b < vertices.length - 1; b += 1) {
      for (let c = b + 1; c < vertices.length; c += 1) {
        const normal = cross(subtract(vertices[b], vertices[a]), subtract(vertices[c], vertices[a]))
        if (length(normal) < 1e-9) continue
        const n = unit(normal)
        const offset = dot(n, vertices[a])
        const onPlane: number[] = []
        let above = false
        let below = false
        for (let index = 0; index < vertices.length; index += 1) {
          const side = dot(n, vertices[index]) - offset
          if (side > 1e-6) above = true
          else if (side < -1e-6) below = true
          else onPlane.push(index)
        }
        // A supporting plane leaves every other corner on one side, and holds the whole face.
        if (onPlane.length < 3 || (above && below)) continue
        const key = onPlane.join(',')
        if (found.has(key)) continue
        // The plane's normal, turned away from the middle of the solid. It sorts the corners of a square or pentagon, whose
        // indices in discovery order are not their order around the face.
        const center = average(onPlane.map((index) => vertices[index]))
        found.set(key, { indices: onPlane, normal: dot(n, center) < 0 ? scale(n, -1) : n })
      }
    }
  }
  return [...found.values()]
}

/** A face's outward normal, by Newell's method, turned away from the middle of the solid. */
function faceNormal(vertices: readonly Vec3[], face: readonly number[]): Vec3 {
  let next: Vec3 = [0, 0, 0]
  for (let index = 0; index < face.length; index += 1) {
    const a = vertices[face[index]]
    const b = vertices[face[(index + 1) % face.length]]
    next = add(next, [
      (a[1] - b[1]) * (a[2] + b[2]),
      (a[2] - b[2]) * (a[0] + b[0]),
      (a[0] - b[0]) * (a[1] + b[1]),
    ])
  }
  const normal = unit(next)
  return dot(normal, average(face.map((index) => vertices[index]))) < 0 ? scale(normal, -1) : normal
}

/** A face's corners in the order they go round it, so the drawing's polygon is simple. */
function orderedFace(vertices: readonly Vec3[], face: readonly number[], normal: Vec3): number[] {
  const center = average(face.map((index) => vertices[index]))
  const u = unit(subtract(vertices[face[0]], center))
  const w = cross(normal, u)
  const angle = (index: number): number => {
    const offset = subtract(vertices[index], center)
    return Math.atan2(dot(offset, w), dot(offset, u))
  }
  return face.slice().sort((a, b) => angle(a) - angle(b))
}

interface Edge {
  readonly a: number
  readonly b: number
  readonly faces: number[]
}

interface Face {
  readonly indices: number[]
  readonly normal: Vec3
}

/** The faces, and the two faces that meet along each edge. */
function solidFaces(vertices: readonly Vec3[]): { faces: Face[], edges: Map<string, Edge> } {
  const faces = facesOf(vertices).map((face) => {
    const indices = orderedFace(vertices, face.indices, face.normal)
    return { indices, normal: face.normal }
  })
  const edges = new Map<string, Edge>()
  faces.forEach((face, faceIndex) => {
    for (let index = 0; index < face.indices.length; index += 1) {
      const a = face.indices[index]
      const b = face.indices[(index + 1) % face.indices.length]
      const key = a < b ? `${a}:${b}` : `${b}:${a}`
      const edge = edges.get(key)
      if (edge === undefined) edges.set(key, { a, b, faces: [faceIndex] })
      else edge.faces.push(faceIndex)
    }
  })
  return { faces, edges }
}

const cross2 = (a: Point, b: Point): number => a.x * b.y - a.y * b.x

function point2(origin: Point, along: Point, other: Point, t: number, s: number): Point {
  return {
    x: origin.x + along.x * t + other.x * s,
    y: origin.y + along.y * t + other.y * s,
  }
}

/** The base face laid in the plane: one corner along x, the face's own normal along z. */
function layBaseFace(vertices: readonly Vec3[], face: Face): Point[] {
  const center = average(face.indices.map((index) => vertices[index]))
  const u = unit(subtract(vertices[face.indices[0]], center))
  const w = cross(face.normal, u)
  return face.indices.map((index) => {
    const offset = subtract(vertices[index], center)
    return { x: dot(offset, u), y: dot(offset, w) }
  })
}

/** Turn a neighbouring face about the edge it shares with a placed one, until both lie in the same plane. */
function unfoldNeighbour(
  vertices: readonly Vec3[],
  face: Face,
  edge: Edge,
  parentFace: Face,
  parentPoints: readonly Point[],
  parentCentroid: Point,
): Point[] {
  const a2 = parentPoints[parentFace.indices.indexOf(edge.a)]
  const b2 = parentPoints[parentFace.indices.indexOf(edge.b)]
  const a3 = vertices[edge.a]
  const b3 = vertices[edge.b]
  const along3 = unit(subtract(b3, a3))
  const across3 = cross(face.normal, along3)
  const along2 = unit2(subtract2(b2, a2))

  const offsets = face.indices.map((index) => {
    const offset = subtract(vertices[index], a3)
    return { t: dot(offset, along3), s: dot(offset, across3) }
  })
  const centroid = {
    t: offsets.reduce((sum, offset) => sum + offset.t, 0) / offsets.length,
    s: offsets.reduce((sum, offset) => sum + offset.s, 0) / offsets.length,
  }

  // The neighbour lies on the other side of the shared edge from the face it was unfolded off.
  let across2: Point = { x: -along2.y, y: along2.x }
  const candidate = point2(a2, along2, across2, centroid.t, centroid.s)
  const parentSide = cross2(subtract2(b2, a2), subtract2(parentCentroid, a2))
  if (cross2(subtract2(b2, a2), subtract2(candidate, a2)) * parentSide >= 0) across2 = { x: along2.y, y: -along2.x }

  return face.indices.map((index, position) => {
    if (index === edge.a) return a2
    if (index === edge.b) return b2
    return point2(a2, along2, across2, offsets[position].t, offsets[position].s)
  })
}

const subtract2 = (a: Point, b: Point): Point => ({ x: a.x - b.x, y: a.y - b.y })
const unit2 = (a: Point): Point => {
  const size = Math.hypot(a.x, a.y)
  return { x: a.x / size, y: a.y / size }
}
const centroidOf = (points: readonly Point[]): Point => ({
  x: points.reduce((sum, point) => sum + point.x, 0) / points.length,
  y: points.reduce((sum, point) => sum + point.y, 0) / points.length,
})

export interface Net {
  /** One polygon per face, in the flat sheet's own coordinates. */
  readonly faces: Point[][]
  /** A dot on the base face, the way the reference marks the sheet it starts from. */
  readonly dot: Point
  readonly minX: number
  readonly minY: number
  readonly width: number
  readonly height: number
}

const nets = new Map<Solid, Net>()

/** The net of a solid, built once and kept: corners, faces, then the breadth-first unfolding. */
export function netOf(solid: Solid): Net {
  const kept = nets.get(solid)
  if (kept !== undefined) return kept
  const vertices = verticesOf(solid)
  const { faces, edges } = solidFaces(vertices)
  const placed: Point[][] = []
  const visited = new Set<number>([0])
  const queue = [0]
  while (queue.length > 0) {
    const faceIndex = queue.shift() as number
    const face = faces[faceIndex]
    if (faceIndex === 0) placed[0] = layBaseFace(vertices, face)
    for (let position = 0; position < face.indices.length; position += 1) {
      const a = face.indices[position]
      const b = face.indices[(position + 1) % face.indices.length]
      const edge = edges.get(a < b ? `${a}:${b}` : `${b}:${a}`)
      if (edge === undefined) continue
      for (const neighbour of edge.faces) {
        if (neighbour === faceIndex || visited.has(neighbour)) continue
        visited.add(neighbour)
        placed[neighbour] = unfoldNeighbour(
          vertices,
          faces[neighbour],
          edge,
          face,
          placed[faceIndex],
          centroidOf(placed[faceIndex]),
        )
        queue.push(neighbour)
      }
    }
  }
  // Turn the whole sheet to the angle that fits it into the smallest box, so it stands squarely on the page.
  const points = placed.flat()
  let turn = 0
  let smallest = Infinity
  for (let degree = 0; degree < 90; degree += 1) {
    const angle = (degree * Math.PI) / 180
    const cos = Math.cos(angle)
    const sin = Math.sin(angle)
    let lowX = Infinity
    let highX = -Infinity
    let lowY = Infinity
    let highY = -Infinity
    for (const point of points) {
      const x = point.x * cos - point.y * sin
      const y = point.x * sin + point.y * cos
      lowX = Math.min(lowX, x)
      highX = Math.max(highX, x)
      lowY = Math.min(lowY, y)
      highY = Math.max(highY, y)
    }
    const box = (highX - lowX) * (highY - lowY)
    if (box < smallest) {
      smallest = box
      turn = angle
    }
  }
  const cos = Math.cos(turn)
  const sin = Math.sin(turn)
  const turned = (point: Point): Point => ({ x: point.x * cos - point.y * sin, y: point.x * sin + point.y * cos })
  const sheet = placed.map((face) => face.map(turned))
  const corners = sheet.flat()
  const minX = Math.min(...corners.map((point) => point.x))
  const minY = Math.min(...corners.map((point) => point.y))
  const width = Math.max(...corners.map((point) => point.x)) - minX
  const height = Math.max(...corners.map((point) => point.y)) - minY
  const net: Net = { faces: sheet, dot: turned(centroidOf(placed[0])), minX, minY, width, height }
  nets.set(solid, net)
  return net
}

const round = (value: number): string => {
  const text = value.toFixed(3)
  return text.replace(/\.?0+$/u, '') || '0'
}

/** The drawing's viewBox: the net with a little air around it. */
export function netViewBox(net: Net): [number, number, number, number] {
  const pad = Math.max(net.width, net.height) * 0.05 + 0.05
  return [net.minX - pad, net.minY - pad, net.width + pad * 2, net.height + pad * 2]
}

/** The dot on the base face, in the net's own coordinates. */
export function netDotRadius(net: Net): number {
  return Math.max(net.width, net.height) * 0.018
}

/** The net as an SVG, its own coordinates fitted to a viewBox; the page styles the paper and the lines. */
export function netSvg(solid: Solid): string {
  const net = netOf(solid)
  const viewBox = netViewBox(net).map(round).join(' ')
  const polygons = net.faces
    .map((face) => `<polygon points="${face.map((point) => `${round(point.x)},${round(point.y)}`).join(' ')}" />`)
    .join('')
  const dot = `<circle class="flat-dot" cx="${round(net.dot.x)}" cy="${round(net.dot.y)}" r="${round(netDotRadius(net))}" />`
  return `<svg class="flat-net" viewBox="${viewBox}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="${solid} unfolded flat" xmlns="http://www.w3.org/2000/svg">${polygons}${dot}</svg>`
}
