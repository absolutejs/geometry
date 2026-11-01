import { preparePositiveTriangleMoments } from "./positiveTriangleMoments.js";
/** Integrate a positive affine field and its relative first surface moment.
 * Optional positive affine domain further restricts the triangle. Zero-domain
 * fields are empty. Results own their arrays; meanOffset is relative to reference.
 * This is geometric integration, not a fluid-exposure or contact-sealing model. */
export function prepareTrianglePositiveLinearMoments(
  input: readonly (readonly [number, number, number])[],
) {
  return preparePositiveTriangleMoments(input, 1);
}
