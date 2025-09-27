// fast-trig.ts
// Single-file TypeScript library for fast sin/cos using Cody–Waite reduction,
// fdlibm-grade minimax kernels, and Estrin-style evaluation.

// Public API:
//   - fastSin(x: number): number
//   - fastCos(x: number): number
//   - fastSinCos(x: number): { sin: number; cos: number }
//
// Notes:
//   - Targets double precision (JS number), valid for typical finite inputs.
//   - Uses fdlibm constants for robust argument reduction.
//   - For NaN/Inf inputs, returns NaN like Math.sin/Math.cos would.

// ===== Constants (from fdlibm) =====

// 53-bit 2/pi
const INV_PIO2 = 6.36619772367581382433e-01; // invpio2
// Split pi/2 = PIO2_1 + PIO2_2 + PIO2_3 (+ tiny tails in fdlibm)
const PIO2_1  = 1.57079632673412561417e+00;
const PIO2_2  = 6.07710050630396597660e-11;
const PIO2_3  = 2.02226624871116645580e-21;

// fdlibm minimax kernel coefficients for sin on [-pi/4, pi/4]
// sin(x) ≈ x + v*(S1 + z*(S2 + z*(S3 + z*(S4 + z*(S5 + z*S6)))))
// where z = x*x, v = z*x
const S1 = -1.66666666666666324348e-01;
const S2 =  8.33333333332248946124e-03;
const S3 = -1.98412698298579493134e-04;
const S4 =  2.75573137070700676789e-06;
const S5 = -2.50507602534068634195e-08;
const S6 =  1.58969099521155010221e-10;

// fdlibm minimax kernel coefficients for cos on [-pi/4, pi/4]
// cos(x) ≈ 1 - 0.5*z + z*(C1 + z*(C2 + z*(C3 + z*(C4 + z*(C5 + z*C6)))))
// where z = x*x
const C1 =  4.16666666666666019037e-02;
const C2 = -1.38888888888741095749e-03;
const C3 =  2.48015872894767294178e-05;
const C4 = -2.75573143513906633035e-07;
const C5 =  2.08757232129817482790e-09;
const C6 = -1.13596475577881948265e-11;

// ===== Helpers =====

function isNotFinite(x: number): boolean {
  // Handle NaN and infinities in a JS-friendly way
  return !Number.isFinite(x);
}

// Cody–Waite style reduction to r in [-pi/4, pi/4] and quadrant n (mod 4).
// Uses 53-bit 2/pi and split pi/2 components for low-error subtraction.
function reduceToQuarterPi(x: number): { r: number; n: number } {
  // Nearest integer multiple of pi/2
  // n = round(x * 2/pi)
  const n = Math.round(x * INV_PIO2);
  // r = x - n * (PIO2_1 + PIO2_2 + PIO2_3), using cascaded subtraction
  // to limit cancellation and preserve low bits of the remainder.
  let r = x - n * PIO2_1;
  r = r - n * PIO2_2;
  r = r - n * PIO2_3;
  // n modulo 4 picks the octant mapping for sin/cos
  return { r, n: n & 3 };
}

// Estrin-style evaluation of sine kernel on reduced argument r.
// Mirrors fdlibm structure but groups terms to shorten dependency chains.
function kernelSin(r: number): number {
  const z = r * r;
  const v = z * r;

  // Estrin grouping for r-polynomial: S2 + z*(S3 + z*S4) + z^2*(S5 + z*S6)
  const z2 = z * z;
  const t0 = S3 + z * S4;
  const t1 = S5 + z * S6;
  const rpoly = S2 + z * t0 + z2 * t1;

  return r + v * (S1 + z * rpoly);
}

// Estrin-style evaluation of cosine kernel on reduced argument r.
function kernelCos(r: number): number {
  const z = r * r;

  // Estrin grouping: C1 + z*(C2 + z*C3) + z^2*(C4 + z*(C5 + z*C6))
  const z2 = z * z;
  const p0 = C2 + z * C3;
  const p1 = C5 + z * C6;
  const rpoly = C1 + z * p0 + z2 * (C4 + z * p1);

  return 1 - 0.5 * z + z * rpoly;
}

// Map kernels through quadrant to produce sin and cos simultaneously.
function finalizeSinCos(r: number, n: number): { sin: number; cos: number } {
  // Compute both kernels once
  const s = kernelSin(r);
  const c = kernelCos(r);

  // Quadrant mapping (n = k mod 4 from reduction)
  // n=0:  sin=+s, cos=+c
  // n=1:  sin=+c, cos=-s
  // n=2:  sin=-s, cos=-c
  // n=3:  sin=-c, cos=+s
  switch (n) {
    case 0: return { sin:  s, cos:  c };
    case 1: return { sin:  c, cos: -s };
    case 2: return { sin: -s, cos: -c };
    default: return { sin: -c, cos:  s };
  }
}

// ===== Public API =====

export function fastSin(x: number): number {
  if (isNotFinite(x)) return NaN;
  const { r, n } = reduceToQuarterPi(x);
  return finalizeSinCos(r, n).sin;
}

export function fastCos(x: number): number {
  if (isNotFinite(x)) return NaN;
  const { r, n } = reduceToQuarterPi(x);
  return finalizeSinCos(r, n).cos;
}

export function fastSinCos(x: number): { sin: number; cos: number } {
  if (isNotFinite(x)) return { sin: NaN, cos: NaN };
  const { r, n } = reduceToQuarterPi(x);
  return finalizeSinCos(r, n);
}
