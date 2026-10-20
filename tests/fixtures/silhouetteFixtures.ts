/**
 * Deterministic RGBA fixtures for silhouette / cutline tests.
 *
 * Everything here is generated in memory so the tests are reproducible and do
 * not depend on binary assets.
 */

export interface RgbaImage {
  data: Uint8ClampedArray;
  width: number;
  height: number;
}

export type AlphaFn = (x: number, y: number) => number;

export function makeImage(width: number, height: number, alpha: AlphaFn): RgbaImage {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      data[i] = 200;
      data[i + 1] = 40;
      data[i + 2] = 90;
      data[i + 3] = Math.max(0, Math.min(255, Math.round(alpha(x + 0.5, y + 0.5))));
    }
  }
  return { data, width, height };
}

export function circleAlpha(width: number, height: number, radiusRatio = 0.42): AlphaFn {
  const cx = width / 2;
  const cy = height / 2;
  const r = Math.min(width, height) * radiusRatio;
  return (x, y) => (Math.hypot(x - cx, y - cy) <= r ? 255 : 0);
}

export function antialiasedCircleAlpha(width: number, height: number, radiusRatio = 0.42): AlphaFn {
  const cx = width / 2;
  const cy = height / 2;
  const r = Math.min(width, height) * radiusRatio;
  return (x, y) => {
    const d = Math.hypot(x - cx, y - cy) - r;
    if (d < -1) return 255;
    if (d > 1) return 0;
    return (1 - (d + 1) / 2) * 255;
  };
}

/** Irregular die-cut perimeter: a shield with a pointed tail and scalloped rim. */
export function dieCutAlpha(width: number, height: number): AlphaFn {
  const cx = width / 2;
  const cy = height / 2;
  const rx = width * 0.42;
  const ry = height * 0.45;
  return (x, y) => {
    const nx = (x - cx) / rx;
    const ny = (y - cy) / ry;
    const angle = Math.atan2(ny, nx);
    const scallop = 1 + 0.02 * Math.cos(angle * 18);
    if (ny > 0) {
      const limit = (1 - 0.55 * Math.pow(ny, 2.2)) * scallop;
      return Math.abs(nx) <= limit && ny <= 1 ? 255 : 0;
    }
    return nx * nx + ny * ny <= scallop * scallop ? 255 : 0;
  };
}

/** Badge with internal transparent holes (letter counters / logo cut-outs). */
export function badgeWithHolesAlpha(width: number, height: number): AlphaFn {
  const base = circleAlpha(width, height);
  return (x, y) => {
    if (base(x, y) === 0) return 0;
    if (Math.hypot(x - width * 0.42, y - height * 0.45) < width * 0.055) return 0;
    if (Math.hypot(x - width * 0.58, y - height * 0.45) < width * 0.055) return 0;
    if (Math.abs(x - width / 2) < width * 0.075 && Math.abs(y - height * 0.62) < height * 0.02) return 0;
    return 255;
  };
}

/** Circle plus tiny isolated specks that must be discarded as noise. */
export function circleWithArtifactsAlpha(width: number, height: number): AlphaFn {
  const base = circleAlpha(width, height);
  const specks: Array<[number, number]> = [
    [width * 0.05, height * 0.05],
    [width * 0.95, height * 0.06],
    [width * 0.07, height * 0.94],
  ];
  return (x, y) => {
    if (base(x, y) === 255) return 255;
    for (const [sx, sy] of specks) {
      if (Math.hypot(x - sx, y - sy) < 2) return 255;
    }
    return 0;
  };
}

/** Circle plus legitimate detached decorative dots that must be preserved. */
export function circleWithDecorationsAlpha(width: number, height: number): AlphaFn {
  const base = circleAlpha(width, height);
  // Dots sit clear of the circle so they are genuinely disconnected components.
  const dots: Array<[number, number]> = [
    [width / 2, height * 0.02],
    [width * 0.97, height / 2],
    [width / 2, height * 0.98],
  ];
  return (x, y) => {
    if (base(x, y) === 255) return 255;
    for (const [sx, sy] of dots) {
      if (Math.hypot(x - sx, y - sy) < width * 0.03) return 255;
    }
    return 0;
  };
}

/** Deeply concave star-like silhouette. */
export function concaveStarAlpha(width: number, height: number): AlphaFn {
  const cx = width / 2;
  const cy = height / 2;
  return (x, y) => {
    const dx = x - cx;
    const dy = y - cy;
    const r = Math.hypot(dx, dy);
    const a = Math.atan2(dy, dx);
    const rr = Math.min(width, height) * 0.42 * (0.5 + 0.5 * Math.abs(Math.cos((a * 7) / 2)));
    return r <= rr ? 255 : 0;
  };
}

/** Comb with narrow 3px gaps: offsetting here risks self-intersection. */
export function narrowRegionsAlpha(width: number, height: number): AlphaFn {
  return (x, y) => {
    if (y < height * 0.2 || y > height * 0.8) return 0;
    if (x < width * 0.1 || x > width * 0.9) return 0;
    const band = Math.floor((x - width * 0.1) / 8);
    return band % 2 === 0 ? 255 : 0;
  };
}

/** High-resolution circle with a very long traced boundary. */
export function highResCircleAlpha(size = 2048): AlphaFn {
  return circleAlpha(size, size, 0.44);
}
