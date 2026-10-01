# Cake Studio scene architecture

Cake Studio uses the application's existing `CakeConfig` (`CakeConfiguration` alias) as its only document state. Both renderers consume the same document. The existing save, quote, order, recipe, history, and pricing paths remain in use.

## Document and compatibility

The outer business schema stays at `version: 1`; `sceneVersion: 2` identifies independently editable scene objects. `normalizeCake` upgrades old decoration bundles to stable object IDs, preserves the bundle's total component cost, and clears the legacy category arrays. It is deterministic and idempotent. Old documents remain readable throughout the product.

- `tiers`: physical dimensions in inches, optional per-tier shape, horizontal position, spacing above the preceding tier, frosting thickness, finish, roughness, specular response, imperfection, visibility, and lock state.
- `objects`: individually identified assets with a tier attachment, transform, color, material, deterministic variation seed, visibility, lock state, and unit cost. Flowers, pearls, ribbons, etc. share this structure rather than parallel arrays with overlapping ownership.
- `attachment`: tier ID, top/side surface, angle in radians, normalized radial distance and height, and an outward offset in inches. World positions are derived; resizing and reordering tiers carry their children along.
- `board`, `background`, `camera`, `lettering`: saved editor properties. The board grows when necessary to support wider or offset tiers. `text` and `topper` retain the existing business fields; their fixed scene IDs are `text` and `topper`, with real text-mesh settings in `lettering`.
- `hidden` affects preview visibility; it does not remove an ordered component from the price. Delete a component to remove its charge. Lock prevents editing the selected component; it is an editor aid, not an access-control mechanism.

JSON import validates sizes, finite transforms, unique scene IDs and tier references. JSON export stores the complete editable document. No Three.js objects, textures, or runtime meshes are serialized.

## Rendering

`scene/geometry.ts` creates a closed frosting surface with a rounded perimeter, dense side and top sampling, deterministic small deviations and finish-dependent geometry. `scene/materials.tsx` supplies reusable physical material presets and locally generated micro-bump data. Naked finishes use exposed sponge bands; they are illustrative material finishes rather than an internal recipe simulation.

Flowers are locally authored curved-petal meshes with leaf geometry, exported as three variants of GLB. They are loaded on demand with Drei's GLTFLoader integration and MeshoptDecoder. Geometry is shared between instances; per-flower petal materials are cloned and disposed independently. Procedural petals remain available if an asset cannot load.

Pearls, sprinkles and foil use instanced drawing. Each instance retains its individual ID, price, transform and click target. Other objects are separate scene nodes. Small-component transforms are available in the inspector; rotation and scale gizmos are used for larger components. Surface movement uses actual tier ray intersections, with a single history commit at pointer release. Catalog drag-and-drop also raycasts the tier surface. Click-to-add supports touch and keyboard use.

The bundled photographed Poly Haven Studio Small 09 HDR environment provides softbox reflections (CC0; attribution in ASSETS.md). It needs no third-party runtime network request. Tone mapping, environment reflections, studio lights, physical materials, broad variance shadows and depth-based contact shading produce the preview. `StudioPostprocessing` adds small-radius GTAO between petals and tiers, at half resolution, followed by a single tone/color output pass. Light-space shadow maps are reused during camera movement and rebuilt when caster geometry, placement, visibility or instance transforms change. The HDR render target uses up to four antialiasing samples; its pixel ratio is capped at 1.5. The AO normals pass preserves lighting shadow maps and excludes transparent selection/contact overlays. The contact pass preserves the main lights' shadow-map state. Rendering is demand-driven except during orbit/auto-rotation or active transforms. Per-component geometry and texture resources are disposed at replacement/unmount.

`CameraControls` frames the stack and board after dimension/position changes, offers five product viewpoints, and supports orbit, pan, zoom and reset. The minimum orbit distance prevents moving into the centered cake envelope. Extreme panning can move the viewing target away from the product; reset restores framing.

## Assets

`src/studio/assets/catalog.json` is the metadata registry. Add an entry there to expose a compatible built-in renderer or GLB in the library. It contains IDs, names, categories, model/thumbnail URLs where applicable, default scales, allowed surfaces, material/color defaults and component costs. Model geometry uses Three.js units; 0.27 units equals one cake inch. Flower local +Y points away from its mounting surface.

Regenerate bundled flower assets, the original procedural HDR and the Great Vibes font conversion with:

```sh
node --import tsx scripts/studio/build-assets.ts
```

The GLB build applies lossless `EXT_meshopt_compression`. Fonts, HDR, thumbnails and GLBs are served locally. Catalog metadata is small and loaded with the document code; model binaries are only requested for decorations present in the scene. No external model generator or asset credentials are required.

## Image-to-cake boundary

`services/ImageToCakeService.ts` exposes `analyzeImage`, `generateInitialCakeConfig`, `generateAsset` and `generateReferenceMesh`. Connect a provider adapter with `configureImageToCakeService`; keep provider credentials on a server. The UI depends only on the interface and validates returned analysis and configurations.

The supplied adapter is an **offline heuristic, not an AI vision model**. It samples a photograph's central colors and estimates tier transitions from silhouette-width changes. Confidence is explicitly low. The review screen lets the baker correct tier count, dimensions, colors, flowers/pearls and wording before applying an ordinary CakeConfiguration. It cannot infer actual scale, recipe, hidden geometry, decoration classes or OCR reliably. Asset and reference-mesh generation report that a provider is required. Manual editing remains fully available.

## Verification and remaining scope

Run `npm test`, `npm run build`, and `npx playwright test`. Domain tests cover migration pricing, serialization, placement invariants, validation, geometry, and reviewed image conversion. Browser tests cover independent object editing, locking, history, 2D synchronization, saving/reloading, camera/shape changes, and the existing customer → quotation → order flow.

The slice prioritizes tiers, buttercream and other frosting presets, three flower variants, pearls, text, and tier-aware editing. The smaller legacy confection models are retained as starting assets; an exhaustive photoreal scanned decoration collection (daisies, berries, curls, edible flowers, etc.) is future asset work. There is no claim of photographic reconstruction, material calibration to a particular bakery's recipe, or production GPU certification across devices. Validate customer-facing color and proportions against the actual cake and browser/display used.

## Visual verification

`scripts/studio/capture.mjs` captures the real WebGL editor from the isolated local server on port 5182. `--closeup` also captures detail; `--audit` checks the Layers selection, shared 2D document and mobile viewport. It fails on browser page or console errors. Captures are review artifacts, never substituted for the live cake.

The realism revision replaces the original concentric rose surfaces with cupped, individually varied petals; adds petal micro-veins, leaf veins, a crinkled foil mesh, physical script lettering and object-space buttercream scrape/pore shading. Existing saved colors, geometry, attachments and prices remain document properties. The new compact floral arrangement applies only while converting legacy category bundles; stored scene objects retain their placements. The editable procedural flowers are still an approximation, not scanned botanical assets or a claim of photographic reconstruction.
