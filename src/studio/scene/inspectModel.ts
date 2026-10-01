import { DRACOLoader, GLTFLoader, MeshoptDecoder } from "three-stdlib";
import { prepareModel, tiersFromEstimate } from "./modelAnalysis";

let loader: GLTFLoader | undefined;
function modelLoader() {
  if (!loader) {
    loader = new GLTFLoader();
    const draco = new DRACOLoader();
    draco.setDecoderPath("/assets/draco/");
    loader.setDRACOLoader(draco);
    loader.setMeshoptDecoder(
      typeof MeshoptDecoder === "function" ? MeshoptDecoder() : MeshoptDecoder,
    );
  }
  return loader;
}

// Loads a stored GLB once, before it joins the document, and reports what the
// document needs to know about it: proportions, separable parts, and a tier
// estimate for sizing and pricing. Fails if the file cannot be rendered.
export async function inspectModel(url: string, diameter: number) {
  const gltf = await modelLoader().loadAsync(url),
    model = prepareModel(gltf.scene, false);
  return {
    height: model.height,
    triangles: model.triangles,
    parts: model.parts.map((p) => ({
      key: p.key,
      name: p.name,
      hidden: false,
    })),
    ...tiersFromEstimate(model.tiers, diameter),
  };
}
