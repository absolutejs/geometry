/** Diagonalize a symmetric positive inertia tensor without engine/Float32 rounding.
 * Tensor is row-major. Frame maps principal coordinates into input coordinates.
 * Bounds and reconstruction checks fail closed; this does not repair a tensor. */
export function principalInertiaFrame(tensor: readonly number[]) {
  if (
    !Array.isArray(tensor) ||
    tensor.length !== 9 ||
    !tensor.every(Number.isFinite)
  )
    throw Error("Invalid inertia tensor");
  const scale = Math.max(...tensor.map(Math.abs));
  if (!(scale > 0)) throw Error("Empty inertia tensor");
  const a = tensor.map((v) => v / scale);
  for (const [i, j] of [
    [0, 1],
    [0, 2],
    [1, 2],
  ] as const)
    if (Math.abs(a[i * 3 + j]! - a[j * 3 + i]!) > 1e-12)
      throw Error("Asymmetric inertia tensor");
  const vectors = [1, 0, 0, 0, 1, 0, 0, 0, 1];
  let sweeps = 0;
  for (; sweeps < 32; sweeps++) {
    if (Math.max(Math.abs(a[1]!), Math.abs(a[2]!), Math.abs(a[5]!)) < 1e-15)
      break;
    for (const [p, q] of [
      [0, 1],
      [0, 2],
      [1, 2],
    ] as const) {
      const off = a[p * 3 + q]!;
      if (Math.abs(off) < 1e-16) continue;
      const tau = (a[q * 3 + q]! - a[p * 3 + p]!) / (2 * off);
      const t = (tau >= 0 ? 1 : -1) / (Math.abs(tau) + Math.hypot(1, tau));
      const c = 1 / Math.hypot(1, t),
        s = t * c;
      a[p * 3 + p]! -= t * off;
      a[q * 3 + q]! += t * off;
      a[p * 3 + q] = a[q * 3 + p] = 0;
      for (let k = 0; k < 3; k++) {
        if (k !== p && k !== q) {
          const kp = a[k * 3 + p]!,
            kq = a[k * 3 + q]!;
          a[k * 3 + p] = a[p * 3 + k] = c * kp - s * kq;
          a[k * 3 + q] = a[q * 3 + k] = s * kp + c * kq;
        }
        const vp = vectors[k * 3 + p]!,
          vq = vectors[k * 3 + q]!;
        vectors[k * 3 + p] = c * vp - s * vq;
        vectors[k * 3 + q] = s * vp + c * vq;
      }
    }
  }
  const order = [0, 1, 2].sort(
    (i, j) => a[i * 3 + i]! - a[j * 3 + j]! || i - j,
  );
  const principal = order.map((i) => a[i * 3 + i]! * scale) as [
    number,
    number,
    number,
  ];
  if (
    !principal.every((v) => Number.isFinite(v) && v > 0) ||
    principal[0] + principal[1] < principal[2] - scale * 1e-12
  )
    throw Error("Nonphysical inertia tensor");
  const rotation = vectors.map(
    (_, i) => vectors[Math.floor(i / 3) * 3 + order[i % 3]!]!,
  );
  const det =
    rotation[0]! * (rotation[4]! * rotation[8]! - rotation[5]! * rotation[7]!) -
    rotation[1]! * (rotation[3]! * rotation[8]! - rotation[5]! * rotation[6]!) +
    rotation[2]! * (rotation[3]! * rotation[7]! - rotation[4]! * rotation[6]!);
  if (det < 0) for (let i = 0; i < 3; i++) rotation[i * 3 + 2]! *= -1;
  let error = 0;
  for (let i = 0; i < 3; i++)
    for (let j = 0; j < 3; j++) {
      const reconstructed = principal.reduce(
        (n, v, k) => n + rotation[i * 3 + k]! * v * rotation[j * 3 + k]!,
        0,
      );
      error = Math.max(
        error,
        Math.abs(reconstructed - tensor[i * 3 + j]!) / scale,
      );
    }
  if (!Number.isFinite(error) || error > 1e-12)
    throw Error("Inertia eigensystem did not converge");
  const m = rotation,
    trace = m[0]! + m[4]! + m[8]!;
  let x: number, y: number, z: number, w: number;
  if (trace > 0) {
    const s = 2 * Math.sqrt(trace + 1);
    w = s / 4;
    x = (m[7]! - m[5]!) / s;
    y = (m[2]! - m[6]!) / s;
    z = (m[3]! - m[1]!) / s;
  } else if (m[0]! > m[4]! && m[0]! > m[8]!) {
    const s = 2 * Math.sqrt(1 + m[0]! - m[4]! - m[8]!);
    w = (m[7]! - m[5]!) / s;
    x = s / 4;
    y = (m[1]! + m[3]!) / s;
    z = (m[2]! + m[6]!) / s;
  } else if (m[4]! > m[8]!) {
    const s = 2 * Math.sqrt(1 + m[4]! - m[0]! - m[8]!);
    w = (m[2]! - m[6]!) / s;
    x = (m[1]! + m[3]!) / s;
    y = s / 4;
    z = (m[5]! + m[7]!) / s;
  } else {
    const s = 2 * Math.sqrt(1 + m[8]! - m[0]! - m[4]!);
    w = (m[3]! - m[1]!) / s;
    x = (m[2]! + m[6]!) / s;
    y = (m[5]! + m[7]!) / s;
    z = s / 4;
  }
  const length = Math.hypot(x, y, z, w),
    sign = w < 0 ? -1 : 1;
  const frame = {
    x: (x / length) * sign,
    y: (y / length) * sign,
    z: (z / length) * sign,
    w: (w / length) * sign,
  };
  if (!Object.values(frame).every(Number.isFinite))
    throw Error("Invalid inertia frame");
  return { principal, frame, relativeReconstructionError: error, sweeps };
}
