import { preparePositiveTriangleMoments } from "./positiveTriangleMoments.js";
/** Exact positive quadratic/cubic field moments with optional affine domain.
 * Inputs/results are owned; no exposure, physical coefficient or force is inferred. */
export function prepareTrianglePositiveQuadraticMoments(
  input: readonly (readonly [number, number, number])[],
) {
  return preparePositiveTriangleMoments(input, 2);
}
