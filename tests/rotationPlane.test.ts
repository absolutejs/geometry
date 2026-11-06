import { expect, test } from "bun:test";
import {
  firstRotationPlaneContact,
  type RotationPlaneQuery,
} from "../src/rotationPlane";
const query = (points: number[]): RotationPlaneQuery => ({
  positions: Float64Array.from(points),
  pivot: [0, 0, 0],
  axis: [0, 0, 1],
  plane: { normal: [0, 1, 0], constant: 0 },
  maxAngle: 2 * Math.PI,
});
test("analytic circle intersections return first positive root and earliest vertex", () => {
  const q = query([0, 2, 0, 1, 1, 0, -1, 1, 0]);
  const result = firstRotationPlaneContact(q);
  expect(result.status).toBe("contact");
  expect(result.vertex).toBe(2);
  expect(result.angle).toBeCloseTo(Math.PI / 4, 14);
  expect(result.distance!).toBeCloseTo(0, 14);
  expect(firstRotationPlaneContact({ ...q, maxAngle: 0.7 }).status).toBe(
    "clear",
  );
  expect(result.evaluatedVertices).toBe(3);
});
test("touch, tangency, stationary axis and empty sweep are explicit", () => {
  expect(firstRotationPlaneContact(query([0, 0, 0])).status).toBe(
    "initial-contact",
  );
  expect(firstRotationPlaneContact(query([0, -1, 0])).status).toBe(
    "initial-contact",
  );
  const q = { ...query([0, 2, 0]), pivot: [0, 1, 0] as const };
  expect(firstRotationPlaneContact(q).angle).toBeCloseTo(Math.PI, 14);
  expect(
    firstRotationPlaneContact({
      ...q,
      plane: { normal: [0, 1, 0], constant: 1 },
    }).status,
  ).toBe("clear");
  expect(
    firstRotationPlaneContact({ ...query([0, 2, 0]), axis: [0, 1, 0] }).status,
  ).toBe("clear");
  expect(
    firstRotationPlaneContact({ ...query([0, 2, 0]), maxAngle: 0 }).status,
  ).toBe("clear");
});
test("normal/axis scaling and translated scene preserve the same rotation", () => {
  const q = query([-2, 3, 1]),
    reference = firstRotationPlaneContact(q);
  const translated = {
    ...q,
    positions: Float64Array.from([1232, -565, 19]),
    pivot: [1234, -568, 18] as const,
    axis: [0, 0, 10] as const,
    plane: { normal: [0, 17, 0] as const, constant: 568 * 17 },
  };
  const result = firstRotationPlaneContact(translated);
  expect(result.angle).toBeCloseTo(reference.angle!, 12);
  expect(result.distance!).toBeCloseTo(0, 10);
  expect(Array.from(q.positions)).toEqual([-2, 3, 1]);
});
test("arbitrary axis agrees with independent Rodrigues sampling before and at first contact", () => {
  let seed = 123;
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 2 ** 32;
  };
  for (let run = 0; run < 300; run++) {
    const axis = [random() - 0.5, random() - 0.5, random() - 0.5],
      length = Math.hypot(...axis),
      k = axis.map((x) => x / length);
    const positions = Float64Array.from({ length: 12 }, (_, i) =>
      i % 3 === 1 ? 1 + random() * 4 : (random() - 0.5) * 8,
    );
    const q = {
      ...query([]),
      positions,
      axis: axis as [number, number, number],
      maxAngle: Math.PI * 1.5,
    };
    const result = firstRotationPlaneContact(q);
    const distance = (i: number, t: number) => {
      const x = positions[i * 3]!,
        y = positions[i * 3 + 1]!,
        z = positions[i * 3 + 2]!,
        d = k[0]! * x + k[1]! * y + k[2]! * z;
      return (
        y * Math.cos(t) +
        (k[2]! * x - k[0]! * z) * Math.sin(t) +
        k[1]! * d * (1 - Math.cos(t))
      );
    };
    const limit = result.angle ?? q.maxAngle;
    for (let step = 0; step < 200; step++)
      for (let i = 0; i < 4; i++)
        expect(distance(i, (limit * step) / 200)).toBeGreaterThanOrEqual(
          -1e-10,
        );
    if (result.angle !== null) {
      expect(Math.abs(distance(result.vertex!, result.angle))).toBeLessThan(
        1e-10,
      );
      expect(Math.abs(result.distance!)).toBeLessThan(1e-10);
    }
  }
});
test("rejects malformed and over-budget input before early contact", () => {
  const q = query([0, 0, 0]);
  for (const bad of [
    { ...q, positions: Float64Array.from([0, 0, 0, NaN, 1, 1]) },
    { ...q, positions: new Float64Array(300003) },
    { ...q, positions: new Float64Array(4) },
    { ...q, axis: [0, 0, 0] },
    { ...q, plane: { normal: [0, 0, 0], constant: 0 } },
    { ...q, maxAngle: -1 },
    { ...q, maxAngle: 7 },
    { ...q, pivot: [Infinity, 0, 0] },
  ])
    expect(() =>
      firstRotationPlaneContact(bad as RotationPlaneQuery),
    ).toThrow();
});

test("near-zero first contact keeps its small positive angle instead of cancelling to zero", () => {
  const r = firstRotationPlaneContact(query([-1, 1e-18, 0]));
  expect(r.status).toBe("contact");
  expect(r.angle!).toBeGreaterThan(0);
  expect(Math.abs(r.angle! / 1e-18 - 1)).toBeLessThan(1e-12);
});

test("non-axis-aligned tangent is retained without discriminant subtraction cancellation", () => {
  const q = {
    ...query([3, 9, 0]),
    pivot: [0, 5, 0] as const,
  };
  const result = firstRotationPlaneContact(q);
  expect(result.status).toBe("contact");
  expect(result.angle).toBeCloseTo(Math.atan2(3, 4) + Math.PI, 12);
  expect(Math.abs(result.distance!)).toBeLessThan(1e-12);
});
