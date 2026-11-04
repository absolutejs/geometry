export {
  projectAlphaCoverage,
  type AlphaProjectionInput,
  type AlphaProjection,
} from "./projection.js";
export { alphaFromRgba, alphaFromImageBitmap } from "./alpha.js";

export { closedComponents } from "./closedComponents.js";
export { solidPointMembership } from "./solidPointMembership.js";
export { solidComponents } from "./solidComponents.js";
export {
  auditSolidOverlaps,
  type OverlapMesh,
  type OverlapSolid,
  type SolidOverlapAudit,
} from "./overlap.js";
export {
  partitionSolidMaterials,
  type MaterialPartitionKernel,
  type SolidMaterialPartition,
} from "./materialPartition.js";

export { triangleWeights, prepareTriangleWeights } from "./triangleWeights.js";
export { auditSurfaceOrigins, type SurfaceOrigins } from "./surfaceOrigins.js";
export { mergeIndexedMesh, type IndexedMergeMesh } from "./mergeIndexedMesh.js";
export { principalInertiaFrame } from "./principalInertia.js";
export {
  axialOrientationTensor,
  type WeightedAxis,
} from "./axialOrientation.js";

export {
  tetrahedronPlaneMoments,
  prepareTetrahedronPlaneMoments,
} from "./tetrahedronPlaneMoments.js";
export {
  trianglePlaneMoments,
  prepareTrianglePlaneMoments,
} from "./trianglePlaneMoments.js";
export { prepareSolidPlaneMoments } from "./solidPlaneMoments.js";

export { closeConvexTube, type ClosedConvexTube } from "./closeConvexTube.js";
export { regularizeZeroExtentShells } from "./regularizeZeroExtentShells.js";
export { prepareTrianglePositiveQuadraticMoments } from "./trianglePositiveQuadraticMoments.js";

export { prepareTrianglePositiveLinearMoments } from "./trianglePositiveLinearMoments.js";
export {
  partitionTriangleAffineDomains,
  partitionTriangleBoxDomains,
  type DomainBox,
  type TriangleDomainCell,
} from "./triangleDomains.js";

export {
  prepareUpwardSurface,
  type UpwardSurfaceInput,
  type UpwardSurfaceHit,
} from "./upwardSurface.js";

export {
  partitionStarShapedMesh,
  type StarPartition,
  type StarPartitionPiece,
  type StarPartitionOptions,
} from "./starPartition.js";

export { prepareScalarContour2D, type ScalarContour2DInput, type ContourHit2D } from './scalarContour2D.js';
