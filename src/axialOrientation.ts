export type WeightedAxis = {
  axis: readonly [number, number, number];
  weight: number;
};
/** Second orientation moment, Q = sum(w * u*u^T) / sum(w).
 * Axes are unoriented: u and -u contribute identically. Row-major Float64 output
 * is symmetric, positive semidefinite, trace one. No preferred direction is
 * invented for isotropic or competing orientations. This is not a strength law.
 * Work is bounded to 4096 samples. Inputs are borrowed and never changed. */
export function axialOrientationTensor(samples: readonly WeightedAxis[]): Float64Array {
  if (!Array.isArray(samples) || samples.length < 1 || samples.length > 4096)
    throw Error('Invalid orientation sample count');
  let maximum = 0;
  for (const sample of samples) {
    if (!sample || !Number.isFinite(sample.weight) || sample.weight < 0 ||
        !Array.isArray(sample.axis) || sample.axis.length !== 3 ||
        !sample.axis.every(Number.isFinite) || !sample.axis.some((v: number) => v !== 0))
      throw Error('Invalid weighted axis');
    maximum = Math.max(maximum, sample.weight);
  }
  if (!maximum) throw Error('Empty orientation weight');
  // Scale weights and vectors independently before accumulating: neither their
  // absolute units nor a finite input near Number.MAX_VALUE should overflow.
  const sums = new Float64Array(7), corrections = new Float64Array(7);
  const add = (i: number, value: number) => {
    const prior = sums[i]!, next = prior + value;
    corrections[i]! += Math.abs(prior) >= Math.abs(value)
      ? (prior - next) + value : (value - next) + prior;
    sums[i] = next;
  };
  for (const {axis, weight} of samples) {
    if (!weight) continue;
    const scale = Math.max(...axis.map(Math.abs));
    const v = axis.map((n: number) => n / scale), length = Math.hypot(...v);
    const x = v[0]! / length, y = v[1]! / length, z = v[2]! / length;
    const w = weight / maximum;
    add(0, w*x*x); add(1, w*x*y); add(2, w*x*z);
    add(3, w*y*y); add(4, w*y*z); add(5, w*z*z); add(6, w);
  }
  const total = sums[6]! + corrections[6]!;
  const q = Array.from({length:6}, (_, i) => (sums[i]! + corrections[i]!) / total);
  return new Float64Array([q[0]!,q[1]!,q[2]!,q[1]!,q[3]!,q[4]!,q[2]!,q[4]!,q[5]!]);
}
