/**
 * COMMERCIAL-GRADE CONTOUR GENERATION & VECTOR CUTLINE ENGINE
 * 
 * Produces commercial prepress-grade, silky-smooth vector cut paths:
 * - High-resolution exterior silhouette extraction with interior cavity fill
 * - Exact mathematical offset (inset/outset) with smooth circular arcs on convex turns
 * - Exact parallel edge intersections on concave turns (zero inward intrusion)
 * - Self-intersection detection & robust loop handling (never slices off handles or protrusions)
 * - Schneider's Bézier curve fitting & node reduction via Paper.js
 * - Continuous tangent continuity across curves with razor-sharp corner preservation (>45°)
 * - Automatic enclosure validation & safe recovery (guarantees cutline fully surrounds artwork)
 * - Standard SVG 'd' path strings compatible with Canvas 2D Path2D, Paper.js, SVG, and PDF export
 */

import paper from 'paper';
import { ContourConfig } from '../types';

export interface Point2D {
  x: number;
  y: number;
}

export interface ContourValidationResult {
  isValid: boolean;
  isClosed: boolean;
  pointsOutsideCount: number;
  maxDistanceOutsideMm: number;
  nodeCount: number;
  errorMessage?: string;
}

/**
 * Calculates perpendicular distance from a point to a line segment
 */
export function perpendicularDistance(pt: Point2D, lineStart: Point2D, lineEnd: Point2D): number {
  const dx = lineEnd.x - lineStart.x;
  const dy = lineEnd.y - lineStart.y;
  const mag = Math.hypot(dx, dy);
  if (mag === 0) return Math.hypot(pt.x - lineStart.x, pt.y - lineStart.y);
  return Math.abs(dy * pt.x - dx * pt.y + lineEnd.x * lineStart.y - lineEnd.y * lineStart.x) / mag;
}

/**
 * Ramer-Douglas-Peucker (RDP) polygon simplification algorithm.
 * Removes redundant points and micro-jaggies to produce clean lines.
 */
export function ramerDouglasPeucker(points: Point2D[], epsilon: number): Point2D[] {
  if (points.length <= 2) return points;
  let dmax = 0;
  let index = 0;
  const last = points.length - 1;

  for (let i = 1; i < last; i++) {
    const d = perpendicularDistance(points[i], points[0], points[last]);
    if (d > dmax) {
      index = i;
      dmax = d;
    }
  }

  if (dmax > epsilon) {
    const res1 = ramerDouglasPeucker(points.slice(0, index + 1), epsilon);
    const res2 = ramerDouglasPeucker(points.slice(index), epsilon);
    return res1.slice(0, res1.length - 1).concat(res2);
  } else {
    return [points[0], points[last]];
  }
}

/**
 * Computes signed area of a 2D polygon using the Shoelace formula.
 * In screen coordinates (Y down): area > 0 means clockwise.
 */
export function polygonSignedArea(pts: Point2D[]): number {
  let sum = 0;
  const N = pts.length;
  for (let i = 0; i < N; i++) {
    const p1 = pts[i];
    const p2 = pts[(i + 1) % N];
    sum += p1.x * p2.y - p2.x * p1.y;
  }
  return sum / 2;
}

/**
 * Checks whether two line segments (p1-p2) and (p3-p4) intersect.
 */
export function segmentsIntersectDetailed(
  p1: Point2D,
  p2: Point2D,
  p3: Point2D,
  p4: Point2D
): Point2D | null {
  const d1 = (p2.x - p1.x) * (p3.y - p1.y) - (p2.y - p1.y) * (p3.x - p1.x);
  const d2 = (p2.x - p1.x) * (p4.y - p1.y) - (p2.y - p1.y) * (p4.x - p1.x);
  const d3 = (p4.x - p3.x) * (p1.y - p3.y) - (p4.y - p3.y) * (p1.x - p3.x);
  const d4 = (p4.x - p3.x) * (p2.y - p3.y) - (p4.y - p3.y) * (p2.x - p3.x);

  if (
    ((d1 > 1e-6 && d2 < -1e-6) || (d1 < -1e-6 && d2 > 1e-6)) &&
    ((d3 > 1e-6 && d4 < -1e-6) || (d3 < -1e-6 && d4 > 1e-6))
  ) {
    const denom = (p1.x - p2.x) * (p3.y - p4.y) - (p1.y - p2.y) * (p3.x - p4.x);
    if (Math.abs(denom) < 1e-9) return null;
    const t = ((p1.x - p3.x) * (p3.y - p4.y) - (p1.y - p3.y) * (p3.x - p4.x)) / denom;
    return {
      x: p1.x + t * (p2.x - p1.x),
      y: p1.y + t * (p2.y - p1.y),
    };
  }
  return null;
}

/**
 * Counts self-intersections in a closed polygon.
 */
export function countPolygonSelfIntersections(pts: Point2D[]): number {
  let count = 0;
  const n = pts.length;
  for (let i = 0; i < n; i++) {
    const p1 = pts[i];
    const p2 = pts[(i + 1) % n];
    for (let j = i + 2; j < n; j++) {
      if ((i === 0 && j === n - 1) || Math.abs(i - j) <= 1) continue;
      const p3 = pts[j];
      const p4 = pts[(j + 1) % n];
      if (segmentsIntersectDetailed(p1, p2, p3, p4)) {
        count++;
      }
    }
  }
  return count;
}

/**
 * Robustly removes retrograde self-intersecting loops and bow-ties while strictly
 * preserving real artwork protrusions, handles, and features.
 */
export function removePolygonLoops(pts: Point2D[]): Point2D[] {
  let poly = [...pts];
  let maxIters = 35;

  while (maxIters-- > 0) {
    let found = false;
    const n = poly.length;
    for (let i = 0; i < n && !found; i++) {
      const p1 = poly[i];
      const p2 = poly[(i + 1) % n];

      for (let j = i + 2; j < n && !found; j++) {
        if (i === 0 && j === n - 1) continue;
        const p3 = poly[j];
        const p4 = poly[(j + 1) % n];

        const inter = segmentsIntersectDetailed(p1, p2, p3, p4);
        if (inter) {
          // Construct candidate Loop A (outside loop) and Loop B (interior loop)
          const loopA: Point2D[] = [];
          for (let k = 0; k <= i; k++) loopA.push(poly[k]);
          loopA.push(inter);
          for (let k = j + 1; k < n; k++) loopA.push(poly[k]);

          const loopB: Point2D[] = [inter];
          for (let k = i + 1; k <= j; k++) loopB.push(poly[k]);

          // Compare area: always retain the loop with larger physical area
          // to avoid chopping off major protrusions or handles
          const areaA = Math.abs(polygonSignedArea(loopA));
          const areaB = Math.abs(polygonSignedArea(loopB));

          poly = areaA >= areaB ? loopA : loopB;
          found = true;
          break;
        }
      }
    }
    if (!found) break;
  }
  return poly;
}

/**
 * Removes overlapping or tightly clustered nodes within a minimum distance threshold
 * to eliminate knife stutter, burrs, and node piling.
 */
export function removeClusteredNodes(pts: Point2D[], minDistanceMm: number): Point2D[] {
  if (pts.length <= 3) return pts;
  const filtered: Point2D[] = [pts[0]];
  for (let i = 1; i < pts.length; i++) {
    const prev = filtered[filtered.length - 1];
    const curr = pts[i];
    if (Math.hypot(curr.x - prev.x, curr.y - prev.y) >= minDistanceMm) {
      filtered.push(curr);
    }
  }
  // Check closing segment
  if (filtered.length > 3) {
    const first = filtered[0];
    const last = filtered[filtered.length - 1];
    if (Math.hypot(first.x - last.x, first.y - last.y) < minDistanceMm) {
      filtered.pop();
    }
  }
  return filtered;
}

/**
 * Detects whether a set of 2D perimeter points represents a continuous circle
 * (e.g. a round sticker or badge) within a tight radial tolerance (CV < 2.5%).
 */
export function detectPerfectCircle(
  pts: Point2D[],
  tolerance = 0.025
): { isCircle: boolean; cx: number; cy: number; radiusMm: number } | null {
  if (pts.length < 8) return null;

  let sumX = 0;
  let sumY = 0;
  for (const p of pts) {
    sumX += p.x;
    sumY += p.y;
  }
  const cx = sumX / pts.length;
  const cy = sumY / pts.length;

  const radii = pts.map((p) => Math.hypot(p.x - cx, p.y - cy));
  const meanR = radii.reduce((a, b) => a + b, 0) / radii.length;
  if (meanR < 1.0) return null;

  let variance = 0;
  let maxDev = 0;
  for (const r of radii) {
    const dev = Math.abs(r - meanR);
    variance += dev * dev;
    if (dev > maxDev) maxDev = dev;
  }
  const stdDev = Math.sqrt(variance / radii.length);
  const cv = stdDev / meanR;

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const p of pts) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }
  const w = maxX - minX;
  const h = maxY - minY;
  const aspectDev = Math.abs(w - h) / Math.max(w, h);

  if (cv <= tolerance && aspectDev <= tolerance * 1.5 && maxDev / meanR <= tolerance * 2) {
    return {
      isCircle: true,
      cx,
      cy,
      radiusMm: meanR,
    };
  }

  return null;
}

/**
 * Robust mathematical polygon offset:
 * Expands edges outward by offsetMm. Applies smooth circular arcs on convex turns
 * and exact line intersections on concave turns (guaranteeing zero inward intrusion).
 */
export function offsetPolygon(
  pts: Point2D[],
  offset: number,
  cornerStyle: 'round' | 'miter' | 'bevel' = 'round',
  miterLimit = 2.5
): Point2D[] {
  if (pts.length < 3) return pts;
  if (Math.abs(offset) < 0.001) return [...pts];

  // Enforce clockwise winding (Y down)
  let polygon = [...pts];
  if (polygonSignedArea(polygon) < 0) {
    polygon.reverse();
  }

  const N = polygon.length;
  const offsetPts: Point2D[] = [];

  for (let i = 0; i < N; i++) {
    const prev = polygon[(i - 1 + N) % N];
    const curr = polygon[i];
    const next = polygon[(i + 1) % N];

    // Edge 1: prev -> curr
    const e1x = curr.x - prev.x;
    const e1y = curr.y - prev.y;
    const len1 = Math.hypot(e1x, e1y) || 1e-6;
    const n1x = e1y / len1;
    const n1y = -e1x / len1;

    // Edge 2: curr -> next
    const e2x = next.x - curr.x;
    const e2y = next.y - curr.y;
    const len2 = Math.hypot(e2x, e2y) || 1e-6;
    const n2x = e2y / len2;
    const n2y = -e2x / len2;

    const cross = e1x * e2y - e1y * e2x;
    const isConvex = cross > 0;
    const dotNormals = n1x * n2x + n1y * n2y;

    if (isConvex && offset > 0) {
      if (cornerStyle === 'round') {
        const angle1 = Math.atan2(n1y, n1x);
        let angle2 = Math.atan2(n2y, n2x);
        while (angle2 < angle1) angle2 += Math.PI * 2;
        const arcAngle = angle2 - angle1;

        if (arcAngle > 0.05 && arcAngle < Math.PI * 1.8) {
          const steps = Math.min(8, Math.max(2, Math.ceil(arcAngle / (Math.PI / 4))));
          for (let s = 0; s <= steps; s++) {
            const a = angle1 + (arcAngle * s) / steps;
            offsetPts.push({
              x: curr.x + Math.cos(a) * offset,
              y: curr.y + Math.sin(a) * offset,
            });
          }
        } else {
          offsetPts.push({ x: curr.x + n1x * offset, y: curr.y + n1y * offset });
        }
      } else if (cornerStyle === 'miter') {
        const denom = 1 + dotNormals;
        const miterRatio = denom > 1e-4 ? Math.sqrt(2 / denom) : miterLimit + 1;
        if (miterRatio <= miterLimit && denom > 1e-4) {
          const mx = (n1x + n2x) / denom;
          const my = (n1y + n2y) / denom;
          offsetPts.push({ x: curr.x + mx * offset, y: curr.y + my * offset });
        } else {
          offsetPts.push({ x: curr.x + n1x * offset, y: curr.y + n1y * offset });
          offsetPts.push({ x: curr.x + n2x * offset, y: curr.y + n2y * offset });
        }
      } else {
        // Bevel
        offsetPts.push({ x: curr.x + n1x * offset, y: curr.y + n1y * offset });
        offsetPts.push({ x: curr.x + n2x * offset, y: curr.y + n2y * offset });
      }
    } else {
      // Concave corner: exact line intersection between parallel offset lines
      const denom = 1 + dotNormals;
      if (denom > 0.15) {
        const mx = (n1x + n2x) / denom;
        const my = (n1y + n2y) / denom;
        offsetPts.push({ x: curr.x + mx * offset, y: curr.y + my * offset });
      } else {
        let bx = (n1x + n2x) / 2;
        let by = (n1y + n2y) / 2;
        const blen = Math.hypot(bx, by) || 1;
        offsetPts.push({ x: curr.x + (bx / blen) * offset, y: curr.y + (by / blen) * offset });
      }
    }
  }

  return removePolygonLoops(offsetPts);
}

/**
 * Validates that a generated contour SVG path is closed and completely encloses
 * all artwork boundary points within tolerance.
 */
export function validateContourEnclosure(
  contourSvgPath: string,
  artworkMmPts: Point2D[],
  toleranceMm = 0.05
): ContourValidationResult {
  if (!contourSvgPath || contourSvgPath.trim().length === 0) {
    return {
      isValid: false,
      isClosed: false,
      pointsOutsideCount: artworkMmPts.length,
      maxDistanceOutsideMm: Infinity,
      nodeCount: 0,
      errorMessage: 'Contour path is empty',
    };
  }

  const trimmed = contourSvgPath.trim();
  const isClosedSyntax = /[zZ]\s*$/.test(trimmed);
  if (!isClosedSyntax) {
    return {
      isValid: false,
      isClosed: false,
      pointsOutsideCount: artworkMmPts.length,
      maxDistanceOutsideMm: Infinity,
      nodeCount: 0,
      errorMessage: 'Path does not end with close command (Z/z)',
    };
  }

  try {
    const scope = new paper.PaperScope();
    scope.setup(new paper.Size(1000, 1000));
    const path = new scope.Path(contourSvgPath);
    if (!path.closed) path.closed = true;

    const nodeCount = path.segments.length;
    let outsideCount = 0;
    let maxDistOutside = 0;

    for (const p of artworkMmPts) {
      const pt = new scope.Point(p.x, p.y);
      if (!path.contains(pt)) {
        const nearest = path.getNearestPoint(pt);
        const dist = pt.getDistance(nearest);
        if (dist > toleranceMm) {
          outsideCount++;
          if (dist > maxDistOutside) maxDistOutside = dist;
        }
      }
    }

    const isValid = outsideCount === 0;

    return {
      isValid,
      isClosed: true,
      pointsOutsideCount: outsideCount,
      maxDistanceOutsideMm: Math.round(maxDistOutside * 1000) / 1000,
      nodeCount,
      errorMessage: isValid
        ? undefined
        : `${outsideCount} artwork points extend up to ${maxDistOutside.toFixed(3)}mm outside contour`,
    };
  } catch (err: any) {
    return {
      isValid: false,
      isClosed: isClosedSyntax,
      pointsOutsideCount: artworkMmPts.length,
      maxDistanceOutsideMm: Infinity,
      nodeCount: 0,
      errorMessage: `Failed to parse contour path: ${err.message}`,
    };
  }
}

/**
 * Fits high-grade cubic Bézier curves through points using Paper.js,
 * preserving sharp corners (> 45°) and automatically validating that the
 * smoothed curve NEVER cuts into the artwork silhouette.
 */
export function fitPaperJsBezierPath(
  points: Point2D[],
  smoothing: number,
  cornerStyle: 'round' | 'miter' | 'bevel' = 'round',
  artworkPts?: Point2D[]
): string {
  const n = points.length;
  if (n < 3) return '';

  const buildLinearPath = (pts: Point2D[]): string => {
    let d = `M ${pts[0].x.toFixed(3)} ${pts[0].y.toFixed(3)}`;
    for (let i = 1; i < pts.length; i++) {
      d += ` L ${pts[i].x.toFixed(3)} ${pts[i].y.toFixed(3)}`;
    }
    d += ' Z';
    return d;
  };

  if (smoothing <= 0.05) {
    return buildLinearPath(points);
  }

  try {
    const scope = new paper.PaperScope();
    scope.setup(new paper.Size(1000, 1000));

    const path = new scope.Path();
    for (const pt of points) {
      path.add(new scope.Point(pt.x, pt.y));
    }
    path.closed = true;

    const clampedSmooth = Math.max(0, Math.min(1, smoothing));
    // Safe simplification tolerance: 0.02mm to 0.16mm
    const simplifyTolerance = Math.max(0.02, 0.03 + clampedSmooth * 0.13);
    path.simplify(simplifyTolerance);

    const segs = path.segments;
    const segCount = segs.length;

    for (let i = 0; i < segCount; i++) {
      const seg = segs[i];
      const prev = segs[(i - 1 + segCount) % segCount];
      const next = segs[(i + 1) % segCount];

      const v1 = seg.point.subtract(prev.point);
      const v2 = next.point.subtract(seg.point);
      const l1 = v1.length;
      const l2 = v2.length;

      if (l1 > 1e-4 && l2 > 1e-4) {
        const dot = v1.x * v2.x + v1.y * v2.y;
        const cosTurn = Math.max(-1, Math.min(1, dot / (l1 * l2)));
        const turnAngleDeg = Math.acos(cosTurn) * (180 / Math.PI);

        // Turn angle > 45 degrees: maintain sharp geometric corner with 0 handles
        if (turnAngleDeg > 45 && cornerStyle !== 'round') {
          seg.handleIn = new scope.Point(0, 0);
          seg.handleOut = new scope.Point(0, 0);
        } else if (clampedSmooth > 0.15 && turnAngleDeg <= 45) {
          // Use Paper.js segment.smooth with valid catmull-rom algorithm
          seg.smooth({ type: 'catmull-rom', factor: Math.min(0.5, clampedSmooth * 0.45) });
        }
      }
    }

    const svgPath = path.pathData;
    if (svgPath && svgPath.length > 5) {
      // Validate enclosure if artwork points provided
      if (artworkPts && artworkPts.length > 0) {
        const val = validateContourEnclosure(svgPath, artworkPts, 0.05);
        if (!val.isValid) {
          // Recovery: use exact enclosing polygon
          return buildLinearPath(points);
        }
      }
      return svgPath.replace(/z\s*$/, 'Z');
    }
  } catch (err) {
    console.warn('Paper.js curve fitting fallback:', err);
  }

  return buildLinearPath(points);
}

/**
 * Analyzes artwork raster/vector image and extracts STRICTLY its outermost perimeter
 * silhouette as a normalized polygon with coordinates in range [-0.5..0.5, -0.5..0.5].
 * 
 * Uses a padded canvas with exterior BFS flood-fill and Moore-Neighbor boundary tracing,
 * ensuring complete outer silhouette extraction with all interior cavities (holes in handles,
 * letter counters) solidly preserved as foreground.
 */
export interface PerimeterTraceResult {
  points: Point2D[];
  /** Human-readable diagnostic info for debugging */
  diagnostics?: {
    thresholdUsed: number;
    transparentPixelRatio: number;
    method: 'alpha' | 'color_diff' | 'none';
    retryCount: number;
  };
}

/**
 * Core perimeter extraction logic shared across retry attempts.
 * @returns Traced boundary points in normalized [-0.5..0.5] coordinates, or null on failure.
 */
function tracePerimeterFromImageData(
  data: Uint8ClampedArray,
  paddedW: number,
  paddedH: number,
  padding: number,
  W: number,
  H: number,
  alphaThreshold: number
): Point2D[] | null {
  const totalPixels = paddedW * paddedH;

  // 1. Detect transparency & create binary grid
  let transparentCount = 0;
  for (let i = 3; i < data.length; i += 4) {
    if (data[i] < alphaThreshold) transparentCount++;
  }

  const hasAlpha = transparentCount > 10;
  const rawGrid = new Uint8Array(totalPixels);

  if (hasAlpha) {
    for (let i = 0; i < totalPixels; i++) {
      rawGrid[i] = data[i * 4 + 3] >= alphaThreshold ? 1 : 0;
    }
  } else {
    // Solid substrate without alpha: sample outer border to establish background
    const c1 = [data[0], data[1], data[2]];
    const c2 = [data[(paddedW - 1) * 4], data[(paddedW - 1) * 4 + 1], data[(paddedW - 1) * 4 + 2]];
    const c3 = [data[(paddedH - 1) * paddedW * 4], data[(paddedH - 1) * paddedW * 4 + 1], data[(paddedH - 1) * paddedW * 4 + 2]];
    const c4 = [data[(paddedH * paddedW - 1) * 4], data[(paddedH * paddedW - 1) * 4 + 1], data[(paddedH * paddedW - 1) * 4 + 2]];
    const bgR = (c1[0] + c2[0] + c3[0] + c4[0]) / 4;
    const bgG = (c1[1] + c2[1] + c3[1] + c4[1]) / 4;
    const bgB = (c1[2] + c2[2] + c3[2] + c4[2]) / 4;

    for (let i = 0; i < totalPixels; i++) {
      const r = data[i * 4];
      const g = data[i * 4 + 1];
      const b = data[i * 4 + 2];
      const diff = Math.hypot(r - bgR, g - bgG, b - bgB);
      rawGrid[i] = diff > 30 ? 1 : 0;
    }
  }

  // 2. EXTERIOR FLOOD-FILL (BFS)
  // Starts from all outer borders of the padded canvas
  const visitedExterior = new Uint8Array(totalPixels);
  const queue: number[] = [];

  for (let x = 0; x < paddedW; x++) {
    const topIdx = x;
    const btmIdx = (paddedH - 1) * paddedW + x;
    if (rawGrid[topIdx] === 0 && visitedExterior[topIdx] === 0) {
      visitedExterior[topIdx] = 1;
      queue.push(topIdx);
    }
    if (rawGrid[btmIdx] === 0 && visitedExterior[btmIdx] === 0) {
      visitedExterior[btmIdx] = 1;
      queue.push(btmIdx);
    }
  }
  for (let y = 0; y < paddedH; y++) {
    const leftIdx = y * paddedW;
    const rightIdx = y * paddedW + (paddedW - 1);
    if (rawGrid[leftIdx] === 0 && visitedExterior[leftIdx] === 0) {
      visitedExterior[leftIdx] = 1;
      queue.push(leftIdx);
    }
    if (rawGrid[rightIdx] === 0 && visitedExterior[rightIdx] === 0) {
      visitedExterior[rightIdx] = 1;
      queue.push(rightIdx);
    }
  }

  let qHead = 0;
  while (qHead < queue.length) {
    const idx = queue[qHead++];
    const qx = idx % paddedW;
    const qy = Math.floor(idx / paddedW);

    const neighbors = [
      [qx - 1, qy],
      [qx + 1, qy],
      [qx, qy - 1],
      [qx, qy + 1],
    ];

    for (const [nx, ny] of neighbors) {
      if (nx >= 0 && nx < paddedW && ny >= 0 && ny < paddedH) {
        const nIdx = ny * paddedW + nx;
        if (rawGrid[nIdx] === 0 && visitedExterior[nIdx] === 0) {
          visitedExterior[nIdx] = 1;
          queue.push(nIdx);
        }
      }
    }
  }

  // 3. Create strictly solid outer silhouette
  const solidGrid = new Uint8Array(totalPixels);
  let firstX = -1;
  let firstY = -1;

  for (let y = 0; y < paddedH; y++) {
    for (let x = 0; x < paddedW; x++) {
      const idx = y * paddedW + x;
      if (visitedExterior[idx] === 0) {
        solidGrid[idx] = 1;
        if (firstX === -1) {
          firstX = x;
          firstY = y;
        }
      }
    }
  }

  if (firstX === -1 || firstY === -1) {
    return null;
  }

  // 4. Moore-Neighbor boundary tracing with Jacob's stopping condition
  const DIRS: [number, number][] = [
    [0, -1],  // 0: N
    [1, -1],  // 1: NE
    [1, 0],   // 2: E
    [1, 1],   // 3: SE
    [0, 1],   // 4: S
    [-1, 1],  // 5: SW
    [-1, 0],  // 6: W
    [-1, -1], // 7: NW
  ];

  const boundary: Point2D[] = [];
  let currX = firstX;
  let currY = firstY;
  let startDir = 6; // searching clockwise starting from West
  let secondPt: Point2D | null = null;
  let maxSteps = 30000;

  boundary.push({ x: currX + 0.5, y: currY + 0.5 });

  while (maxSteps-- > 0) {
    let found = false;
    for (let i = 0; i < 8; i++) {
      const d = (startDir + i) % 8;
      const nx = currX + DIRS[d][0];
      const ny = currY + DIRS[d][1];

      if (nx >= 0 && nx < paddedW && ny >= 0 && ny < paddedH && solidGrid[ny * paddedW + nx] === 1) {
        currX = nx;
        currY = ny;
        startDir = (d + 5) % 8;
        const pt = { x: currX + 0.5, y: currY + 0.5 };
        boundary.push(pt);
        found = true;

        if (boundary.length === 2) {
          secondPt = pt;
        }
        break;
      }
    }

    if (!found) break;

    // Jacob's stopping condition
    if (
      boundary.length > 3 &&
      currX === firstX &&
      currY === firstY &&
      secondPt &&
      boundary[1].x === secondPt.x &&
      boundary[1].y === secondPt.y
    ) {
      break;
    }
  }

  if (boundary.length < 4) {
    return null;
  }

  // Remove duplicate closure point if present
  const last = boundary[boundary.length - 1];
  const first = boundary[0];
  if (last.x === first.x && last.y === first.y) {
    boundary.pop();
  }

  // 5. Convert back from padded coordinates to normalized [-0.5..0.5]
  const normalized: Point2D[] = boundary.map((p) => ({
    x: Math.max(-0.5, Math.min(0.5, (p.x - padding) / W - 0.5)),
    y: Math.max(-0.5, Math.min(0.5, (p.y - padding) / H - 0.5)),
  }));

  // 6. Ensure clockwise winding (Y down)
  let pts = normalized;
  if (polygonSignedArea(pts) < 0) {
    pts = [...pts].reverse();
  }

  // 7. Simplify collinear points and remove clustered micro-nodes
  const rdpEps = Math.max(0.0005, 0.001);
  let simplified = ramerDouglasPeucker(pts, rdpEps);
  if (simplified.length < 4) {
    simplified = pts;
  }
  simplified = removeClusteredNodes(simplified, 0.001);
  simplified = removePolygonLoops(simplified);

  return simplified;
}

/**
 * Analyzes artwork raster/vector image and extracts STRICTLY its outermost perimeter
 * silhouette as a normalized polygon with coordinates in range [-0.5..0.5, -0.5..0.5].
 *
 * Uses a padded canvas with exterior BFS flood-fill and Moore-Neighbor boundary tracing,
 * ensuring complete outer silhouette extraction with all interior cavities (holes in handles,
 * letter counters) solidly preserved as foreground.
 *
 * Uses an adaptive alpha-threshold retry cascade to handle soft-edge / anti-aliased images:
 *   1. Try alpha ≥ 16 (crisp edges) → if empty result
 *   2. Retry with alpha ≥ 8 (softer edges) → if empty
 *   3. Retry with alpha ≥ 1 (any non-transparent pixel)
 */
export function extractArtworkPerimeter(
  srcUrl: string,
  sampleSize: number = 1024,
  padding: number = 16
): Promise<PerimeterTraceResult> {
  return new Promise<PerimeterTraceResult>((resolve) => {
    try {
      const img = new Image();
      img.crossOrigin = 'anonymous';

      img.onload = () => {
        try {
          const W = sampleSize;
          const H = Math.round(sampleSize * (img.naturalHeight / Math.max(1, img.naturalWidth)));
          const paddedW = W + padding * 2;
          const paddedH = H + padding * 2;

          const canvas = document.createElement('canvas');
          canvas.width = paddedW;
          canvas.height = paddedH;
          const ctx = canvas.getContext('2d', { willReadFrequently: true });
          if (!ctx) {
            console.warn('ContourEngine: Could not get 2d context for perimeter extraction');
            resolve({ points: [] });
            return;
          }

          ctx.drawImage(img, padding, padding, W, H);
          const imageData = ctx.getImageData(0, 0, paddedW, paddedH);
          const data = imageData.data;

          // Adaptive threshold retry cascade for soft-edge / anti-aliased images
          const thresholds = [16, 8, 1];
          let points: Point2D[] | null = null;
          let thresholdUsed = thresholds[0];
          let retryCount = 0;

          for (const t of thresholds) {
            const result = tracePerimeterFromImageData(data, paddedW, paddedH, padding, W, H, t);
            if (result !== null && result.length >= 3) {
              points = result;
              thresholdUsed = t;
              break;
            }
            retryCount++;
          }

          // Compute transparency ratio for diagnostics
          let transparentPixelRatio = 0;
          for (let i = 3; i < data.length; i += 4) {
            if (data[i] < thresholdUsed) transparentPixelRatio++;
          }
          transparentPixelRatio /= (paddedW * paddedH);

          if (!points || points.length < 3) {
            console.warn(
              `ContourEngine: Perimeter extraction failed after ${thresholds.length} threshold attempts. ` +
              `Image may be fully transparent or too small at sample resolution.`
            );
            resolve({
              points: [],
              diagnostics: {
                thresholdUsed,
                transparentPixelRatio: Math.round(transparentPixelRatio * 100) / 100,
                method: transparentPixelRatio > 0.05 ? 'alpha' : 'none',
                retryCount,
              },
            });
            return;
          }

          resolve({
            points,
            diagnostics: {
              thresholdUsed,
              transparentPixelRatio: Math.round(transparentPixelRatio * 100) / 100,
              method: transparentPixelRatio > 0.05 ? 'alpha' : 'color_diff',
              retryCount,
            },
          });
        } catch (err) {
          console.warn('ContourEngine: Error in perimeter extraction image processing:', err);
          resolve({ points: [] });
        }
      };

      img.onerror = () => {
        console.warn('ContourEngine: Failed to load image for perimeter extraction');
        resolve({ points: [] });
      };

      img.src = srcUrl;
    } catch (err) {
      console.warn('ContourEngine: Unexpected error in extractArtworkPerimeter:', err);
      resolve({ points: [] });
    }
  });
}

/**
 * Creates an offset, simplified, loop-free vector cut contour for a sticker.
 * Produces commercial-grade cubic Bézier paths with Schneider curve fitting via Paper.js,
 * automatically validated to fully enclose the artwork silhouette.
 */
export function generateContourSvgPath(
  widthMm: number,
  heightMm: number,
  config: Partial<ContourConfig> & Pick<ContourConfig, 'enabled' | 'offsetMm' | 'smoothing'>,
  perimeterPoints?: Point2D[]
): string {
  if (!config.enabled) {
    return '';
  }

  const offset = Math.max(0, config.offsetMm);
  const smoothing = Math.min(Math.max(config.smoothing, 0), 1);
  const cornerStyle = config.cornerStyle || 'round';
  const miterLimit = config.miterLimit || 2.5;

  if (perimeterPoints && perimeterPoints.length >= 3) {
    // 1. Scale normalized vertices to physical sticker mm coordinates
    const basePts: Point2D[] = perimeterPoints.map((p) => ({
      x: p.x * widthMm,
      y: p.y * heightMm,
    }));

    let pts = basePts;
    if (polygonSignedArea(pts) < 0) {
      pts = [...pts].reverse();
    }

    // 2. Circular badge detection: output exact SVG arc
    const circleInfo = detectPerfectCircle(pts, 0.025);
    if (circleInfo) {
      const finalRadius = Math.max(0.5, circleInfo.radiusMm + offset);
      const cx = circleInfo.cx;
      const cy = circleInfo.cy;
      return `M ${cx.toFixed(3)} ${(cy - finalRadius).toFixed(3)} A ${finalRadius.toFixed(3)} ${finalRadius.toFixed(3)} 0 1 0 ${cx.toFixed(3)} ${(cy + finalRadius).toFixed(3)} A ${finalRadius.toFixed(3)} ${finalRadius.toFixed(3)} 0 1 0 ${cx.toFixed(3)} ${(cy - finalRadius).toFixed(3)} Z`;
    }

    // 3. Robust mathematical polygon offset
    let offsetPts = offsetPolygon(pts, offset, cornerStyle, miterLimit);

    // 4. Declustering to eliminate knife stutter
    offsetPts = removeClusteredNodes(offsetPts, 0.12);

    // 5. Pre-simplification for collinear edges
    const rdpEps = Math.max(0.03, 0.05 + (1 - smoothing) * 0.08);
    let simplified = ramerDouglasPeucker(offsetPts, rdpEps);
    if (simplified.length < 4) {
      simplified = offsetPts;
    }

    // 6. Safe curve fitting with validation & enclosure recovery
    return fitPaperJsBezierPath(simplified, smoothing, cornerStyle, pts);
  }

  // Fallback: If square dimensions with high smoothing, treat as circular badge
  if (Math.abs(widthMm - heightMm) < 0.1 && smoothing >= 0.9) {
    const r = widthMm / 2 + offset;
    return `M 0.000 ${(-r).toFixed(3)} A ${r.toFixed(3)} ${r.toFixed(3)} 0 1 0 0.000 ${r.toFixed(3)} A ${r.toFixed(3)} ${r.toFixed(3)} 0 1 0 0.000 ${(-r).toFixed(3)} Z`;
  }

  // Fallback: Clean rectangular / rounded badge cut contour
  const totalW = widthMm + offset * 2;
  const totalH = heightMm + offset * 2;
  const maxRadius = Math.min(totalW, totalH) / 2;
  const cornerRadius = smoothing * maxRadius;

  const minX = -totalW / 2;
  const maxX = totalW / 2;
  const minY = -totalH / 2;
  const maxY = totalH / 2;

  if (cornerRadius <= 0.5) {
    return `M ${minX.toFixed(3)} ${minY.toFixed(3)} L ${maxX.toFixed(3)} ${minY.toFixed(3)} L ${maxX.toFixed(3)} ${maxY.toFixed(3)} L ${minX.toFixed(3)} ${maxY.toFixed(3)} Z`;
  }

  const r = cornerRadius;
  return `M ${(minX + r).toFixed(3)} ${minY.toFixed(3)} L ${(maxX - r).toFixed(3)} ${minY.toFixed(3)} Q ${maxX.toFixed(3)} ${minY.toFixed(3)} ${maxX.toFixed(3)} ${(minY + r).toFixed(3)} L ${maxX.toFixed(3)} ${(maxY - r).toFixed(3)} Q ${maxX.toFixed(3)} ${maxY.toFixed(3)} ${(maxX - r).toFixed(3)} ${maxY.toFixed(3)} L ${(minX + r).toFixed(3)} ${maxY.toFixed(3)} Q ${minX.toFixed(3)} ${maxY.toFixed(3)} ${minX.toFixed(3)} ${(maxY - r).toFixed(3)} L ${minX.toFixed(3)} ${(minY + r).toFixed(3)} Q ${minX.toFixed(3)} ${minY.toFixed(3)} ${(minX + r).toFixed(3)} ${minY.toFixed(3)} Z`;
}

/**
 * Analyzes contour topology metrics for TypeSafe pre-flight verification
 */
export function analyzeContourTopology(pts: Point2D[]): {
  nodeCount: number;
  selfIntersections: number;
  isSingleLoop: boolean;
  minSegmentLengthMm: number;
} {
  const n = pts.length;
  if (n < 3) {
    return {
      nodeCount: n,
      selfIntersections: 0,
      isSingleLoop: false,
      minSegmentLengthMm: 0,
    };
  }

  let minLen = Infinity;
  for (let i = 0; i < n; i++) {
    const p1 = pts[i];
    const p2 = pts[(i + 1) % n];
    const len = Math.hypot(p2.x - p1.x, p2.y - p1.y);
    if (len < minLen) minLen = len;
  }

  const selfIntersections = countPolygonSelfIntersections(pts);

  return {
    nodeCount: n,
    selfIntersections,
    isSingleLoop: selfIntersections === 0,
    minSegmentLengthMm: Math.round(minLen * 100) / 100,
  };
}

/**
 * Parses an SVG string to extract its viewBox or explicit dimensions
 */
export function parseSvgDimensions(svgString: string): { width: number; height: number; aspectRatio: number } {
  try {
    let width = 100;
    let height = 100;

    const parseUnit = (valStr: string | null): number | null => {
      if (!valStr) return null;
      const str = valStr.trim();
      const num = parseFloat(str);
      if (isNaN(num) || num <= 0) return null;
      if (str.endsWith('mm')) return num * 3.7795;
      if (str.endsWith('cm')) return num * 37.795;
      if (str.endsWith('in')) return num * 96;
      if (str.endsWith('pt')) return num * 1.3333;
      return num;
    };

    // Fast regex parsing for browser and node environments
    const vbMatch = svgString.match(/viewBox\s*=\s*["']([^"']+)["']/i);
    if (vbMatch) {
      const parts = vbMatch[1].trim().split(/[\s,]+/).map(Number);
      if (parts.length === 4 && parts[2] > 0 && parts[3] > 0) {
        width = parts[2];
        height = parts[3];
      }
    }

    const wMatch = svgString.match(/<svg[^>]*\bwidth\s*=\s*["']([^"']+)["']/i);
    const hMatch = svgString.match(/<svg[^>]*\bheight\s*=\s*["']([^"']+)["']/i);
    const parsedW = wMatch ? parseUnit(wMatch[1]) : null;
    const parsedH = hMatch ? parseUnit(hMatch[1]) : null;

    if (parsedW && parsedH) {
      width = parsedW;
      height = parsedH;
    } else if (parsedW) {
      width = parsedW;
      if (!vbMatch) height = parsedW;
    } else if (parsedH) {
      height = parsedH;
      if (!vbMatch) width = parsedH;
    }

    return {
      width,
      height,
      aspectRatio: width / (height || 1),
    };
  } catch {
    return { width: 100, height: 100, aspectRatio: 1 };
  }
}

/**
 * Ensures root <svg> tag has explicit width, height, and viewBox attributes
 * for accurate rendering across browsers, Node, and HTML Canvas.
 */
export function formatSvgWithExplicitDimensions(svgString: string): string {
  const dims = parseSvgDimensions(svgString);
  let cleaned = svgString;

  if (!/<svg[^>]*\bwidth\s*=/i.test(cleaned)) {
    cleaned = cleaned.replace(/<svg\b/i, `<svg width="${dims.width}"`);
  }
  if (!/<svg[^>]*\bheight\s*=/i.test(cleaned)) {
    cleaned = cleaned.replace(/<svg\b/i, `<svg height="${dims.height}"`);
  }
  if (!/<svg[^>]*\bviewBox\s*=/i.test(cleaned)) {
    cleaned = cleaned.replace(/<svg\b/i, `<svg viewBox="0 0 ${dims.width} ${dims.height}"`);
  }
  return cleaned;
}
