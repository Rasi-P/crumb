import { useEffect, useRef, useState } from "react";
import { ImagePlus, Sparkles } from "lucide-react";
import { Button, Field, Modal, Select } from "../components/ui";
import { Numeric } from "./ScenePanels";
import {
  getImageToCakeService,
  imageAnalysisSchema,
  type ImageAnalysis,
} from "./services/ImageToCakeService";
import { cakeSchema, type CakeConfig } from "../domain/models";
export function ImageCakeDialog({
  onClose,
  onApply,
}: {
  onClose: () => void;
  onApply: (c: CakeConfig) => void;
}) {
  const [url, setUrl] = useState(""),
    [analysis, setAnalysis] = useState<ImageAnalysis | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const pending = useRef<AbortController | null>(null);
  useEffect(
    () => () => {
      pending.current?.abort();
    },
    [],
  );
  useEffect(
    () => () => {
      if (url) URL.revokeObjectURL(url);
    },
    [url],
  );
  const upload = async (file?: File) => {
    if (!file) return;
    pending.current?.abort();
    const controller = new AbortController();
    pending.current = controller;
    setError("");
    setBusy(true);
    setAnalysis(null);
    try {
      if (
        !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
        file.size > 12 * 1024 * 1024
      )
        throw new Error("Choose a JPG, PNG, or WebP smaller than 12 MB.");
      setUrl(URL.createObjectURL(file));
      const result = await getImageToCakeService().analyzeImage(
        file,
        controller.signal,
      );
      if (!controller.signal.aborted)
        setAnalysis(imageAnalysisSchema.parse(result));
    } catch (e) {
      if (!controller.signal.aborted)
        setError(
          e instanceof Error ? e.message : "Unable to analyze photograph.",
        );
    } finally {
      if (!controller.signal.aborted) setBusy(false);
    }
  };
  const apply = async () => {
    if (!analysis) return;
    setBusy(true);
    try {
      const c = cakeSchema.parse(
        await getImageToCakeService().generateInitialCakeConfig(analysis),
      );
      onApply(c);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to create cake.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal
      title="Create from Cake Image"
      description="A reference is a starting point. Every part remains editable."
      wide
      onClose={onClose}
    >
      <div className="image-cake-workflow">
        <div className="reference-photo">
          {url ? (
            <img src={url} alt="Uploaded cake reference" />
          ) : (
            <ImagePlus size={48} />
          )}
          <Field label="Reference photograph">
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(e) => void upload(e.target.files?.[0])}
            />
          </Field>
          <p>JPG, PNG, WebP · up to 12 MB</p>
        </div>
        <div className="reference-analysis">
          {busy ? (
            <p role="status">Estimating cake structure…</p>
          ) : analysis ? (
            <>
              <span className="eyebrow">REVIEW THE STARTING POINT</span>
              <p className="analysis-confidence">
                {analysis.method} · {analysis.confidence} confidence
              </p>
              <Field label="Detected tiers">
                <Select
                  value={String(analysis.tiers.length)}
                  options={["1", "2", "3", "4"]}
                  onChange={(v) =>
                    setAnalysis({
                      ...analysis,
                      tiers: Array.from(
                        { length: Number(v) },
                        (_, i) =>
                          analysis.tiers[i] || {
                            ...analysis.tiers[0],
                            diameter: Math.max(4, 10 - i * 2),
                          },
                      ),
                    })
                  }
                />
              </Field>
              {analysis.tiers.map((t, i) => (
                <div key={i} className="reference-tier">
                  <strong>Tier {i + 1}</strong>
                  <div className="form-grid">
                    <Numeric
                      label={`Reference tier ${i + 1} diameter (in)`}
                      value={t.diameter}
                      min={4}
                      max={16}
                      onChange={(diameter) =>
                        setAnalysis({
                          ...analysis,
                          tiers: analysis.tiers.map((v, n) =>
                            n === i ? { ...v, diameter } : v,
                          ),
                        })
                      }
                    />
                    <Numeric
                      label={`Reference tier ${i + 1} height (in)`}
                      value={t.height}
                      min={2}
                      max={8}
                      onChange={(height) =>
                        setAnalysis({
                          ...analysis,
                          tiers: analysis.tiers.map((v, n) =>
                            n === i ? { ...v, height } : v,
                          ),
                        })
                      }
                    />
                  </div>
                  <Field label={`Reference tier ${i + 1} color`}>
                    <input
                      type="color"
                      value={t.color}
                      onChange={(e) =>
                        setAnalysis({
                          ...analysis,
                          tiers: analysis.tiers.map((v, n) =>
                            n === i ? { ...v, color: e.target.value } : v,
                          ),
                        })
                      }
                    />
                  </Field>
                </div>
              ))}
              <Field label="Reference decorations">
                <Select
                  value={analysis.decorations[0]?.assetId || "none"}
                  options={[
                    { value: "none", label: "None / add manually" },
                    { value: "rose-blush", label: "Pink roses" },
                    { value: "peony", label: "Ivory peonies" },
                    { value: "gold-pearl", label: "Gold pearls" },
                  ]}
                  onChange={(assetId) =>
                    setAnalysis({
                      ...analysis,
                      decorations:
                        assetId === "none"
                          ? []
                          : analysis.tiers.map((_, tierIndex) => ({
                              assetId,
                              tierIndex,
                              quantity: assetId === "gold-pearl" ? 36 : 3,
                            })),
                    })
                  }
                />
              </Field>
              <Field label="Reference topper text">
                <input
                  value={analysis.topper}
                  maxLength={50}
                  placeholder="Add wording from your reference"
                  onChange={(e) =>
                    setAnalysis({ ...analysis, topper: e.target.value })
                  }
                />
              </Field>
              <details>
                <summary>What the estimate can tell us</summary>
                {analysis.observations.map((o) => (
                  <p key={o}>{o}</p>
                ))}
              </details>
            </>
          ) : (
            <>
              <h3>Start with a cake you love</h3>
              <p>
                The local estimator samples colors and looks for tier
                boundaries. Review its suggestions before creating your cake.
              </p>
              <p>
                Flowers, sizes, and text can be added or corrected here. Hidden
                geometry is not reconstructed.
              </p>
            </>
          )}
          {error && (
            <p role="alert" className="error-text">
              {error}
            </p>
          )}
        </div>
      </div>
      <div className="modal-actions">
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button
          disabled={!analysis || busy}
          loading={busy}
          onClick={() => void apply()}
        >
          <Sparkles size={16} />
          Create editable cake
        </Button>
      </div>
    </Modal>
  );
}
