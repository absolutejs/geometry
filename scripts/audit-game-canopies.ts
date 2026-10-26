import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { projectAlphaCoverage } from "../src/index";
const game = process.env.HELLO_WORLD_ROOT ?? "/home/alexkahn/alex/hello-world";
const packageRoot = process.cwd();
process.chdir(game);
const { forestGeometryFrom } = await import(
  game + "/tests/helpers/forestGeometry.ts"
);
const { deformTreePositions } = await import(
  game + "/src/world/treePhenotype.ts"
);
const {
  PNG,
} = require("/home/alexkahn/.cache/claude-memprobe/dr/node_modules/playwright-core/lib/utilsBundle.js");
const file = game + "/src/backend/assets/models/forest-v8.glb",
  bytes = readFileSync(file),
  length = bytes.readUInt32LE(12);
const g = JSON.parse(bytes.subarray(20, 20 + length).toString()),
  bin = bytes.subarray(28 + length);
if (bytes.readUInt32LE(0) !== 0x46546c67 || bytes.readUInt32LE(4) !== 2)
  throw Error("Expected canonical GLB2");
const out = packageRoot + "/docs/canopy-audit";
mkdirSync(out, { recursive: true });
const load = forestGeometryFrom(file),
  rows: any[] = [];
const mode = (value: number | undefined) =>
  value === 33071
    ? "clamp"
    : value === 33648
      ? "mirror"
      : value === undefined || value === 10497
        ? "repeat"
        : (() => {
            throw Error("Unknown sampler wrap");
          })();
for (let variant = 0; variant < 8; variant++) {
  const node = g.nodes.find((n: any) => n.name === `HW8_Canopy_${variant}`),
    mesh = g.meshes[node.mesh];
  if (mesh.primitives.length !== 1)
    throw Error("Expected single canopy primitive");
  const primitive = mesh.primitives[0],
    material = g.materials[primitive.material],
    map = material.pbrMetallicRoughness.baseColorTexture;
  if (
    material.alphaMode !== "MASK" ||
    map.texCoord ||
    map.extensions?.KHR_texture_transform ||
    (material.pbrMetallicRoughness.baseColorFactor?.[3] ?? 1) !== 1
  )
    throw Error("Unsupported canopy alpha contract");
  const texture = g.textures[map.index],
    source = g.images[texture.source],
    view = g.bufferViews[source.bufferView],
    sampler = g.samplers?.[texture.sampler];
  const png = PNG.sync.read(
    bin.subarray(
      view.byteOffset ?? 0,
      (view.byteOffset ?? 0) + view.byteLength,
    ),
  );
  const alpha = Uint8Array.from(
    { length: png.width * png.height },
    (_, i) => png.data[i * 4 + 3],
  );
  const geometry = load(variant, "Canopy"),
    position = geometry.getAttribute("position"),
    uv = geometry.getAttribute("uv"),
    color = geometry.getAttribute("color");
  if (color?.itemSize === 4)
    for (let i = 0; i < color.count; i++)
      if (color.getW(i) !== 1)
        throw Error("Vertex alpha requires explicit support");
  for (const pose of variant === 0 || variant === 4
    ? ["canonical", "phenotype", "fallen"]
    : ["canonical"]) {
    const positions = Float64Array.from(position.array);
    if (pose === "phenotype")
      deformTreePositions(positions, {
        scale: 1.3,
        width: 0.8,
        crown: 0.2,
        lean: 0.6,
      });
    if (pose === "fallen")
      for (let i = 0; i < positions.length; i += 3) {
        const y = positions[i + 1]!;
        positions[i + 1] = -positions[i + 2]!;
        positions[i + 2] = y;
      }
    for (const resolution of [128, 256, 512]) {
      const start = performance.now();
      const result = projectAlphaCoverage({
        positions,
        uv: Float32Array.from(uv.array),
        indices: Uint32Array.from(geometry.index!.array),
        alpha,
        textureWidth: png.width,
        textureHeight: png.height,
        cutoff: material.alphaCutoff,
        wrapS: mode(sampler?.wrapS),
        wrapT: mode(sampler?.wrapT),
        resolution,
      });
      const { cells, ...metrics } = result;
      const record = {
        variant,
        pose,
        texture: [png.width, png.height],
        alphaSha256: createHash("sha256").update(alpha).digest("hex"),
        ...metrics,
        elapsedMs: performance.now() - start,
      };
      rows.push(record);
      if (resolution === 512) {
        const image = new PNG({ width: resolution, height: resolution });
        for (let i = 0; i < cells.length; i++) {
          const c =
            cells[i] === 2
              ? [70, 168, 103]
              : cells[i] === 1
                ? [178, 216, 237]
                : [20, 29, 35];
          image.data.set([...c, 255], i * 4);
        }
        writeFileSync(
          `${out}/variant-${variant}-${pose}.png`,
          PNG.sync.write(image),
        );
      }
      console.log(
        JSON.stringify({
          variant,
          pose,
          resolution,
          gap: result.gapFraction,
          area: result.coveredArea,
          tests: result.pixelTests,
          ms: record.elapsedMs,
        }),
      );
    }
  }
  geometry.dispose();
}
const convergence = rows
  .filter((r) => r.resolution === 512)
  .map((fine) => {
    const coarse = rows.find(
      (r) =>
        r.variant === fine.variant &&
        r.pose === fine.pose &&
        r.resolution === 256,
    );
    return {
      variant: fine.variant,
      pose: fine.pose,
      gapChange: Math.abs(fine.gapFraction - coarse.gapFraction),
      areaRelativeChange:
        Math.abs(fine.coveredArea - coarse.coveredArea) / fine.coveredArea,
    };
  });
writeFileSync(
  out + "/result.json",
  JSON.stringify(
    {
      source: file,
      sourceSha256: createHash("sha256").update(bytes).digest("hex"),
      scope:
        "Static actual canopy triangles and bilinear alpha threshold; vertex-hull reference footprint, center-sampled vertical projection. Not measured hydrologic interception.",
      rows,
      convergence,
    },
    null,
    2,
  ),
);
if (convergence.some((c) => c.gapChange > 0.02 || c.areaRelativeChange > 0.05))
  throw Error(
    "Canopy projection resolution did not converge within audit tolerance",
  );
