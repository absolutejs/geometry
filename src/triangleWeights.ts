type V = readonly [number, number, number];
const valid = (v: V) =>
  v &&
  v.length === 3 &&
  Number.isFinite(v[0]) &&
  Number.isFinite(v[1]) &&
  Number.isFinite(v[2]);
/** Prepare the immutable source triangle once when many descendant vertices share
 * its ancestry. Uses the same dominant-plane projection and seam gates as the
 * one-shot query; no source array is retained. */
export function prepareTriangleWeights(
  a: V,
  b: V,
  c: V,
  maximumPlaneDistance = 1e-7,
) {
  if (
    !Number.isFinite(maximumPlaneDistance) ||
    maximumPlaneDistance < 1e-7 ||
    maximumPlaneDistance > 1e-5
  )
    throw Error("Invalid surface projection precision");
  if (!valid(a) || !valid(b) || !valid(c))
    throw Error("Invalid interpolation point");
  const ax = a[0],
    ay = a[1],
    az = a[2];
  const u = [b[0] - ax, b[1] - ay, b[2] - az],
    v = [c[0] - ax, c[1] - ay, c[2] - az];
  const n = [
    u[1]! * v[2]! - u[2]! * v[1]!,
    u[2]! * v[0]! - u[0]! * v[2]!,
    u[0]! * v[1]! - u[1]! * v[0]!,
  ];
  const length = Math.hypot(...n);
  if (!Number.isFinite(length) || length < 1e-16)
    throw Error("Degenerate or unrepresentable interpolation triangle");
  const axis = n.reduce(
      (best, x, i) => (Math.abs(x) > Math.abs(n[best]!) ? i : best),
      0,
    ),
    i = (axis + 1) % 3,
    j = (axis + 2) % 3;
  const ui = u[i]!,
    uj = u[j]!,
    vi = v[i]!,
    vj = v[j]!,
    ni = n[i]!,
    nj = n[j]!,
    n0 = n[0]!,
    n1 = n[1]!,
    n2 = n[2]!;
  const denominator = ui * vj - uj * vi;
  if (!Number.isFinite(denominator) || denominator === 0)
    throw Error("Unrepresentable interpolation projection");
  return (p: V): [number, number, number] => {
    if (!valid(p)) throw Error("Invalid interpolation point");
    const d = [p[0] - ax, p[1] - ay, p[2] - az];
    const signed = (0 + n0 * d[0]! + n1 * d[1]! + n2 * d[2]!) / length;
    if (!Number.isFinite(signed))
      throw Error("Unrepresentable interpolation point");
    if (Math.abs(signed) > maximumPlaneDistance)
      throw Error("Interpolation point is off surface");
    const di = d[i]! - (ni * signed) / length,
      dj = d[j]! - (nj * signed) / length;
    const wb = (di * vj - dj * vi) / denominator,
      wc = (ui * dj - uj * di) / denominator,
      wa = 1 - wb - wc;
    if (!Number.isFinite(wa) || !Number.isFinite(wb) || !Number.isFinite(wc))
      throw Error("Unrepresentable interpolation weights");
    if (
      wa < -1e-4 ||
      wa > 1.0001 ||
      wb < -1e-4 ||
      wb > 1.0001 ||
      wc < -1e-4 ||
      wc > 1.0001
    )
      throw Error("Interpolation point is outside source triangle");
    const ca = Math.max(0, Math.min(1, wa)),
      cb = Math.max(0, Math.min(1, wb)),
      cc = Math.max(0, Math.min(1, wc)),
      sum = ca + cb + cc;
    return [ca / sum, cb / sum, cc / sum];
  };
}
/** One-shot barycentric interpolation. Prefer prepareTriangleWeights when a
 * source face is queried repeatedly. The rendered/physical vertex is not moved. */
export function triangleWeights(
  p: V,
  a: V,
  b: V,
  c: V,
  maximumPlaneDistance = 1e-7,
): [number, number, number] {
  return prepareTriangleWeights(a, b, c, maximumPlaneDistance)(p);
}
