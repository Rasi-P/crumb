# Cake Studio scene architecture

Cake Studio uses the application's existing `CakeConfig` (`CakeConfiguration` alias) as its only document state. Both renderers consume the same document. The existing save, quote, order, recipe, history, and pricing paths remain in use.

## Document

The outer business schema stays at `version: 1`; `sceneVersion: 2` identifies independently editable scene objects. `normalizeCake` upgrades old decoration bundles to stable object IDs, preserves the bundle's total component cost, and clears the legacy category arrays. It is deterministic and idempotent.

- `tiers`: physical dimensions in inches, optional per-tier shape, horizontal position, spacing above the preceding tier, frosting thickness, finish, roughness, specular response, imperfection, visibility, and lock state.
- `objects`: individually identified decorations with an attachment, rotation, scale, color, material, deterministic variation seed, visibility, lock state, unit cost, and an optional `nudge` (Free Transform displacement in inches).
- `attachment` is one of two shapes, both relative to what the object sits on, never world coordinates:
  - on a tier: tier ID, top/side surface, angle in radians, normalized radial distance and height, and an outward offset in inches;
  - on a generated model (`surface: "model"`): model ID, a point and a normal in the model's normalized frame (footprint one unit wide, base at y = 0), and an offset.
    World positions are derived (`placementOf`). Resizing, moving, or turning a tier or model carries its decorations along without rewriting them.
- `generatedModels`: geometry from an image-to-3D service or an imported GLB. Each stores the stored asset URL, its real width in inches, measured height, position, Y rotation, visibility, lock, and the separable parts found at import with a name and hidden flag each.
- `referenceImages`: the photographs a model was generated from, by view.
- `board`, `background`, `camera`, `lettering`: saved editor properties. `text` and `topper` retain the existing business fields; their fixed scene IDs are `text` and `topper`.
- `hidden` affects preview visibility; it does not remove an ordered component from the price. Delete a component to remove its charge. Lock prevents editing; it is an editor aid, not access control.

JSON import validates sizes, finite transforms, unique scene IDs, tier/model references, and that model and photo URLs point at this application's own asset store. No Three.js objects, textures, or meshes are serialized; a generated model is referenced by URL.

## Image to 3D

```
photograph(s) → resize / orient in the browser → POST /api/studio/image-to-3d/jobs
  → ImageTo3DProvider.createFromImage | createFromMultiView      (server/imageTo3d)
  → GET /api/studio/image-to-3d/jobs/:id polls provider status
  → on success: download GLB → validate container → store        (server/storage/assets.ts)
  → browser loads the stored GLB → measure, normalize, find parts (scene/modelAnalysis.ts)
  → added to the document as a generated model, opened as a new design
```

- `server/imageTo3d/types.ts` defines `ImageTo3DProvider` (`createFromImage`, `createFromMultiView`, `getStatus`, `getResult`). `meshy.ts` and `tripo.ts` implement it; `index.ts` picks one from the environment. The browser only talks to `/api/studio/*` and has no knowledge of which service is behind it. Adding a provider means one new file and one line in `index.ts`.
- **Nothing is simulated.** With no key configured the status endpoint reports `configured: false`, job creation returns 503 "Image-to-3D service not configured", and the dialog shows that message. There is no procedural fallback cake.
- One photograph uses single-image generation; two to four (front, left, back, right) use the provider's multi-view generation.
- A job that is still running when the dialog is closed or the page reloads is remembered in `localStorage` and picked up when the dialog is next opened. A job always maps to the same stored asset, so the model is downloaded once.
- Background removal is left to the provider (both do it server-side). The browser applies EXIF orientation, limits the long edge to 1600 px, and flattens transparency onto white.
- The stored GLB is the file the provider returned, byte for byte. It is not decimated, re-meshed, or rebuilt from primitives. `GLTFLoader` is configured with the Meshopt decoder and a locally served Draco decoder.
- "Import a .glb file" in the same dialog puts an existing model through the identical validate → store → import path.

### What import does to the model

`prepareModel` measures the model, then expresses it in a normalized frame; the document's `diameter`, `position` and `rotation` place that frame in the scene. Geometry and materials are used as delivered.

- **Parts.** If the file contains several meshes, each is a selectable part. If it is a single mesh, disconnected shells of at least 0.4 % of its triangles become parts ("Cake body", "Cake board", "Topper", "Decoration n", named by position only). A fully fused mesh — the usual output of image-to-3D services — stays one part. Parts can be selected, renamed in the inspector list, and hidden; "deleting" a part hides it, since it cannot be cut out of the file. There is no semantic segmentation: a flower baked into the fused mesh cannot be picked up, only covered or accompanied by an editable one.
- **Tier estimate.** The silhouette's radius at each height (median across angular sectors, so a protruding flower does not widen a tier) is grouped into plateaus to estimate tier diameters and heights. These become hidden parametric tiers that carry servings, recipe and price, and give lettering somewhere to sit. They are an estimate from shape alone; the dialog asks for the real width because a photograph has no scale. Resizing the model rescales them; they can be selected in Layers and corrected.
- A bounding-volume hierarchy (three-mesh-bvh) is built per part so pointer rays against dense meshes stay fast.

## Selection and direct manipulation

`scene/Interaction.tsx` is the single owner of pointer gestures on the canvas. It listens in the capture phase so it can decide, before the orbit controls see the event, whether a press belongs to an object, the gizmo, or the camera.

- **Pick.** A ray is cast against every visible mesh that belongs to something selectable (`userData.sceneId`, or `instanceIds` on instanced batches). The nearest hit wins, so clicking a flower selects the flower and not the tier behind it. Empty space clears the selection; shift-click toggles membership. Selection IDs are tier, object or model IDs, `board`, `text`, `topper`, or `<modelId>/<partKey>`.
- **Drag.** Pressing on an unlocked decoration with the Select tool selects it and starts a drag in the same gesture; the camera is held until release. On each move a ray is cast at the surfaces that can carry decorations (tier frosting and generated-model parts). The hit point and a smoothed vertex normal are converted to an attachment on that tier or model, so the object travels around the cylinder, over the edge onto the top, or across the generated mesh, and turns to face out of the surface. The pointer's offset from the object's anchor at grab time is preserved. The live position is local state; one history entry is written on release.
- **Quick controls.** A toolbar follows the selected decoration: drag-to-rotate about the surface normal, drag-to-resize (uniform), duplicate, delete. Both drag handles also respond to the arrow keys.
- **Tools.** Select (above); Rotate and Scale show a transform gizmo in the object's local frame; Free shows a world-axis translate gizmo that lifts the object off its surface point into `nudge` while keeping the attachment, so it still follows the cake. A later surface drag clears the nudge.
- **Keyboard.** Delete/Backspace remove, ⌘/Ctrl+D duplicates, ⌘/Ctrl+Z and ⌘/Ctrl+Shift+Z undo and redo, Escape clears the selection. Delete and duplicate apply to the whole selection. Removing a generated model asks first.
- **Duplicate** makes an independent object with a new seed and a small change of turn and size. On a tier it steps along the angle; on a generated mesh the scene is asked for a nearby point on the actual surface.
- **Replace** is the inspector's "Decoration type": the asset changes, the attachment, rotation and scale stay.
- Click-to-add from the library places on the selected tier, or, when a generated model is the cake, on the surface at the middle of the current view. Catalog drag-and-drop raycasts the drop point.
- The selection outline is a post-processing pass (`SelectionOutlinePass`): a mask of the selected meshes, edge-expanded and alpha-blended. three's `OutlinePass` blends additively and is invisible on the pale studio background.

The canvas renders on demand. Picking refreshes world matrices before every ray, and asynchronously loaded assets request a frame when they arrive.

## Rendering

`scene/geometry.ts` creates a closed frosting surface with a rounded perimeter, dense side and top sampling, deterministic small deviations and finish-dependent geometry. `scene/materials.tsx` supplies physical material presets and locally generated micro-bump data. Flowers are locally authored curved-petal meshes exported as three GLB variants; geometry is shared between instances and per-flower petal materials are cloned. Pearls, sprinkles and foil use instanced drawing while keeping individual IDs, prices and click targets; a selected instance is drawn as its own object so it can be outlined and dragged.

The bundled Poly Haven Studio Small 09 HDR provides softbox reflections. ACES tone mapping, environment reflections, a key and a fill light, variance shadows, depth-based contact shading, and half-resolution GTAO produce the preview; the HDR target uses up to four MSAA samples at a pixel ratio capped at 1.5. Generated models are lit by the same rig with the PBR materials and textures the provider delivered.

## Assets and storage

`src/studio/assets/catalog.json` is the decoration registry. Model geometry uses Three.js units; 0.27 units equals one cake inch. Flower local +Y points away from its mounting surface. Regenerate bundled flower assets with `npm run build:studio-assets`.

Generated models and reference photographs live in the studio asset store (`server/storage/assets.ts`): files under `.data/studio-assets` locally, the `crumb_studio_assets` table when `DATABASE_URL` is set. They are served from `/api/studio/assets/<32 hex>`, immutable and cacheable. The link is unguessable and readable without a session so that a customer opening a quotation can see the model.

## Verification

Run `npm test`, `npm run build`, and `npx playwright test`.

- Unit tests cover the document (migration, serialization, model attachments surviving resize/move/turn, rejection of missing references and foreign asset URLs), the editing helpers, model import (normalization at arbitrary source scale, part separation, tier estimate, accelerated raycast), both provider adapters' request and response handling against their documented HTTP shapes, GLB validation, and the studio routes including the unconfigured case.
- Browser tests drive the real editor. `tests/e2e/mock-provider.mjs` is a small HTTP server that speaks Meshy's API and serves a GLB built in memory; the application reaches it only because the Playwright configuration sets `MESHY_API_BASE_URL`. This runs the real adapter, download, validation, storage, loading and editing path without credits. The main test generates from a photograph, selects a part of the mesh, adds a rose, drags it onto the side and then the top of the model and checks from the saved document that it lies on the surface and faces out of it, rotates, resizes, duplicates, deletes, resizes the model, saves, reloads, and compares the reloaded document with the saved one.

### Not yet verified or built

- **No live provider run.** No API key was available while this was built. The Meshy adapter follows Meshy's published API reference; the Tripo adapter follows Tripo's v2 OpenAPI as used by its official Python SDK. Neither has been exercised against the real service. Run `npm run studio:image-to-3d-smoke -- photo.jpg` with a key before relying on either. How faithful a generated cake is to its photograph depends on the provider and has not been assessed here.
- **Vercel.** Storing models in Postgres is implemented but untested on the deployment. Vercel Functions cap request and buffered response bodies at about 4.5 MB, so serving a typical 10–40 MB generated GLB through the function, and importing a GLB of that size, are expected to need object storage (for example Vercel Blob) behind the same `AssetStore` interface. The 30-second function limit also has to cover downloading the model from the provider.
- No model optimization pass (mesh compression, texture re-encoding) runs on the stored GLB.
- No semantic segmentation of fused meshes, no camera alignment to the reference photograph (the overlay is a fixed image with an opacity control), no marquee selection, no per-axis scaling, and no moving of generated parts.
- Decorations cannot yet be placed on the cake board.
- The procedural frosting, flowers and the rest of the built-in library are unchanged in this pass.

## Visual capture

`scripts/studio/capture.mjs` captures the real WebGL editor from a local server on port 5182. `--closeup` also captures detail; `--audit` checks the Layers selection, shared 2D document and mobile viewport. It fails on browser page or console errors.
