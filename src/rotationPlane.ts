type Vec3 = readonly [number, number, number];
export type RotationPlaneQuery = {
  /** Point-cloud boundary in world units. Triangle vertices suffice for a whole mesh versus a plane. */
  positions: Float64Array;
  pivot: Vec3;
  axis: Vec3;
  /** The clear half-space is dot(normal, point) + constant > 0. */
  plane: { normal: Vec3; constant: number };
  /** Positive rotation about axis, radians; at most one full revolution. */
  maxAngle: number;
};
export type RotationPlaneContact = {
  status: "initial-contact" | "contact" | "clear";
  angle: number | null;
  vertex: number | null;
  point: [number, number, number] | null;
  /** Signed distance at the returned vertex, in world units; includes roundoff. */
  distance: number | null;
  evaluatedVertices: number;
};
/** Exact sinusoidal point/plane trajectory, evaluated in double precision.
 * O(vertices), constant working memory, no angular sampling or mutable input.
 * A plane is not arbitrary terrain; this does not resolve impacts or fracture. */
export function firstRotationPlaneContact(
  q: RotationPlaneQuery,
): RotationPlaneContact {
  const vector = (v: unknown): v is Vec3 =>
    Array.isArray(v) &&
    v.length === 3 &&
    v.every((n) => Number.isFinite(n) && Math.abs(n) <= 1e8);
  if (
    !q ||
    !(q.positions instanceof Float64Array) ||
    q.positions.length < 3 ||
    q.positions.length % 3 ||
    q.positions.length > 300000 ||
    !vector(q.pivot) ||
    !vector(q.axis) ||
    !vector(q.plane?.normal) ||
    !Number.isFinite(q.plane.constant) ||
    Math.abs(q.plane.constant) > 1e8 ||
    !Number.isFinite(q.maxAngle) ||
    q.maxAngle < 0 ||
    q.maxAngle > 2 * Math.PI
  )
    throw Error("Invalid rotation-plane query");
  const axisLength = Math.hypot(...q.axis),
    normalLength = Math.hypot(...q.plane.normal);
  if (axisLength < 1e-12 || normalLength < 1e-12)
    throw Error("Degenerate rotation axis or plane");
  // Validate all vertices before returning even when the first vertex touches.
  for (const value of q.positions)
    if (!Number.isFinite(value) || Math.abs(value) > 1e8)
      throw Error("Invalid rotation-plane position");
  const k = q.axis.map((v) => v / axisLength),
    n = q.plane.normal.map((v) => v / normalLength),
    constant = q.plane.constant / normalLength;
  const dot = (a: readonly number[], b: readonly number[]) =>
    a[0]! * b[0]! + a[1]! * b[1]! + a[2]! * b[2]!;
  const nk = dot(n, k),
    base = dot(n, q.pivot) + constant,
    count = q.positions.length / 3;
  let angle = Infinity,
    vertex = -1,
    initialContact = false;
  const tau = 2 * Math.PI;
  const accept = (i: number, t: number) => {
    let theta = 2 * Math.atan(t);
    if (theta < 0) theta += tau;
    if (theta <= q.maxAngle && theta < angle) {
      angle = theta;
      vertex = i;
    }
  };
  for (let i = 0; i < count; i++) {
    const rx = q.positions[i * 3]! - q.pivot[0],
      ry = q.positions[i * 3 + 1]! - q.pivot[1],
      rz = q.positions[i * 3 + 2]! - q.pivot[2];
    const kr = k[0]! * rx + k[1]! * ry + k[2]! * rz;
    const a = n[0]! * rx + n[1]! * ry + n[2]! * rz - nk * kr,
      c = base + nk * kr;
    // Compute the initial distance directly, avoiding cancellation through the decomposition.
    const initial =
      n[0]! * q.positions[i * 3]! +
      n[1]! * q.positions[i * 3 + 1]! +
      n[2]! * q.positions[i * 3 + 2]! +
      constant;
    if (initial <= 0) {
      if (!initialContact) {
        angle = 0;
        vertex = i;
        initialContact = true;
      }
      continue;
    }
    if (initialContact) continue;
    const b =
      n[0]! * (k[1]! * rz - k[2]! * ry) +
      n[1]! * (k[2]! * rx - k[0]! * rz) +
      n[2]! * (k[0]! * ry - k[1]! * rx);
    const radius = Math.hypot(a, b);
    if (radius === 0 || Math.abs(c) > radius) continue;
    // Half-angle quadratic avoids subtracting nearly equal phase angles at
    // contact near zero. A*t²+B*t+C=0 with t=tan(theta/2).
    const A = c - a,
      B = 2 * b,
      C = initial;

    if (A === 0) {
      if (B !== 0) accept(i, -C / B);
      accept(i, Infinity); // theta=pi is the root omitted by finite tan(theta/2).
    } else {
      const discriminant = 4 * (radius - c) * (radius + c);
      if (discriminant < 0) continue;
      const qroot = -0.5 * (B + (B >= 0 ? 1 : -1) * Math.sqrt(discriminant));
      if (qroot === 0) accept(i, -B / (2 * A));
      else {
        accept(i, qroot / A);
        accept(i, C / qroot);
      }
    }
  }
  if (vertex < 0)
    return {
      status: "clear",
      angle: null,
      vertex: null,
      point: null,
      distance: null,
      evaluatedVertices: count,
    };
  const p = [
      q.positions[vertex * 3]!,
      q.positions[vertex * 3 + 1]!,
      q.positions[vertex * 3 + 2]!,
    ],
    r = p.map((v, i) => v - q.pivot[i]!),
    kr = dot(k, r),
    cos = Math.cos(angle),
    sin = Math.sin(angle);
  const cross = [
    k[1]! * r[2]! - k[2]! * r[1]!,
    k[2]! * r[0]! - k[0]! * r[2]!,
    k[0]! * r[1]! - k[1]! * r[0]!,
  ];
  const point = r.map(
    (v, i) => q.pivot[i]! + v * cos + cross[i]! * sin + k[i]! * kr * (1 - cos),
  ) as [number, number, number];
  return {
    status: initialContact ? "initial-contact" : "contact",
    angle,
    vertex,
    point,
    distance: dot(n, point) + constant,
    evaluatedVertices: count,
  };
}
