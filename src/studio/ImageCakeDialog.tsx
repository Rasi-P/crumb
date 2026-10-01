import { useEffect, useRef, useState } from "react";
import { Box, ImagePlus, Sparkles, X } from "lucide-react";
import { Button, Modal } from "../components/ui";
import { Numeric } from "./ScenePanels";
import {
  forgetPendingGeneration,
  generateModel,
  getImageTo3DStatus,
  importModelFile,
  pendingGeneration,
  resumeGeneration,
  type GenerationProgress,
  type GenerationResult,
  type ReferenceView,
} from "./services/imageTo3d";
import {
  referenceViews,
  type GeneratedModel,
  type ReferenceImage,
} from "../domain/models";

export type GeneratedCake = {
  model: GeneratedModel;
  referenceImages: ReferenceImage[];
  // Hidden parametric stand-ins measured from the model, in inches.
  base: number;
  tiers: { diameter: number; height: number }[];
};
const viewLabels: Record<ReferenceView, string> = {
  front: "Front",
  left: "Left",
  back: "Back",
  right: "Right",
};
const progressText: Record<GenerationProgress["state"], string> = {
  preparing: "Preparing photographs…",
  queued: "Waiting for the 3D service…",
  running: "Generating the 3D model…",
  importing: "Importing the model into the studio…",
};

export function ImageCakeDialog({
  onClose,
  onApply,
}: {
  onClose: () => void;
  onApply: (cake: GeneratedCake) => void;
}) {
  const [service, setService] = useState<
      { configured: boolean; maxViews: number } | "checking" | "unreachable"
    >("checking"),
    [photos, setPhotos] = useState<
      Partial<Record<ReferenceView, { file: File; url: string }>>
    >({}),
    [diameter, setDiameter] = useState(8),
    [progress, setProgress] = useState<GenerationProgress | null>(null),
    [error, setError] = useState("");
  const pending = useRef<AbortController | null>(null),
    urls = useRef(new Set<string>()),
    size = useRef(diameter);
  size.current = diameter;

  // Turns a stored GLB into a document entry. Nothing is applied unless the
  // file actually loads in the renderer's own loader.
  const adopt = async (
    result: GenerationResult,
    source: GeneratedModel["source"],
  ) => {
    setProgress({ state: "importing", progress: 100 });
    const { inspectModel } = await import("./scene/inspectModel"),
      info = await inspectModel(result.modelUrl, size.current);
    onApply({
      model: {
        id: crypto.randomUUID(),
        name: source === "generated" ? "Generated cake" : "Imported cake",
        url: result.modelUrl,
        source,
        diameter: size.current,
        height: info.height,
        position: [0, 0, 0],
        rotation: 0,
        hidden: false,
        locked: false,
        parts: info.parts.length > 1 ? info.parts : undefined,
      },
      referenceImages: result.referenceImages,
      base: info.base,
      tiers: info.tiers,
    });
  };
  const run = async (
    work: (signal: AbortSignal) => Promise<GenerationResult>,
    source: GeneratedModel["source"],
  ) => {
    pending.current?.abort();
    const controller = new AbortController();
    pending.current = controller;
    setError("");
    try {
      const result = await work(controller.signal);
      if (!controller.signal.aborted) await adopt(result, source);
    } catch (e) {
      if (!controller.signal.aborted)
        setError(
          e instanceof Error ? e.message : "The 3D model could not be created.",
        );
    } finally {
      if (!controller.signal.aborted) setProgress(null);
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    getImageTo3DStatus(controller.signal)
      .then((status) => {
        setService(status);
        // A generation that was still running when the dialog last closed.
        const job = pendingGeneration();
        if (status.configured && job)
          void run(
            (signal) => resumeGeneration(job, signal, setProgress),
            "generated",
          );
      })
      .catch(() => {
        if (!controller.signal.aborted) setService("unreachable");
      });
    return () => {
      controller.abort();
      pending.current?.abort();
      urls.current.forEach((url) => URL.revokeObjectURL(url));
    };
  }, []);

  const choose = (view: ReferenceView, file?: File) => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    urls.current.add(url);
    setError("");
    setPhotos((p) => ({ ...p, [view]: { file, url } }));
  };
  const configured = typeof service === "object" && service.configured,
    views = referenceViews.slice(
      0,
      typeof service === "object" ? Math.max(1, service.maxViews) : 1,
    ),
    chosen = views.flatMap((view) =>
      photos[view] ? [{ view, file: photos[view].file }] : [],
    ),
    busy = !!progress;
  return (
    <Modal
      title="Create from Cake Image"
      description="Your photograph is sent to an image-to-3D service and the model it returns becomes the cake. Decorations you add sit on its surface."
      wide
      onClose={onClose}
    >
      <div className="image-cake-workflow">
        {service !== "checking" && !configured && (
          <div className="service-notice" role="alert">
            <strong>
              {service === "unreachable"
                ? "The studio service could not be reached"
                : "Image-to-3D service not configured"}
            </strong>
            {service !== "unreachable" && (
              <p>
                No model can be generated until an image-to-3D API key is set on
                the server (<code>MESHY_API_KEY</code> or{" "}
                <code>TRIPO_API_KEY</code>). Nothing is simulated in its place.
                You can still import a .glb model below.
              </p>
            )}
          </div>
        )}
        <fieldset className="reference-views" disabled={busy}>
          <legend>
            {views.length > 1
              ? "Photographs · add more views for High Fidelity 3D"
              : "Photograph"}
          </legend>
          {views.map((view) => (
            <div key={view} className="reference-view">
              <label>
                {photos[view] ? (
                  <img
                    src={photos[view].url}
                    alt={`${viewLabels[view]} view`}
                  />
                ) : (
                  <ImagePlus size={30} aria-hidden />
                )}
                <span>
                  {viewLabels[view]} view
                  {view === "front" ? "" : " (optional)"}
                </span>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  aria-label={`${viewLabels[view]} view photograph`}
                  onChange={(e) => {
                    choose(view, e.target.files?.[0]);
                    e.target.value = "";
                  }}
                />
              </label>
              {photos[view] && (
                <button
                  type="button"
                  aria-label={`Remove ${viewLabels[view].toLowerCase()} view`}
                  onClick={() =>
                    setPhotos(({ [view]: _removed, ...rest }) => rest)
                  }
                >
                  <X size={13} />
                </button>
              )}
            </div>
          ))}
        </fieldset>
        <div className="reference-analysis">
          <Numeric
            label="Real width of the cake, including its board (in)"
            value={diameter}
            min={4}
            max={24}
            step={0.5}
            onChange={setDiameter}
          />
          <p>
            A photograph carries no scale, so this sets the model's size and the
            starting point for servings and price. It can be changed later.
          </p>
          {progress && (
            <div className="generation-progress" role="status">
              <span>
                {progressText[progress.state]}
                {progress.state === "running" && progress.progress > 0
                  ? ` ${Math.round(progress.progress)}%`
                  : ""}
              </span>
              <progress
                max={100}
                value={
                  progress.state === "running" ? progress.progress : undefined
                }
              />
              <small>
                This usually takes a few minutes. You can close this window; the
                result is kept and picked up when you return.
              </small>
            </div>
          )}
          {error && (
            <p role="alert" className="error-text">
              {error}
            </p>
          )}
          <label className="model-import">
            <Box size={16} aria-hidden />
            <span>Already have a 3D model? Import a .glb file</span>
            <input
              type="file"
              accept=".glb,model/gltf-binary"
              aria-label="Import a GLB model"
              disabled={busy}
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (file)
                  void run(
                    async (signal) => ({
                      modelUrl: await importModelFile(file, signal),
                      referenceImages: [],
                    }),
                    "imported",
                  );
              }}
            />
          </label>
        </div>
      </div>
      <div className="modal-actions">
        <Button
          variant="secondary"
          onClick={() => {
            if (busy && progress.state !== "importing") {
              // Stop waiting; the running job is abandoned, not resumed.
              pending.current?.abort();
              forgetPendingGeneration();
              setProgress(null);
            } else onClose();
          }}
        >
          {busy ? "Stop waiting" : "Cancel"}
        </Button>
        <Button
          disabled={!configured || !photos.front || busy}
          loading={busy}
          onClick={() =>
            void run(
              (signal) => generateModel(chosen, signal, setProgress),
              "generated",
            )
          }
        >
          <Sparkles size={16} />
          Generate 3D model
        </Button>
      </div>
    </Modal>
  );
}
