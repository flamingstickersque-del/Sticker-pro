/**
 * SILHOUETTE EXTRACTION CORE
 *
 * DOM-free, deterministic geometry pipeline that turns a background-removed RGBA
 * bitmap into a single, continuous, closed outer silhouette polygon.
 *
 * Pipeline:
 *   1. Alpha hysteresis thresholding (strong core + connected antialiased rim)
 *   2. Connected-component labelling (8-connectivity)
 *   3. Explainable component-selection policy (noise vs. intentional artwork)
 *   4. Union mask + light morphological closing (kills 1px staircase noise)
 *   5. Corridor bridging so disconnected decorations yield ONE continuous loop
 *   6. Moore-Neighbour boundary tracing with a resolution-derived step budget
 *   7. Adaptive Ramer-Douglas-Peucker simplification in pixel space
 *   8. Normalisation to the [-0.5..0.5] artwork coordinate space
 *
 * Everything here is pure and unit-testable without a browser.
 */

export interface Point2D {
  x: number;
  y: number;
}

export interface ComponentInfo {
  label: number;
  areaPx: number;
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  touchesBorder: boolean;
}

export interface SilhouetteOptions {
  /** Alpha at/above which a pixel is a confident foreground pixel. */
  alphaThresholdHigh?: number;
  /** Alpha at/above which a pixel may join a confident foreground region. */
  alphaThresholdLow?: number;
  /** Components smaller than this fraction of the largest component are noise. */
  minComponentAreaRatio?: number;
  /** Absolute floor (px) below which a component is always noise. */
  minComponentAreaPx?: number;
  /** Physical width of the artwork in mm (used to derive a mm-accurate tolerance). */
  physicalSizeMm?: number;
  /** Simplification tolerance in mm. */
  toleranceMm?: number;
  /** Bridge disconnected decorations into one continuous cut loop. */
  bridgeDisconnected?: boolean;
  /** Radius (px) of the closing structuring element. */
  closeRadiusPx?: number;
}

export interface SilhouetteDiagnostics {
  method: 'alpha' | 'color_diff' | 'none';
  alphaThresholdHigh: number;
  alphaThresholdLow: number;
  transparentPixelRatio: number;
  componentCount: number;
  keptComponentCount: number;
  droppedComponentCount: number;
  droppedAreaRatio: number;
  bridgedComponentCount: number;
  simplifyTolerancePx: number;
  rawBoundaryPoints: number;
  finalPointCount: number;
  /** True when the traced silhouette degenerated into the full image rectangle. */
  isFullFrame: boolean;
  /** Silhouette bounding box in pixels (inclusive). */
  boundsPx?: { minX: number; minY: number; maxX: number; maxY: number };
  warnings: string[];
}

export interface SilhouetteResult {
  points: Point2D[];
  diagnostics: SilhouetteDiagnostics;
}

const DEFAULTS = {
  alphaThresholdHigh: 128,
  alphaThresholdLow: 16,
  minComponentAreaRatio: 0.004,
  minComponentAreaPx: 24,
  toleranceMm: 0.06,
  bridgeDisconnected: true,
  closeRadiusPx: 1,
} as const;

/** Shoelace signed area. Positive == clockwise in Y-down screen space. */
export function signedArea(pts: Point2D[]): number {
  let sum = 0;
  const n = pts.length;
  for (let i = 0; i < n; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % n];
    sum += a.x * b.y - b.x * a.y;
  }
  return sum / 2;
}

/**
 * Builds a binary foreground mask using alpha hysteresis.
 *
 * A single hard alpha cut either keeps faint background-removal halo pixels
 * (contour bulges into leftover background) or erodes the antialiased rim
 * (contour cuts into the artwork). Hysteresis keeps the confident core plus
 * only the soft pixels that are actually connected to it.
 */
export function buildForegroundMask(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  highThreshold: number,
  lowThreshold: number
): { mask: Uint8Array; strong: Uint8Array; method: 'alpha' | 'color_diff'; transparentRatio: number } {
  const total = width * height;
  const strong = new Uint8Array(total);
  const weak = new Uint8Array(total);

  let transparentCount = 0;
  for (let i = 0; i < total; i++) {
    if (data[i * 4 + 3] < highThreshold) transparentCount++;
  }
  const transparentRatio = transparentCount / total;
  const hasAlpha = transparentRatio > 0.002;

  if (hasAlpha) {
    for (let i = 0; i < total; i++) {
      const a = data[i * 4 + 3];
      if (a >= highThreshold) strong[i] = 1;
      if (a >= lowThreshold) weak[i] = 1;
    }
  } else {
    // Opaque substrate: derive the background colour from the four corners.
    const corners = [
      0,
      width - 1,
      (height - 1) * width,
      height * width - 1,
    ];
    let bgR = 0;
    let bgG = 0;
    let bgB = 0;
    for (const c of corners) {
      bgR += data[c * 4];
      bgG += data[c * 4 + 1];
      bgB += data[c * 4 + 2];
    }
    bgR /= corners.length;
    bgG /= corners.length;
    bgB /= corners.length;

    const strongDiff = 34;
    const weakDiff = 18;
    for (let i = 0; i < total; i++) {
      const dr = data[i * 4] - bgR;
      const dg = data[i * 4 + 1] - bgG;
      const db = data[i * 4 + 2] - bgB;
      const diff = Math.sqrt(dr * dr + dg * dg + db * db);
      if (diff >= strongDiff) strong[i] = 1;
      if (diff >= weakDiff) weak[i] = 1;
    }
  }

  const mask = new Uint8Array(total);
  const stack = new Int32Array(total);
  let sp = 0;

  for (let i = 0; i < total; i++) {
    if (strong[i] && !mask[i]) {
      mask[i] = 1;
      stack[sp++] = i;
    }
  }

  // If nothing is confidently foreground, fall back to the weak set so that
  // very soft artwork still produces a silhouette.
  if (sp === 0) {
    for (let i = 0; i < total; i++) {
      if (weak[i]) mask[i] = 1;
    }
    return { mask, strong: mask, method: hasAlpha ? 'alpha' : 'color_diff', transparentRatio };
  }

  while (sp > 0) {
    const idx = stack[--sp];
    const x = idx % width;
    const y = (idx - x) / width;

    for (let dy = -1; dy <= 1; dy++) {
      const ny = y + dy;
      if (ny < 0 || ny >= height) continue;
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        const nx = x + dx;
        if (nx < 0 || nx >= width) continue;
        const nIdx = ny * width + nx;
        if (weak[nIdx] && !mask[nIdx]) {
          mask[nIdx] = 1;
          stack[sp++] = nIdx;
        }
      }
    }
  }

  return { mask, strong, method: hasAlpha ? 'alpha' : 'color_diff', transparentRatio };
}

/** 8-connected component labelling with an explicit stack (no recursion). */
export function labelComponents(
  mask: Uint8Array,
  width: number,
  height: number
): { labels: Int32Array; components: ComponentInfo[] } {
  const total = width * height;
  const labels = new Int32Array(total).fill(-1);
  const components: ComponentInfo[] = [];
  const stack = new Int32Array(total);

  for (let start = 0; start < total; start++) {
    if (!mask[start] || labels[start] !== -1) continue;

    const label = components.length;
    let area = 0;
    let minX = width;
    let minY = height;
    let maxX = -1;
    let maxY = -1;
    let touchesBorder = false;

    let sp = 0;
    stack[sp++] = start;
    labels[start] = label;

    while (sp > 0) {
      const idx = stack[--sp];
      const x = idx % width;
      const y = (idx - x) / width;

      area++;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
      if (x === 0 || y === 0 || x === width - 1 || y === height - 1) touchesBorder = true;

      for (let dy = -1; dy <= 1; dy++) {
        const ny = y + dy;
        if (ny < 0 || ny >= height) continue;
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          const nx = x + dx;
          if (nx < 0 || nx >= width) continue;
          const nIdx = ny * width + nx;
          if (mask[nIdx] && labels[nIdx] === -1) {
            labels[nIdx] = label;
            stack[sp++] = nIdx;
          }
        }
      }
    }

    components.push({ label, areaPx: area, minX, minY, maxX, maxY, touchesBorder });
  }

  return { labels, components };
}

export interface ComponentSelection {
  kept: ComponentInfo[];
  dropped: ComponentInfo[];
  droppedAreaRatio: number;
  warnings: string[];
}

/**
 * Explainable component-selection policy.
 *
 * Keeps every component that is a meaningful fraction of the dominant one, so
 * legitimate disconnected decorations (stars, dots, detached letterforms) are
 * preserved. Only genuinely insignificant specks are discarded, and the caller
 * is told exactly what happened.
 */
export function selectComponents(
  components: ComponentInfo[],
  options: SilhouetteOptions = {}
): ComponentSelection {
  const minRatio = options.minComponentAreaRatio ?? DEFAULTS.minComponentAreaRatio;
  const minAreaPx = options.minComponentAreaPx ?? DEFAULTS.minComponentAreaPx;

  if (components.length === 0) {
    return { kept: [], dropped: [], droppedAreaRatio: 0, warnings: ['No foreground pixels found.'] };
  }

  const sorted = [...components].sort((a, b) => b.areaPx - a.areaPx);
  const largest = sorted[0].areaPx;
  const threshold = Math.max(minAreaPx, largest * minRatio);

  const kept: ComponentInfo[] = [];
  const dropped: ComponentInfo[] = [];
  let droppedArea = 0;

  for (const c of sorted) {
    if (c.areaPx >= threshold) kept.push(c);
    else {
      dropped.push(c);
      droppedArea += c.areaPx;
    }
  }

  const warnings: string[] = [];
  if (dropped.length > 0) {
    warnings.push(
      `Discarded ${dropped.length} background-removal artifact${dropped.length === 1 ? '' : 's'} ` +
        `(${droppedArea} px, below ${Math.round(threshold)} px threshold).`
    );
  }
  if (kept.length > 1) {
    warnings.push(
      `Preserved ${kept.length} disconnected artwork components; they are bridged into one continuous cut loop.`
    );
  }

  return { kept, dropped, droppedAreaRatio: droppedArea / largest, warnings };
}

/** Builds a mask containing only the selected components. */
export function buildUnionMask(
  labels: Int32Array,
  kept: ComponentInfo[],
  width: number,
  height: number
): Uint8Array {
  const total = width * height;
  const mask = new Uint8Array(total);
  if (kept.length === 0) return mask;

  // Labels are global component ids, not indices into `kept`, so the lookup
  // table must be sized by the highest label rather than by the kept count.
  let maxLabel = 0;
  for (const c of kept) if (c.label > maxLabel) maxLabel = c.label;
  const keep = new Uint8Array(maxLabel + 1);
  for (const c of kept) keep[c.label] = 1;

  for (let i = 0; i < total; i++) {
    const l = labels[i];
    if (l >= 0 && l <= maxLabel && keep[l]) mask[i] = 1;
  }
  return mask;
}

/** Square morphological closing (dilate then erode) — removes 1px staircase noise. */
export function closeMask(
  mask: Uint8Array,
  width: number,
  height: number,
  radius: number
): Uint8Array {
  if (radius <= 0) return mask;

  const dilate = (src: Uint8Array): Uint8Array => {
    const out = new Uint8Array(src.length);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (!src[y * width + x]) continue;
        const y0 = Math.max(0, y - radius);
        const y1 = Math.min(height - 1, y + radius);
        const x0 = Math.max(0, x - radius);
        const x1 = Math.min(width - 1, x + radius);
        for (let ny = y0; ny <= y1; ny++) {
          const row = ny * width;
          for (let nx = x0; nx <= x1; nx++) out[row + nx] = 1;
        }
      }
    }
    return out;
  };

  const erode = (src: Uint8Array): Uint8Array => {
    const out = new Uint8Array(src.length);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (!src[y * width + x]) continue;
        let all = true;
        const y0 = Math.max(0, y - radius);
        const y1 = Math.min(height - 1, y + radius);
        const x0 = Math.max(0, x - radius);
        const x1 = Math.min(width - 1, x + radius);
        for (let ny = y0; ny <= y1 && all; ny++) {
          const row = ny * width;
          for (let nx = x0; nx <= x1; nx++) {
            if (!src[row + nx]) {
              all = false;
              break;
            }
          }
        }
        if (all) out[y * width + x] = 1;
      }
    }
    return out;
  };

  return erode(dilate(mask));
}

function drawCorridor(
  mask: Uint8Array,
  width: number,
  height: number,
  x0: number,
  y0: number,
  x1: number,
  y1: number
): void {
  let x = x0;
  let y = y0;
  const dx = Math.abs(x1 - x0);
  const dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;

  for (let guard = 0; guard < width * height; guard++) {
    for (let oy = -1; oy <= 1; oy++) {
      const ny = y + oy;
      if (ny < 0 || ny >= height) continue;
      for (let ox = -1; ox <= 1; ox++) {
        const nx = x + ox;
        if (nx < 0 || nx >= width) continue;
        mask[ny * width + nx] = 1;
      }
    }
    if (x === x1 && y === y1) break;
    const e2 = 2 * err;
    if (e2 > -dy) {
      err -= dy;
      x += sx;
    }
    if (e2 < dx) {
      err += dx;
      y += sy;
    }
  }
}

/**
 * Bridges every disconnected component to the dominant one with a thin corridor,
 * guaranteeing that boundary tracing yields a single continuous closed loop.
 */
export function bridgeComponents(
  mask: Uint8Array,
  width: number,
  height: number,
  maxBridges = 64
): number {
  let bridged = 0;

  for (let iteration = 0; iteration < maxBridges; iteration++) {
    const { labels, components } = labelComponents(mask, width, height);
    if (components.length <= 1) break;

    const sorted = [...components].sort((a, b) => b.areaPx - a.areaPx);
    const main = sorted[0];

    const samplePixels = (c: ComponentInfo, limit: number): number[] => {
      const out: number[] = [];
      const step = Math.max(1, Math.floor(c.areaPx / limit));
      let seen = 0;
      for (let y = c.minY; y <= c.maxY; y++) {
        for (let x = c.minX; x <= c.maxX; x++) {
          const idx = y * width + x;
          if (labels[idx] !== c.label) continue;
          if (seen++ % step === 0) out.push(idx);
          if (out.length >= limit) return out;
        }
      }
      return out;
    };

    const mainPixels = samplePixels(main, 1500);
    if (mainPixels.length === 0) break;

    let best: { from: number; to: number; dist: number } | null = null;

    for (let i = 1; i < sorted.length; i++) {
      const other = sorted[i];
      const otherPixels = samplePixels(other, 800);
      for (const oIdx of otherPixels) {
        const ox = oIdx % width;
        const oy = (oIdx - ox) / width;
        for (const mIdx of mainPixels) {
          const mx = mIdx % width;
          const my = (mIdx - mx) / width;
          const d = (ox - mx) * (ox - mx) + (oy - my) * (oy - my);
          if (!best || d < best.dist) best = { from: oIdx, to: mIdx, dist: d };
        }
      }
    }

    if (!best) break;

    const fx = best.from % width;
    const fy = (best.from - fx) / width;
    const tx = best.to % width;
    const ty = (best.to - tx) / width;
    drawCorridor(mask, width, height, fx, fy, tx, ty);
    bridged++;
  }

  return bridged;
}

/**
 * Moore-Neighbour boundary tracing of the outermost boundary of a binary mask.
 * Returns pixel-centre coordinates (x + 0.5, y + 0.5).
 */
export function traceOuterBoundary(
  mask: Uint8Array,
  width: number,
  height: number
): Point2D[] | null {
  let startX = -1;
  let startY = -1;
  for (let y = 0; y < height && startY === -1; y++) {
    for (let x = 0; x < width; x++) {
      if (mask[y * width + x]) {
        startX = x;
        startY = y;
        break;
      }
    }
  }
  if (startX === -1) return null;

  const DIRS: ReadonlyArray<readonly [number, number]> = [
    [0, -1],
    [1, -1],
    [1, 0],
    [1, 1],
    [0, 1],
    [-1, 1],
    [-1, 0],
    [-1, -1],
  ];

  const boundary: Point2D[] = [{ x: startX + 0.5, y: startY + 0.5 }];
  let currX = startX;
  let currY = startY;
  let startDir = 6;
  let second: Point2D | null = null;

  // Budget derived from the mask size so complex silhouettes are never truncated.
  const maxSteps = Math.min(4_000_000, Math.max(200_000, 4 * width * height));

  for (let step = 0; step < maxSteps; step++) {
    let found = false;
    for (let i = 0; i < 8; i++) {
      const d = (startDir + i) % 8;
      const nx = currX + DIRS[d][0];
      const ny = currY + DIRS[d][1];
      if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
      if (!mask[ny * width + nx]) continue;

      currX = nx;
      currY = ny;
      startDir = (d + 5) % 8;
      const pt = { x: currX + 0.5, y: currY + 0.5 };
      boundary.push(pt);
      found = true;
      if (boundary.length === 2) second = pt;
      break;
    }
    if (!found) break;

    if (
      boundary.length > 3 &&
      currX === startX &&
      currY === startY &&
      second &&
      boundary[1].x === second.x &&
      boundary[1].y === second.y
    ) {
      break;
    }
  }

  if (boundary.length < 4) return null;

  const first = boundary[0];
  const last = boundary[boundary.length - 1];
  if (last.x === first.x && last.y === first.y) boundary.pop();

  return boundary;
}

function perpendicularDistance(pt: Point2D, a: Point2D, b: Point2D): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const mag = Math.hypot(dx, dy);
  if (mag === 0) return Math.hypot(pt.x - a.x, pt.y - a.y);
  return Math.abs(dy * pt.x - dx * pt.y + b.x * a.y - b.y * a.x) / mag;
}

/** Iterative Ramer-Douglas-Peucker (no recursion depth risk on long contours). */
export function simplifyPolygon(points: Point2D[], epsilon: number): Point2D[] {
  const n = points.length;
  if (n <= 3 || epsilon <= 0) return points;

  const keep = new Uint8Array(n);
  keep[0] = 1;
  keep[n - 1] = 1;

  const stack: Array<[number, number]> = [[0, n - 1]];

  while (stack.length > 0) {
    const [first, last] = stack.pop()!;
    let maxDist = 0;
    let index = -1;
    for (let i = first + 1; i < last; i++) {
      const d = perpendicularDistance(points[i], points[first], points[last]);
      if (d > maxDist) {
        maxDist = d;
        index = i;
      }
    }
    if (maxDist > epsilon && index !== -1) {
      keep[index] = 1;
      stack.push([first, index]);
      stack.push([index, last]);
    }
  }

  const out: Point2D[] = [];
  for (let i = 0; i < n; i++) if (keep[i]) out.push(points[i]);
  return out;
}

/**
 * Simplifies a CLOSED ring.
 *
 * Plain RDP treats the ring as an open polyline, so it can never remove a
 * degenerate vertex sitting on the closing edge — which is exactly what
 * boundary tracing produces. That leftover vertex becomes a spike once the
 * polygon is offset. This splits the ring at the vertex farthest from the
 * start point, simplifies both halves, and rejoins them.
 */
export function simplifyClosedPolygon(points: Point2D[], epsilon: number): Point2D[] {
  const n = points.length;
  if (n <= 3 || epsilon <= 0) return points;

  // Split at the vertex farthest from points[0] so both halves are well conditioned.
  let splitIndex = 0;
  let maxDist = -1;
  for (let i = 1; i < n; i++) {
    const d = Math.hypot(points[i].x - points[0].x, points[i].y - points[0].y);
    if (d > maxDist) {
      maxDist = d;
      splitIndex = i;
    }
  }
  if (splitIndex === 0) return points;

  const firstHalf = points.slice(0, splitIndex + 1);
  const secondHalf = [...points.slice(splitIndex), points[0]];

  const a = simplifyPolygon(firstHalf, epsilon);
  const b = simplifyPolygon(secondHalf, epsilon);

  const merged = [...a.slice(0, a.length - 1), ...b.slice(0, b.length - 1)];
  return merged.length >= 3 ? merged : points;
}

/**
 * Removes vertices that are effectively collinear with their neighbours.
 * These are harmless in a polygon but become knife-chatter micro-nodes and
 * offset spikes once the contour is expanded.
 */
export function removeCollinearVertices(points: Point2D[], tolerance: number): Point2D[] {
  const n = points.length;
  if (n <= 3) return points;

  const out: Point2D[] = [];
  for (let i = 0; i < n; i++) {
    const prev = points[(i - 1 + n) % n];
    const curr = points[i];
    const next = points[(i + 1) % n];
    if (perpendicularDistance(curr, prev, next) > tolerance) out.push(curr);
  }
  return out.length >= 3 ? out : points;
}

/** Removes consecutive duplicate / near-duplicate vertices. */
export function dedupePolygon(points: Point2D[], minDistance: number): Point2D[] {  if (points.length <= 3) return points;
  const out: Point2D[] = [points[0]];
  for (let i = 1; i < points.length; i++) {
    const prev = out[out.length - 1];
    if (Math.hypot(points[i].x - prev.x, points[i].y - prev.y) >= minDistance) out.push(points[i]);
  }
  while (
    out.length > 3 &&
    Math.hypot(out[0].x - out[out.length - 1].x, out[0].y - out[out.length - 1].y) < minDistance
  ) {
    out.pop();
  }
  return out;
}

/**
 * Normalises a silhouette so its bounding box fills the [-0.5..0.5] artwork box
 * as closely as possible without distorting it.
 *
 * The traced silhouette is expressed relative to the artwork canvas, but the
 * canvas may still contain transparent slack (e.g. an SVG with internal
 * padding). Uniformly re-fitting the silhouette guarantees that the configured
 * physical sticker size applies to the actual cut shape, while preserving the
 * artwork's aspect ratio.
 */
export function fitSilhouetteToBox(points: Point2D[]): Point2D[] {
  if (points.length < 3) return points;

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }

  const w = maxX - minX;
  const h = maxY - minY;
  if (w <= 1e-9 || h <= 1e-9) return points;

  // Uniform scale: fill the box in the dominant dimension, never distort.
  const scale = 1 / Math.max(w, h);
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;

  return points.map((p) => ({
    x: (p.x - cx) * scale,
    y: (p.y - cy) * scale,
  }));
}

/**
 * Detects the degenerate "cutline is just the image rectangle" failure, which
 * happens when leftover background pixels form a frame around the artwork.
 */
export function isFullFrameSilhouette(
  points: Point2D[],
  width: number,
  height: number,
  toleranceRatio = 0.985
): boolean {
  if (points.length < 4) return false;
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }
  const w = maxX - minX;
  const h = maxY - minY;
  return w >= width * toleranceRatio && h >= height * toleranceRatio;
}

/**
 * Full silhouette extraction from an RGBA buffer.
 * Coordinates are normalised to [-0.5..0.5] relative to the artwork canvas.
 */
export function extractSilhouetteFromImageData(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  options: SilhouetteOptions = {}
): SilhouetteResult {
  const high = options.alphaThresholdHigh ?? DEFAULTS.alphaThresholdHigh;
  const low = Math.min(options.alphaThresholdLow ?? DEFAULTS.alphaThresholdLow, high);
  const warnings: string[] = [];

  const { mask, method, transparentRatio } = buildForegroundMask(data, width, height, high, low);

  const { labels, components } = labelComponents(mask, width, height);
  const selection = selectComponents(components, options);
  warnings.push(...selection.warnings);

  if (selection.kept.length === 0) {
    return {
      points: [],
      diagnostics: {
        method: 'none',
        alphaThresholdHigh: high,
        alphaThresholdLow: low,
        transparentPixelRatio: Math.round(transparentRatio * 1000) / 1000,
        componentCount: components.length,
        keptComponentCount: 0,
        droppedComponentCount: selection.dropped.length,
        droppedAreaRatio: 0,
        bridgedComponentCount: 0,
        simplifyTolerancePx: 0,
        rawBoundaryPoints: 0,
        finalPointCount: 0,
        isFullFrame: false,
        warnings,
      },
    };
  }

  let union = buildUnionMask(labels, selection.kept, width, height);
  union = closeMask(union, width, height, options.closeRadiusPx ?? DEFAULTS.closeRadiusPx);

  let bridged = 0;
  if (options.bridgeDisconnected !== false) {
    bridged = bridgeComponents(union, width, height);
  }

  const rawBoundary = traceOuterBoundary(union, width, height);
  if (!rawBoundary) {
    return {
      points: [],
      diagnostics: {
        method,
        alphaThresholdHigh: high,
        alphaThresholdLow: low,
        transparentPixelRatio: Math.round(transparentRatio * 1000) / 1000,
        componentCount: components.length,
        keptComponentCount: selection.kept.length,
        droppedComponentCount: selection.dropped.length,
        droppedAreaRatio: Math.round(selection.droppedAreaRatio * 1000) / 1000,
        bridgedComponentCount: bridged,
        simplifyTolerancePx: 0,
        rawBoundaryPoints: 0,
        finalPointCount: 0,
        isFullFrame: false,
        warnings: [...warnings, 'Boundary tracing produced no closed loop.'],
      },
    };
  }

  const fullFrame = isFullFrameSilhouette(rawBoundary, width, height);
  if (fullFrame) {
    warnings.push(
      'Traced silhouette covers the entire image canvas — leftover background pixels are likely framing the artwork.'
    );
  }

  // Adaptive tolerance: derived from the physical size when known, otherwise
  // from the sampling resolution. Never a fixed pixel constant.
  const toleranceMm = options.toleranceMm ?? DEFAULTS.toleranceMm;
  const physicalSizeMm = options.physicalSizeMm;
  const pxPerMm = physicalSizeMm && physicalSizeMm > 0 ? width / physicalSizeMm : null;
  const tolerancePx = pxPerMm
    ? Math.max(0.6, Math.min(3.0, toleranceMm * pxPerMm))
    : Math.max(0.6, Math.min(3.0, 0.0012 * Math.min(width, height)));

  let simplified = simplifyClosedPolygon(rawBoundary, tolerancePx);
  simplified = removeCollinearVertices(simplified, tolerancePx * 0.5);
  simplified = dedupePolygon(simplified, Math.max(0.5, tolerancePx * 0.5));
  if (simplified.length < 4) simplified = rawBoundary;

  const normalized: Point2D[] = simplified.map((p) => ({
    x: p.x / width - 0.5,
    y: p.y / height - 0.5,
  }));

  if (signedArea(normalized) < 0) normalized.reverse();

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const p of rawBoundary) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }

  return {
    points: normalized,
    diagnostics: {
      method,
      alphaThresholdHigh: high,
      alphaThresholdLow: low,
      transparentPixelRatio: Math.round(transparentRatio * 1000) / 1000,
      componentCount: components.length,
      keptComponentCount: selection.kept.length,
      droppedComponentCount: selection.dropped.length,
      droppedAreaRatio: Math.round(selection.droppedAreaRatio * 1000) / 1000,
      bridgedComponentCount: bridged,
      simplifyTolerancePx: Math.round(tolerancePx * 100) / 100,
      rawBoundaryPoints: rawBoundary.length,
      finalPointCount: normalized.length,
      isFullFrame: fullFrame,
      boundsPx: {
        minX: Math.floor(minX),
        minY: Math.floor(minY),
        maxX: Math.ceil(maxX),
        maxY: Math.ceil(maxY),
      },
      warnings,
    },
  };
}
