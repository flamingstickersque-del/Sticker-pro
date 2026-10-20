import { describe, expect, it } from 'vitest';
import paper from 'paper';
import {
  generateContourSvgPath,
  countPolygonSelfIntersections,
  validateContourEnclosure,
  analyzeContourTopology,
  detectPerfectCircle,
  offsetPolygon,
  simplifyClosedPolygon,
  removeCollinearVertices,
  dedupePolygon,
  signedArea,
  parseSvgDimensions,
  formatSvgWithExplicitDimensions,
  type Point2D,
} from '../src/services/contourEngine';
import {
  extractSilhouetteFromImageData,
  fitSilhouetteToBox,
} from '../src/services/silhouetteExtractor';
import {
  makeImage,
  circleAlpha,
  antialiasedCircleAlpha,
  dieCutAlpha,
  badgeWithHolesAlpha,
  circleWithArtifactsAlpha,
  circleWithDecorationsAlpha,
  concaveStarAlpha,
  narrowRegionsAlpha,
  highResCircleAlpha,
} from './fixtures/silhouetteFixtures';

const SIZE = 400;
const STICKER_MM = 76.2; // exact 3.00 inches

interface PathMetrics {
  width: number;
  height: number;
  segments: number;
  closed: boolean;
  subPaths: number;
  hasCurves: boolean;
}

function measurePath(d: string): PathMetrics {
  const scope = new paper.PaperScope();
  scope.setup(new scope.Size(1000, 1000));
  const path = new scope.Path(d);
  return {
    width: path.bounds.width,
    height: path.bounds.height,
    segments: path.segments.length,
    closed: path.closed,
    subPaths: path.children ? path.children.length : 1,
    hasCurves: /[CQ]/.test(d),
  };
}

function silhouetteOf(alpha: (x: number, y: number) => number, size = SIZE): Point2D[] {
  const img = makeImage(size, size, alpha);
  const result = extractSilhouetteFromImageData(img.data, img.width, img.height, {
    physicalSizeMm: STICKER_MM,
  });
  return fitSilhouetteToBox(result.points);
}

function cutPathFor(perimeter: Point2D[], offsetMm = 2, smoothing = 0.35): string {
  return generateContourSvgPath(
    STICKER_MM,
    STICKER_MM,
    { enabled: true, offsetMm, smoothing, cornerStyle: 'round', miterLimit: 2.5 },
    perimeter
  );
}

function polygonOf(perimeter: Point2D[], scale = STICKER_MM): Point2D[] {
  return perimeter.map((p) => ({ x: p.x * scale, y: p.y * scale }));
}

describe('silhouette extraction', () => {
  it('1. extracts a clean circular silhouette', () => {
    const perimeter = silhouetteOf(circleAlpha(SIZE, SIZE));
    expect(perimeter.length).toBeGreaterThan(8);

    const circle = detectPerfectCircle(polygonOf(perimeter), 0.03);
    expect(circle).not.toBeNull();
    expect(circle!.radiusMm).toBeCloseTo(STICKER_MM / 2, 1);
  });

  it('2. follows an irregular die-cut perimeter', () => {
    const perimeter = silhouetteOf(dieCutAlpha(SIZE, SIZE));
    expect(perimeter.length).toBeGreaterThan(20);

    const path = cutPathFor(perimeter);
    const metrics = measurePath(path);
    expect(metrics.closed).toBe(true);
    expect(metrics.subPaths).toBe(1);
    // The shield is taller than it is wide, and the cutline must reflect that.
    expect(metrics.height).toBeGreaterThan(metrics.width);
  });

  it('3. ignores internal transparent holes and text counters', () => {
    const perimeter = silhouetteOf(badgeWithHolesAlpha(SIZE, SIZE));
    const path = cutPathFor(perimeter);
    const metrics = measurePath(path);

    expect(metrics.subPaths).toBe(1);
    expect(metrics.closed).toBe(true);
    // A single outer loop: no internal knife paths were emitted.
    expect((path.match(/M/gi) || []).length).toBe(1);
  });

  it('4. handles antialiased and partially transparent edges', () => {
    const perimeter = silhouetteOf(antialiasedCircleAlpha(SIZE, SIZE));
    expect(perimeter.length).toBeGreaterThan(8);

    const path = cutPathFor(perimeter);
    const metrics = measurePath(path);
    expect(metrics.closed).toBe(true);
    expect(metrics.width).toBeCloseTo(STICKER_MM + 4, 1);
  });

  it('5. discards small isolated background-removal artifacts', () => {
    const img = makeImage(SIZE, SIZE, circleWithArtifactsAlpha(SIZE, SIZE));
    const result = extractSilhouetteFromImageData(img.data, img.width, img.height, {
      physicalSizeMm: STICKER_MM,
    });

    expect(result.diagnostics.componentCount).toBeGreaterThan(1);
    expect(result.diagnostics.droppedComponentCount).toBeGreaterThan(0);
    expect(result.diagnostics.keptComponentCount).toBe(1);
    expect(result.diagnostics.warnings.join(' ')).toMatch(/artifact/i);

    const path = cutPathFor(fitSilhouetteToBox(result.points));
    expect(measurePath(path).subPaths).toBe(1);
  });

  it('6. preserves legitimate disconnected decorative components', () => {
    const img = makeImage(SIZE, SIZE, circleWithDecorationsAlpha(SIZE, SIZE));
    const result = extractSilhouetteFromImageData(img.data, img.width, img.height, {
      physicalSizeMm: STICKER_MM,
    });

    expect(result.diagnostics.keptComponentCount).toBeGreaterThan(1);
    expect(result.diagnostics.droppedComponentCount).toBe(0);
    expect(result.diagnostics.warnings.join(' ')).toMatch(/disconnected/i);

    // Bridged into exactly one continuous loop.
    const path = cutPathFor(fitSilhouetteToBox(result.points));
    const metrics = measurePath(path);
    expect(metrics.subPaths).toBe(1);
    expect(metrics.closed).toBe(true);
  });

  it('7. handles a complex concave silhouette', () => {
    const perimeter = silhouetteOf(concaveStarAlpha(SIZE, SIZE));
    const path = cutPathFor(perimeter);
    const metrics = measurePath(path);

    expect(metrics.closed).toBe(true);
    expect(metrics.subPaths).toBe(1);
    expect(metrics.segments).toBeGreaterThan(20);
  });

  it('8. offsets narrow regions without self-intersection', () => {
    const perimeter = silhouetteOf(narrowRegionsAlpha(SIZE, SIZE));
    const polygon = polygonOf(perimeter);

    for (const offset of [0.5, 1.0, 2.0]) {
      const offsetPoly = offsetPolygon(polygon, offset, 'round', 2.5);
      expect(countPolygonSelfIntersections(offsetPoly)).toBe(0);

      const path = cutPathFor(perimeter, offset);
      expect(measurePath(path).closed).toBe(true);
    }
  });

  it('12. handles a high-resolution image with many contour points', () => {
    const perimeter = silhouetteOf(highResCircleAlpha(2048), 2048);
    expect(perimeter.length).toBeGreaterThan(50);

    const path = cutPathFor(perimeter);
    const metrics = measurePath(path);
    expect(metrics.closed).toBe(true);
    expect(metrics.width).toBeCloseTo(STICKER_MM + 4, 1);
  });
});

describe('cutline geometry', () => {
  it('produces one continuous closed loop with no duplicate or zero-length segments', () => {
    const perimeter = silhouetteOf(dieCutAlpha(SIZE, SIZE));
    const path = cutPathFor(perimeter);

    expect(/Z$/.test(path)).toBe(true);
    expect((path.match(/M/gi) || []).length).toBe(1);

    const topology = analyzeContourTopology(polygonOf(perimeter));
    expect(topology.selfIntersections).toBe(0);
    expect(topology.minSegmentLengthMm).toBeGreaterThan(0);
  });

  it('contains no self-intersections after offsetting', () => {
    const perimeter = silhouetteOf(concaveStarAlpha(SIZE, SIZE));
    const polygon = polygonOf(perimeter);

    for (const offset of [0, 0.8, 2, 3.5]) {
      const offsetPoly = offsetPolygon(polygon, offset, 'round', 2.5);
      expect(countPolygonSelfIntersections(offsetPoly)).toBe(0);
    }
  });

  it('applies the configured offset consistently around the sticker', () => {
    const perimeter = silhouetteOf(circleAlpha(SIZE, SIZE));

    for (const offset of [0, 0.8, 2, 3.5]) {
      const path = cutPathFor(perimeter, offset);
      const metrics = measurePath(path);

      // A uniform offset grows the shape equally in both axes.
      expect(metrics.width).toBeCloseTo(STICKER_MM + offset * 2, 1);
      expect(metrics.height).toBeCloseTo(STICKER_MM + offset * 2, 1);
      expect(Math.abs(metrics.width - metrics.height)).toBeLessThan(0.05);
    }
  });

  it('keeps the cutline enclosing the artwork silhouette', () => {
    const perimeter = silhouetteOf(dieCutAlpha(SIZE, SIZE));
    const polygon = polygonOf(perimeter);
    const path = cutPathFor(perimeter, 2);

    const validation = validateContourEnclosure(path, polygon, 0.05);
    expect(validation.isValid).toBe(true);
    expect(validation.isClosed).toBe(true);
    expect(validation.pointsOutsideCount).toBe(0);
  });

  it('never emits internal cut paths', () => {
    const perimeter = silhouetteOf(badgeWithHolesAlpha(SIZE, SIZE));
    const path = cutPathFor(perimeter, 2);
    expect((path.match(/M/gi) || []).length).toBe(1);
  });
});

describe('physical dimensions', () => {
  it('10. honours the exact 3-inch total-size preset', () => {
    const perimeter = silhouetteOf(circleAlpha(SIZE, SIZE));

    for (const offset of [0, 0.8, 2, 3.5]) {
      const path = cutPathFor(perimeter, offset);
      const metrics = measurePath(path);
      const expected = STICKER_MM + offset * 2;

      expect(metrics.width).toBeCloseTo(expected, 1);
      expect(metrics.height).toBeCloseTo(expected, 1);
      // 3 inches == 76.2 mm
      expect(metrics.width / 25.4).toBeCloseTo(3 + (offset * 2) / 25.4, 2);
    }
  });

  it('keeps the artwork aspect ratio when the silhouette is not square', () => {
    const perimeter = silhouetteOf(dieCutAlpha(SIZE, SIZE));
    const path = cutPathFor(perimeter, 2);
    const metrics = measurePath(path);

    // Uniform scaling: the dominant axis hits the target, the other stays inside.
    expect(Math.max(metrics.width, metrics.height)).toBeCloseTo(STICKER_MM + 4, 1);
    expect(Math.min(metrics.width, metrics.height)).toBeLessThanOrEqual(STICKER_MM + 4 + 0.01);
  });

  it('is deterministic across repeated generation', () => {
    const perimeter = silhouetteOf(dieCutAlpha(SIZE, SIZE));
    const first = cutPathFor(perimeter, 2);
    const second = cutPathFor(perimeter, 2);
    expect(second).toBe(first);
  });

  it('9. regenerating the cutline never accumulates duplicate paths', () => {
    const perimeter = silhouetteOf(dieCutAlpha(SIZE, SIZE));

    let path = '';
    for (let i = 0; i < 5; i++) {
      path = cutPathFor(perimeter, 2);
    }

    expect((path.match(/M/gi) || []).length).toBe(1);
    expect((path.match(/Z/gi) || []).length).toBe(1);
  });
});

describe('geometry helpers', () => {
  it('simplifies a closed ring without leaving a degenerate closing vertex', () => {
    // A square whose closing vertex sits on the closing edge — the exact shape
    // boundary tracing produces, and the case plain RDP cannot clean up.
    const ring: Point2D[] = [
      { x: -10, y: -10 },
      { x: 10, y: -10 },
      { x: 10, y: 10 },
      { x: -10, y: 10 },
      { x: -10, y: -9.9 },
    ];

    const simplified = simplifyClosedPolygon(ring, 0.5);
    expect(simplified.length).toBe(4);

    const offset = offsetPolygon(simplified, 2, 'round', 2.5);
    const xs = offset.map((p) => p.x);
    const ys = offset.map((p) => p.y);
    expect(Math.max(...xs) - Math.min(...xs)).toBeCloseTo(24, 1);
    expect(Math.max(...ys) - Math.min(...ys)).toBeCloseTo(24, 1);
  });

  it('removes collinear vertices', () => {
    const pts: Point2D[] = [
      { x: 0, y: 0 },
      { x: 5, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
      { x: 0, y: 10 },
    ];
    expect(removeCollinearVertices(pts, 0.01).length).toBe(4);
  });

  it('dedupes near-identical vertices', () => {
    const pts: Point2D[] = [
      { x: 0, y: 0 },
      { x: 0.0001, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
    ];
    expect(dedupePolygon(pts, 0.01).length).toBe(3);
  });

  it('computes clockwise winding for screen coordinates', () => {
    const cw: Point2D[] = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
      { x: 0, y: 10 },
    ];
    expect(signedArea(cw)).toBeGreaterThan(0);
  });

  it('returns an empty path when the contour is disabled', () => {
    const path = generateContourSvgPath(
      STICKER_MM,
      STICKER_MM,
      { enabled: false, offsetMm: 2, smoothing: 0.35 },
      silhouetteOf(circleAlpha(SIZE, SIZE))
    );
    expect(path).toBe('');
  });
});

describe('SVG artwork', () => {
  it('11. parses SVG dimensions and normalises the root element', () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 100"><rect width="200" height="100"/></svg>';
    const dims = parseSvgDimensions(svg);
    expect(dims.width).toBe(200);
    expect(dims.height).toBe(100);
    expect(dims.aspectRatio).toBeCloseTo(2, 5);

    const formatted = formatSvgWithExplicitDimensions(svg);
    expect(formatted).toMatch(/width="200"/);
    expect(formatted).toMatch(/height="100"/);
    expect(formatted).toMatch(/viewBox="0 0 200 100"/);
  });

  it('11b. honours physical units in SVG dimensions', () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="3in" height="2in"></svg>';
    const dims = parseSvgDimensions(svg);
    expect(dims.width).toBeCloseTo(288, 0); // 3in @ 96dpi
    expect(dims.height).toBeCloseTo(192, 0);
  });

  it('11c. generates a valid cutline for an SVG-derived silhouette', () => {
    // A star silhouette as an SVG would render it.
    const perimeter: Point2D[] = [];
    const spikes = 5;
    for (let i = 0; i < 120; i++) {
      const a = (i / 120) * Math.PI * 2;
      const r = 0.45 * (0.55 + 0.45 * Math.abs(Math.cos((a * spikes) / 2)));
      perimeter.push({ x: Math.cos(a) * r, y: Math.sin(a) * r });
    }

    const path = cutPathFor(perimeter, 2);
    const metrics = measurePath(path);
    expect(metrics.closed).toBe(true);
    expect(metrics.subPaths).toBe(1);
    expect(Math.max(metrics.width, metrics.height)).toBeCloseTo(STICKER_MM + 4, 1);
  });
});
