import { test, expect } from "bun:test";
import { principalInertiaFrame } from "../src/index";
const rotation = (q: { x: number; y: number; z: number; w: number }) => {
  const { x, y, z, w } = q;
  return [
    1 - 2 * (y * y + z * z),
    2 * (x * y - z * w),
    2 * (x * z + y * w),
    2 * (x * y + z * w),
    1 - 2 * (x * x + z * z),
    2 * (y * z - x * w),
    2 * (x * z - y * w),
    2 * (y * z + x * w),
    1 - 2 * (x * x + y * y),
  ];
};
const tensor = (r: number[], d: number[]) =>
  Array.from({ length: 9 }, (_, i) =>
    d.reduce(
      (s, v, k) => s + r[Math.floor(i / 3) * 3 + k]! * v * r[(i % 3) * 3 + k]!,
      0,
    ),
  );
test("rotated box inertia reconstructs across scales and near-degenerate axes", () => {
  for (let k = 0; k < 160; k++) {
    const raw = [
        Math.sin(k + 1),
        Math.cos(k * 2 + 1),
        Math.sin(k * 3 + 2),
        Math.cos(k + 4),
      ],
      n = Math.hypot(...raw),
      q = { x: raw[0]! / n, y: raw[1]! / n, z: raw[2]! / n, w: raw[3]! / n };
    const scale = 10 ** ((k % 25) - 12),
      side = [1, 0.1 + (k % 7), k % 2 ? 1 : 1.00000001];
    const d = [
      side[1]! ** 2 + side[2]! ** 2,
      side[0]! ** 2 + side[2]! ** 2,
      side[0]! ** 2 + side[1]! ** 2,
    ].map((v) => v * scale);
    const original = tensor(rotation(q), d),
      copy = [...original],
      out = principalInertiaFrame(original),
      actual = tensor(rotation(out.frame), out.principal);
    expect(original).toEqual(copy);
    for (let i = 0; i < 9; i++)
      expect(Math.abs(actual[i]! - original[i]!) / Math.max(...d)).toBeLessThan(
        1e-12,
      );
    expect(Math.hypot(...Object.values(out.frame))).toBeCloseTo(1, 13);
    expect(out.principal).toEqual([...out.principal].sort((a, b) => a - b));
    expect(out.sweeps).toBeLessThan(32);
  }
});
test("isotropic and thin-body inertia remain finite and deterministic", () => {
  for (const d of [
    [2, 2, 2],
    [1e-10, 1, 1],
    [2, 1, 2],
    [2, 2, 1],
  ]) {
    const a = tensor([1, 0, 0, 0, 1, 0, 0, 0, 1], d);
    expect(principalInertiaFrame(a)).toEqual(principalInertiaFrame(a));
    expect(principalInertiaFrame(a).principal).toEqual(
      [...d].sort((x, y) => x - y),
    );
  }
});
test("reject malformed, asymmetric, negative and nonphysical inertia", () => {
  for (const a of [
    [],
    [1, 2, 3],
    Array(9).fill(0),
    [1, 1, 0, 0, 1, 0, 0, 0, 1],
    [-1, 0, 0, 0, 1, 0, 0, 0, 1],
    [1, 0, 0, 0, 1, 0, 0, 0, 3],
    [NaN, 0, 0, 0, 1, 0, 0, 0, 1],
    [Infinity, 0, 0, 0, 1, 0, 0, 0, 1],
  ])
    expect(() => principalInertiaFrame(a)).toThrow();
});
