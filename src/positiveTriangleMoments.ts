type V = readonly [number, number, number];
type M = [number, number, number];
/** Prepare an owned triangle for exact polynomial integration over the region
 * where a linearly interpolated scalar is positive. Query values are supplied
 * at its three vertices. Optional domain values additionally restrict integration
 * to their positive affine region. Order one integrates s and (x-reference)s;
 * order two integrates s², (x-reference)s² and s³, without sampling
 * or native geometry. Suitable for pressure/weighted-area calculations; no
 * coefficient, exposure, force or time integrator is inferred. */
type SurfaceMoments = {
  area: number;
  fullArea: number;
  integral: number;
  relativeFirstMoment: M;
  meanOffset: M | null;
  reference: M;
  surfaceNormal: M;
};
type Query<T> = (
  values: readonly number[],
  domainValues?: readonly number[],
) => T;
export function preparePositiveTriangleMoments(
  input: readonly V[],
  order: 1,
): Query<SurfaceMoments>;
export function preparePositiveTriangleMoments(
  input: readonly V[],
  order: 2,
): Query<SurfaceMoments & { cubicIntegral: number }>;
export function preparePositiveTriangleMoments(
  input: readonly V[],
  order: 1 | 2,
) {
  if (
    input.length !== 3 ||
    !input.every((v) => v.length === 3 && v.every(Number.isFinite))
  )
    throw Error("Invalid positive-field triangle");
  const reference = [...input[0]!] as M;
  const u = input[1]!.map((v, k) => v - reference[k]!) as M;
  const v = input[2]!.map((x, k) => x - reference[k]!) as M;
  const scale = Math.max(...u.map(Math.abs), ...v.map(Math.abs));
  if (!(scale > 0) || !Number.isFinite(scale))
    throw Error("Unrepresentable positive-field triangle extent");
  const a = u.map((x) => x / scale),
    b = v.map((x) => x / scale);
  const cross = [
    a[1]! * b[2]! - a[2]! * b[1]!,
    a[2]! * b[0]! - a[0]! * b[2]!,
    a[0]! * b[1]! - a[1]! * b[0]!,
  ];
  const length = Math.hypot(...cross),
    fullArea = length * 0.5 * scale * scale;
  if (!(fullArea > 0) || !Number.isFinite(fullArea))
    throw Error("Degenerate or unrepresentable positive-field triangle");
  const surfaceNormal = cross.map((x) => x / length) as M;
  const corners: readonly (readonly [number, number])[] = [
    [0, 0],
    [1, 0],
    [0, 1],
  ];
  return (values: readonly number[], domainValues?: readonly number[]) => {
    if (values.length !== 3 || !values.every(Number.isFinite))
      throw Error("Invalid triangle scalar values");
    if (
      domainValues &&
      (domainValues.length !== 3 || !domainValues.every(Number.isFinite))
    )
      throw Error("Invalid triangle domain values");
    const domainScale = domainValues
      ? Math.max(...domainValues.map(Math.abs))
      : 1;
    const k = Math.max(...values.map(Math.abs));
    // Exactly opposite affine values have no positive-area common domain.
    // This is an exact input identity, never an epsilon or small-volume cutoff.
    const opposed =
      domainValues !== undefined &&
      domainValues[0] === -values[0]! &&
      domainValues[1] === -values[1]! &&
      domainValues[2] === -values[2]!;
    let area = 0,
      integrated = 0,
      cubic = 0;
    const first: M = [0, 0, 0];
    const integratePiece = (
      pieceArea: number,
      s0: number,
      s1: number,
      s2: number,
      p: readonly [number, number],
      q: readonly [number, number],
      r: readonly [number, number],
    ) => {
      if (order === 1) integrated += (pieceArea * (s0 + s1 + s2)) / 3;
      else {
        integrated +=
          (pieceArea *
            (s0 * s0 + s1 * s1 + s2 * s2 + s0 * s1 + s1 * s2 + s2 * s0)) /
          6;
        cubic +=
          (pieceArea *
            (s0 ** 3 +
              s1 ** 3 +
              s2 ** 3 +
              s0 * s0 * (s1 + s2) +
              s1 * s1 * (s0 + s2) +
              s2 * s2 * (s0 + s1) +
              s0 * s1 * s2)) /
          10;
      }
      let w0: number, w1: number, w2: number;
      if (order === 1) {
        w0 = (pieceArea * (2 * s0 + s1 + s2)) / 12;
        w1 = (pieceArea * (2 * s1 + s2 + s0)) / 12;
        w2 = (pieceArea * (2 * s2 + s0 + s1)) / 12;
      } else {
        w0 = (pieceArea * (3 * s0 * s0 + s1 * s1 + s2 * s2 + 2 * s0 * (s1 + s2) + s1 * s2)) / 30;
        w1 = (pieceArea * (3 * s1 * s1 + s2 * s2 + s0 * s0 + 2 * s1 * (s2 + s0) + s2 * s0)) / 30;
        w2 = (pieceArea * (3 * s2 * s2 + s0 * s0 + s1 * s1 + 2 * s2 * (s0 + s1) + s0 * s1)) / 30;
      }
      for (let d = 0; d < 3; d++) {
        first[d]! += w0 * (u[d]! * p[0] + v[d]! * p[1]);
        first[d]! += w1 * (u[d]! * q[0] + v[d]! * q[1]);
        first[d]! += w2 * (u[d]! * r[0] + v[d]! * r[1]);
      }
      area += pieceArea;
    };
    // Entire positive domain: use the same integrator without clipping polygons.
    if (
      !opposed &&
      k > 0 &&
      values.every((s) => s >= 0) &&
      (!domainValues || (domainScale > 0 && domainValues.every((d) => d >= 0)))
    ) {
      integratePiece(
        fullArea,
        values[0]! / k,
        values[1]! / k,
        values[2]! / k,
        corners[0]!,
        corners[1]!,
        corners[2]!,
      );
    } else if (!opposed && k > 0 && values.some((s) => s > 0)) {
      type Node = { p: [number, number]; s: number; d: number };
      let polygon: Node[] = [
        {
          p: [0, 0],
          s: values[0]! / k,
          d: domainValues
            ? domainScale
              ? domainValues[0]! / domainScale
              : 0
            : 1,
        },
        {
          p: [1, 0],
          s: values[1]! / k,
          d: domainValues
            ? domainScale
              ? domainValues[1]! / domainScale
              : 0
            : 1,
        },
        {
          p: [0, 1],
          s: values[2]! / k,
          d: domainValues
            ? domainScale
              ? domainValues[2]! / domainScale
              : 0
            : 1,
        },
      ];
      for (const field of (domainValues ? ["d", "s"] : ["s"]) as (
        "d" | "s"
      )[]) {
        if (!polygon.some((n) => n[field] > 0)) {
          polygon = [];
          break;
        }
        const clipped: Node[] = [];
        for (let i = 0; i < polygon.length; i++) {
          const left = polygon[(i + polygon.length - 1) % polygon.length]!,
            right = polygon[i]!;
          if (left[field] >= 0 !== right[field] >= 0) {
            const t = left[field] / (left[field] - right[field]);
            const node: Node = {
              p: [
                left.p[0] + (right.p[0] - left.p[0]) * t,
                left.p[1] + (right.p[1] - left.p[1]) * t,
              ],
              s: left.s + (right.s - left.s) * t,
              d: left.d + (right.d - left.d) * t,
            };
            node[field] = 0;
            clipped.push(node);
          }
          if (right[field] >= 0) clipped.push(right);
        }
        polygon = clipped;
      }
      for (let i = 1; i + 1 < polygon.length; i++) {
        const nodes = [polygon[0]!, polygon[i]!, polygon[i + 1]!];
        const [p, q, r] = nodes.map((n) => n.p);
        const fraction =
          (q![0] - p![0]) * (r![1] - p![1]) - (q![1] - p![1]) * (r![0] - p![0]);
        if (fraction < 0 || !Number.isFinite(fraction))
          throw Error("Inconsistent positive triangle orientation");
        if (fraction === 0) continue;
        const pieceArea = fullArea * fraction,
          s = nodes.map((n) => n.s);
        const [s0, s1, s2] = s as M;
        integratePiece(pieceArea, s0, s1, s2, p!, q!, r!);
      }
    }
    const integral = order === 1 ? integrated * k : integrated * k * k,
      cubicIntegral = cubic * k * k * k;
    const relativeFirstMoment = (order === 1
      ? first.map((x) => x * k)
      : first.map((x) => x * k * k)) as M;
    const meanOffset =
      integrated > 0 ? (first.map((x) => x / integrated) as M) : null;
    if (
      ![
        area,
        integral,
        cubicIntegral,
        ...relativeFirstMoment,
        ...(meanOffset ?? []),
      ].every(Number.isFinite) ||
      (integrated > 0 && integral === 0) ||
      (first[0] !== 0 && relativeFirstMoment[0] === 0) ||
      (first[1] !== 0 && relativeFirstMoment[1] === 0) ||
      (first[2] !== 0 && relativeFirstMoment[2] === 0) ||
      (cubic > 0 && cubicIntegral === 0) ||
      area > fullArea * (1 + 1e-12)
    )
      throw Error("Unrepresentable positive field moments");
    if (order === 1)
      return {
        area,
        fullArea,
        integral,
        relativeFirstMoment,
        meanOffset,
        reference: [...reference] as M,
        surfaceNormal: [...surfaceNormal] as M,
      };
    return {
      area,
      fullArea,
      integral,
      cubicIntegral,
      relativeFirstMoment,
      meanOffset,
      reference: [...reference] as M,
      surfaceNormal: [...surfaceNormal] as M,
    };
  };
}
