import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  Link,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  Box,
  CakeSlice,
  Check,
  CheckCheck,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Circle,
  Copy,
  Download,
  Eye,
  Flower2,
  Heart,
  Layers,
  Loader2,
  Maximize,
  Minus,
  MousePointer2,
  Move3D,
  Palette,
  PanelLeftClose,
  Pencil,
  Plus,
  Redo2,
  RotateCcw,
  RotateCw,
  Save,
  Send,
  Settings2,
  Shapes,
  SlidersHorizontal,
  Sparkles,
  Square,
  Type,
  Undo2,
  WandSparkles,
  X,
} from "lucide-react";
import { useData, useStore } from "../lib/store";
import {
  categories,
  materialNames,
  decorations,
  flavors,
  uid,
  type CakeConfig,
  type CakeObject,
  type Attachment,
  type Design,
  type Tier,
} from "../domain/models";
import { calculatePrice, inr, recipeFor } from "../domain/pricing";
import { defaultCake } from "../domain/seed";
import {
  Badge,
  Button,
  CakeImage,
  Field,
  IconButton,
  Modal,
  SearchInput,
  Select,
  Skeleton,
  Tabs,
} from "../components/ui";
import {
  normalizeCake,
  makeObject,
  serializeCake,
  deserializeCake,
} from "../domain/cakeScene";
import {
  AssetLibrary,
  LayerTree,
  SceneActions,
  ObjectInspector,
  TierDetails,
  LetteringDetails,
  Numeric,
} from "./ScenePanels";
import { ImageCakeDialog } from "./ImageCakeDialog";
import { Cake2D } from "./Cake2D";
import { QuoteForm } from "../pages/Quotations";
const Cake3D = lazy(() => import("./Cake3D"));

type HistoryState = {
  past: CakeConfig[];
  present: CakeConfig;
  future: CakeConfig[];
};
const swatches = [
  "#fff9ef",
  "#efd0d1",
  "#dda3b5",
  "#cdb9de",
  "#b4d3e1",
  "#a9baa0",
  "#dfc999",
  "#765047",
  "#303034",
  "#bd646e",
  "#e5bca2",
  "#e9dfd1",
];
export default function Studio() {
  const d = useData();
  const { id } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const command = useStore((s) => s.command);
  const source =
    d.designs.find((x) => x.id === (id || "design-aisha")) || d.designs[0];
  const [designId, setDesignId] = useState(source.template ? uid() : source.id);
  const [name, setName] = useState(
    source.template ? `${source.name} · My design` : source.name,
  );
  const [category, setCategory] = useState(source.category);
  const [imageIndex, setImageIndex] = useState(source.image);
  const [history, setHistory] = useState<HistoryState>({
    past: [],
    present: normalizeCake(source.config),
    future: [],
  });
  const config = history.present;
  const [mode, setMode] = useState("3D Preview");
  const [library, setLibrary] = useState("Templates");
  const [panel, setPanel] = useState("Design");
  const [selected, setSelected] = useState(
    config.tiers[config.tiers.length - 1].id,
  );
  const [search, setSearch] = useState("");
  const view = config.camera?.view || "Perspective";
  const [tool, setTool] = useState("select");
  const [fileError, setFileError] = useState("");
  const importInput = useRef<HTMLInputElement>(null);
  const zoom = config.camera?.zoom || 0;
  const [reset, setReset] = useState(0);
  const [autoRotate, setAutoRotate] = useState(false);
  const [modal, setModal] = useState("");
  const [mobilePanel, setMobilePanel] = useState<
    "none" | "library" | "properties"
  >("none");
  const [compact, setCompact] = useState(
    () => matchMedia("(max-width: 960px)").matches,
  );
  useEffect(() => {
    const query = matchMedia("(max-width: 960px)");
    const update = () => setCompact(query.matches);
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  useEffect(() => {
    if (!compact || mobilePanel === "none" || modal) return;
    const panel = document.querySelector<HTMLElement>(`.studio-${mobilePanel}`);
    if (!panel) return;
    const previous = document.activeElement as HTMLElement | null;
    const focusable = () =>
      Array.from(
        panel.querySelectorAll<HTMLElement>(
          'button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href], [tabindex="0"]',
        ),
      ).filter((el) => el.tabIndex >= 0 && el.getClientRects().length > 0);
    focusable()[0]?.focus({ preventScroll: true });
    const trap = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return;
      const items = focusable();
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    panel.addEventListener("keydown", trap);
    return () => {
      panel.removeEventListener("keydown", trap);
      previous?.focus({ preventScroll: true });
    };
  }, [compact, mobilePanel, modal]);
  const [saved, setSaved] = useState("Saved");
  const [version, setVersion] = useState(0);
  const [busy, setBusy] = useState(false);
  const latest = useRef({
    config,
    name,
    category,
    designId,
    imageIndex,
    version,
  });
  latest.current = { config, name, category, designId, imageIndex, version };
  const savedVersion = useRef(0);
  const mounted = useRef(true);
  const price = calculatePrice(config, d.business.margin, d.inventory);
  const selectedObject = config.objects?.find((o) => o.id === selected);
  const selectedTier =
    config.tiers.find(
      (t) => t.id === (selectedObject?.attachment.tierId || selected),
    ) || config.tiers[config.tiers.length - 1];
  const tierIndex = config.tiers.indexOf(selectedTier);
  const dirty = () => {
    setVersion((v) => v + 1);
    setSaved("Unsaved changes");
  };
  const change = useCallback(
    (next: CakeConfig | ((c: CakeConfig) => CakeConfig)) => {
      setHistory((h) => {
        const updated =
          typeof next === "function" ? next(structuredClone(h.present)) : next;
        return {
          past: [...h.past.slice(-49), h.present],
          present: normalizeCake(updated),
          future: [],
        };
      });
      setVersion((v) => v + 1);
      setSaved("Unsaved changes");
    },
    [],
  );
  const updateTier = (patch: Partial<Tier>) =>
    !selectedTier.locked &&
    change((c) => ({
      ...c,
      tiers: c.tiers.map((t) =>
        t.id === selectedTier.id ? { ...t, ...patch } : t,
      ),
    }));
  const setView = (view: NonNullable<CakeConfig["camera"]>["view"]) =>
    change((c) => ({ ...c, camera: { ...c.camera!, view } }));
  const setZoom = (update: number | ((n: number) => number)) =>
    change((c) => ({
      ...c,
      camera: {
        ...c.camera!,
        zoom: typeof update === "function" ? update(c.camera!.zoom) : update,
      },
    }));
  useEffect(() => {
    if (!selectedObject) setTool("select");
  }, [selectedObject?.id]);
  useEffect(() => {
    if (
      !["board", "text", "topper"].includes(selected) &&
      !config.tiers.some((t) => t.id === selected) &&
      !config.objects?.some((o) => o.id === selected)
    )
      setSelected(config.tiers.at(-1)!.id);
  }, [config, selected]);
  const updateObject = (object: CakeObject) =>
    change((c) => ({
      ...c,
      objects: c.objects!.map((o) => (o.id === object.id ? object : o)),
    }));
  const addObjects = (objects: CakeObject[]) => {
    change((c) => ({
      ...c,
      objects: [...(c.objects || []), ...objects].slice(0, 1500),
    }));
    setSelected(objects[0].id);
    setPanel("Design");
  };
  const placeAsset = (assetId: string, attachment: Attachment) =>
    addObjects([{ ...makeObject(assetId, attachment.tierId), attachment }]);
  const selectObject = (id: string) => {
    setSelected(id);
    setPanel("Design");
  };
  const exportConfig = () => {
    const url = URL.createObjectURL(
      new Blob([serializeCake({ ...config, cakeId: designId })], {
        type: "application/json",
      }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = `${name.replace(/[^a-z0-9]/gi, "-")}.cake.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const importConfig = async (file?: File) => {
    if (!file) return;
    try {
      if (file.size > 4_000_000) throw new Error("Cake file exceeds 4 MB");
      const c = deserializeCake(await file.text());
      change(c);
      setSelected(c.tiers.at(-1)!.id);
      setReset((v) => v + 1);
      setFileError("");
    } catch (e) {
      setFileError(e instanceof Error ? e.message : "Unable to read cake file");
    }
    if (importInput.current) importInput.current.value = "";
  };
  const save = useCallback(
    async (manual = false) => {
      const snapshot = latest.current;
      const design: Design = {
        id: snapshot.designId,
        name: snapshot.name.trim() || "Untitled celebration",
        category: snapshot.category,
        config: snapshot.config,
        image: snapshot.imageIndex,
        state: "Saved",
        favorite: source.favorite,
        template: false,
        updatedAt: new Date().toISOString(),
      };
      setSaved("Saving...");
      try {
        await command(
          { type: "design.save", value: design },
          manual ? "Design saved" : undefined,
        );
        savedVersion.current = snapshot.version;
        if (mounted.current && latest.current.version === snapshot.version)
          setSaved("Saved");
        if (
          mounted.current &&
          latest.current.designId === snapshot.designId &&
          window.location.pathname.startsWith("/studio") &&
          window.location.pathname !== `/studio/${snapshot.designId}`
        )
          navigate(`/studio/${snapshot.designId}${window.location.search}`, {
            replace: true,
          });
        try {
          localStorage.removeItem(`crumb-studio-recovery-${snapshot.designId}`);
        } catch {}
        return design;
      } catch (e) {
        if (mounted.current) setSaved("Save failed");
        throw e;
      }
    },
    [command, source.favorite, navigate],
  );
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    if (!id || id === latest.current.designId) return;
    const design = d.designs.find((x) => x.id === id);
    if (!design) return;
    setDesignId(design.template ? uid() : design.id);
    setName(design.template ? `${design.name} · My design` : design.name);
    setCategory(design.category);
    setImageIndex(design.image);
    setHistory({
      past: [],
      present: normalizeCake(design.config),
      future: [],
    });
    setSelected(design.config.tiers[design.config.tiers.length - 1].id);
    setVersion(0);
    savedVersion.current = 0;
    setSaved("Saved");
    setReset((r) => r + 1);
  }, [id]);
  useEffect(() => {
    if (!version || savedVersion.current === version) return;
    try {
      localStorage.setItem(
        `crumb-studio-recovery-${designId}`,
        JSON.stringify(latest.current),
      );
    } catch {}
    const timer = setTimeout(() => void save().catch(() => {}), 750);
    return () => clearTimeout(timer);
  }, [version, designId, save]);
  useEffect(() => {
    const leave = (e: BeforeUnloadEvent) => {
      if (latest.current.version !== savedVersion.current) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", leave);
    return () => window.removeEventListener("beforeunload", leave);
  }, []);
  const undo = useCallback(() => {
    setHistory((h) =>
      h.past.length
        ? {
            past: h.past.slice(0, -1),
            present: h.past[h.past.length - 1],
            future: [h.present, ...h.future],
          }
        : h,
    );
    setVersion((v) => v + 1);
    setSaved("Unsaved changes");
  }, []);
  const redo = useCallback(() => {
    setHistory((h) =>
      h.future.length
        ? {
            past: [...h.past, h.present],
            present: h.future[0],
            future: h.future.slice(1),
          }
        : h,
    );
    setVersion((v) => v + 1);
    setSaved("Unsaved changes");
  }, []);
  const deleteLayer = useCallback(() => {
    if (
      config.objects?.find((o) => o.id === selected)?.locked ||
      config.tiers.find((t) => t.id === selected)?.locked ||
      ((selected === "text" || selected === "topper") &&
        config.lettering?.[selected].locked)
    )
      return;
    if (config.objects?.some((o) => o.id === selected)) {
      change((c) => ({
        ...c,
        objects: c.objects!.filter((o) => o.id !== selected),
      }));
      setSelected(config.tiers.at(-1)!.id);
    } else if (selected === "text") change((c) => ({ ...c, text: "" }));
    else if (selected === "topper") change((c) => ({ ...c, topper: "" }));
    else if (selected.startsWith("dec:")) {
      const [, tierId, dec] = selected.split(":");
      change((c) => ({
        ...c,
        tiers: c.tiers.map((t) =>
          t.id === tierId
            ? { ...t, decorations: t.decorations.filter((d) => d !== dec) }
            : t,
        ),
      }));
    } else if (
      config.tiers.length > 1 &&
      config.tiers.some((t) => t.id === selected)
    ) {
      change((c) => ({
        ...c,
        tiers: c.tiers.filter((t) => t.id !== selected),
      }));
      setSelected(config.tiers[0].id);
    }
  }, [selected, config, change]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      const typing =
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        void save(true).catch(() => {});
      } else if (
        !typing &&
        (e.metaKey || e.ctrlKey) &&
        e.key.toLowerCase() === "z"
      ) {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      } else if (!typing && e.key === "Delete") {
        e.preventDefault();
        deleteLayer();
      } else if (e.key === "Escape") {
        setMobilePanel("none");
        setModal("");
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [save, undo, redo, deleteLayer]);
  const setTiers = (count: number) =>
    change((c) => {
      if (c.tiers.slice(count).some((t) => t.locked)) return c;
      const tiers = c.tiers.slice(0, count);
      while (tiers.length < count) {
        const i = tiers.length;
        tiers.push({
          ...structuredClone(tiers[tiers.length - 1]),
          id: uid(),
          diameter: Math.max(4, 10 - i * 2),
          height: 4,
          decorations: [],
        });
      }
      return { ...c, tiers, sellingPrice: null };
    });
  const loadTemplate = async (design: Design) => {
    if (version !== savedVersion.current) {
      try {
        await save();
      } catch {
        return;
      }
    }
    setDesignId(uid());
    setName(`${design.name} · My design`);
    setCategory(design.category);
    setImageIndex(design.image);
    setHistory({
      past: [],
      present: normalizeCake({ ...design.config, sellingPrice: null }),
      future: [],
    });
    setSelected(design.config.tiers[design.config.tiers.length - 1].id);
    setVersion((v) => v + 1);
    setSaved("Unsaved changes");
    setReset((v) => v + 1);
    setMobilePanel("none");
  };
  const duplicate = async () => {
    setBusy(true);
    try {
      const design = await save();
      const copy = { ...design, id: uid(), name: `${design.name} copy` };
      await command({ type: "design.save", value: copy }, "Design duplicated");
      navigate(`/studio/${copy.id}`);
    } catch {
    } finally {
      setBusy(false);
    }
  };
  const quote = async () => {
    setBusy(true);
    try {
      await save();
      setModal("quote");
    } catch {
    } finally {
      setBusy(false);
    }
  };
  const useForOrder = async () => {
    setBusy(true);
    try {
      const design = await save();
      const orderId = params.get("orderId");
      if (orderId) {
        const order = d.orders.find((o) => o.id === orderId)!;
        await command(
          {
            type: "order.save",
            value: {
              ...order,
              designId: design.id,
              cakeName: design.name,
              config: design.config,
              total: price.total,
              cost: price.cost,
            },
          },
          "Order design updated",
        );
        navigate(`/orders/${orderId}`);
      } else navigate(`/orders/new?design=${design.id}`);
    } catch {
    } finally {
      setBusy(false);
    }
  };
  const activeDesign: Design = {
    id: designId,
    name,
    category,
    config,
    image: imageIndex,
    state: "Saved",
    favorite: source.favorite,
    template: false,
    updatedAt: new Date().toISOString(),
  };
  return (
    <div className="studio-shell">
      <header className="studio-toolbar">
        <div className="studio-title-group">
          <Link to="/" className="studio-back" aria-label="Back to dashboard">
            <ArrowLeft size={18} />
          </Link>
          <Link
            to="/"
            className="studio-brand"
            aria-label="Crumb dashboard"
            title="Crumb dashboard"
          >
            <CakeSlice size={23} />
          </Link>
          <span className="toolbar-separator" />
          <div className="studio-document">
            <span className="eyebrow">CAKE STUDIO</span>
            <input
              aria-label="Design name"
              value={name}
              maxLength={100}
              onChange={(e) => {
                setName(e.target.value);
                dirty();
              }}
            />
          </div>
          <span
            className={`save-state ${saved === "Save failed" ? "error" : ""}`}
          >
            {saved === "Saving..." ? (
              <Loader2 size={12} className="spin" />
            ) : saved === "Saved" ? (
              <CheckCheck size={13} />
            ) : (
              <span className="save-dot" />
            )}
            {saved}
          </span>
        </div>
        <div className="studio-toolbar-actions">
          <div className="undo-group">
            <IconButton
              label="Undo"
              disabled={!history.past.length}
              onClick={undo}
            >
              <Undo2 size={18} />
            </IconButton>
            <IconButton
              label="Redo"
              disabled={!history.future.length}
              onClick={redo}
            >
              <Redo2 size={18} />
            </IconButton>
          </div>
          <IconButton label="Export cake JSON" onClick={exportConfig}>
            <Download size={17} />
          </IconButton>
          <IconButton
            label="Import cake JSON"
            onClick={() => importInput.current?.click()}
          >
            <Layers size={17} />
          </IconButton>
          <input
            type="file"
            accept=".json,application/json"
            hidden
            ref={importInput}
            onChange={(e) => void importConfig(e.target.files?.[0])}
          />
          <IconButton
            label="Duplicate design"
            onClick={() => void duplicate()}
            disabled={busy}
          >
            <Copy size={17} />
          </IconButton>
          <Button
            variant="secondary"
            onClick={() => void save(true).catch(() => {})}
          >
            <Save size={15} />
            <span>Save</span>
          </Button>
          <Button variant="secondary" onClick={() => setModal("preview")}>
            <Eye size={16} />
            <span>Preview</span>
          </Button>
          <Button loading={busy} onClick={() => void quote()}>
            <Send size={15} />
            <span>Generate quote</span>
          </Button>
        </div>
      </header>
      {fileError && (
        <div className="studio-file-error" role="alert">
          {fileError}
          <button onClick={() => setFileError("")}>Dismiss</button>
        </div>
      )}
      <div className="studio-body">
        <aside
          className={`studio-library ${mobilePanel === "library" ? "mobile-visible" : ""}`}
          inert={compact && mobilePanel !== "library"}
          role={compact ? "dialog" : undefined}
          aria-modal={compact && mobilePanel === "library" ? true : undefined}
          aria-label="Cake components and templates"
        >
          <div className="studio-panel-mobile-heading">
            <strong>A little inspiration</strong>
            <IconButton
              label="Close library"
              onClick={() => setMobilePanel("none")}
            >
              <X size={17} />
            </IconButton>
          </div>
          <Tabs
            options={["Templates", "Elements", "Layers"]}
            value={library}
            onChange={setLibrary}
          />
          {library === "Templates" ? (
            <>
              <div className="studio-library-heading">
                <h3>A lovely place to start</h3>
                <p>Make a favorite your own.</p>
                <SearchInput
                  value={search}
                  onChange={setSearch}
                  placeholder="Find a template..."
                />
              </div>
              <button
                className="reference-import"
                onClick={() => setModal("image")}
              >
                <WandSparkles size={19} />
                <span>
                  <strong>Create from Cake Image</strong>
                  <small>Turn a reference into an editable start</small>
                </span>
                <Plus size={14} />
              </button>
              <div className="template-grid">
                {d.designs
                  .filter(
                    (x) =>
                      x.template &&
                      x.name.toLowerCase().includes(search.toLowerCase()),
                  )
                  .map((template) => (
                    <button
                      key={template.id}
                      onClick={() => void loadTemplate(template)}
                    >
                      <CakeImage index={template.image} label={template.name} />
                      <strong>{template.name}</strong>
                      <small>
                        {template.config.tiers.length} tier
                        {template.config.tiers.length > 1 ? "s" : ""} ·{" "}
                        {inr(
                          calculatePrice(
                            template.config,
                            d.business.margin,
                            d.inventory,
                          ).selling,
                        )}
                      </small>
                    </button>
                  ))}
              </div>
              <button
                className="start-scratch"
                onClick={() =>
                  void loadTemplate({
                    ...activeDesign,
                    name: "Untitled celebration",
                    config: {
                      ...defaultCake(),
                      tiers: [
                        {
                          ...defaultCake().tiers[0],
                          color: "#fff9ef",
                          decorations: [],
                        },
                      ],
                      text: "",
                      topper: "",
                      sellingPrice: null,
                      delivery: 0,
                    },
                  })
                }
              >
                <Plus size={16} />A fresh little canvas
              </button>
            </>
          ) : library === "Elements" ? (
            <div className="element-library">
              <div className="studio-section">
                <h3>Cake shape</h3>
                <div className="shape-picker">
                  {(
                    ["Round", "Square", "Heart", "Number", "Custom"] as const
                  ).map((shape) => (
                    <button
                      key={shape}
                      aria-label={shape}
                      className={config.shape === shape ? "selected" : ""}
                      onClick={() =>
                        change((c) => ({
                          ...c,
                          shape,
                          tiers: c.tiers.map((t) => ({
                            ...t,
                            shape: t.locked ? (t.shape ?? c.shape) : shape,
                          })),
                        }))
                      }
                    >
                      {shape === "Round" ? (
                        <Circle size={21} />
                      ) : shape === "Square" ? (
                        <Square size={21} />
                      ) : shape === "Heart" ? (
                        <Heart size={21} />
                      ) : shape === "Number" ? (
                        <span className="number-icon">12</span>
                      ) : (
                        <Shapes size={21} />
                      )}
                      <span>{shape}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div className="studio-section">
                <h3>Tiers</h3>
                <div className="tier-count-picker">
                  {[1, 2, 3, 4].map((count) => (
                    <button
                      key={count}
                      className={
                        config.tiers.length === count ? "selected" : ""
                      }
                      disabled={config.tiers.slice(count).some((t) => t.locked)}
                      onClick={() => setTiers(count)}
                    >
                      {count}
                      <small>{count === 1 ? "tier" : "tiers"}</small>
                    </button>
                  ))}
                </div>
              </div>
              <AssetLibrary tierId={selectedTier.id} onAdd={addObjects} />
              <div className="studio-section">
                <h3>Say it with cake</h3>
                <Button
                  variant="secondary"
                  onClick={() => {
                    change((c) => ({ ...c, text: c.text || "Happy Birthday" }));
                    setSelected("text");
                    setPanel("Design");
                    setMobilePanel("properties");
                  }}
                >
                  <Type size={16} />
                  Add lettering
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => {
                    change((c) => ({
                      ...c,
                      topper: c.topper || "Happy Birthday",
                    }));
                    setSelected("topper");
                    setMobilePanel("properties");
                  }}
                >
                  <Sparkles size={16} />
                  Add a topper
                </Button>
              </div>
            </div>
          ) : (
            <LayerTree
              config={config}
              selected={selected}
              onSelect={selectObject}
            />
          )}
        </aside>
        <main className="studio-canvas">
          <div className="canvas-topbar">
            <Tabs
              className="segmented studio-modes"
              options={["2D Design", "3D Preview"]}
              value={mode}
              onChange={setMode}
            />
            <div className="studio-mobile-undo">
              <IconButton
                label="Undo"
                disabled={!history.past.length}
                onClick={undo}
              >
                <Undo2 size={16} />
              </IconButton>
              <IconButton
                label="Redo"
                disabled={!history.future.length}
                onClick={redo}
              >
                <Redo2 size={16} />
              </IconButton>
            </div>
            <div className="canvas-label">
              <span className="online-dot" />
              Your imagination, taking shape
            </div>
            <IconButton
              label="Fullscreen preview"
              onClick={() => setModal("preview")}
            >
              <Maximize size={17} />
            </IconButton>
          </div>
          {mode === "3D Preview" && (
            <div className="scene-toolstrip" aria-label="3D editing tools">
              {["select", "move", "rotate", "scale"].map((t) => (
                <button
                  key={t}
                  aria-label={`${t[0].toUpperCase() + t.slice(1)} tool`}
                  aria-pressed={tool === t}
                  className={tool === t ? "active" : ""}
                  disabled={t !== "select" && !selectedObject}
                  onClick={() => setTool(t)}
                >
                  {t === "select" ? (
                    <MousePointer2 size={16} />
                  ) : t === "move" ? (
                    <Move3D size={16} />
                  ) : t === "rotate" ? (
                    <RotateCw size={16} />
                  ) : (
                    <Maximize size={16} />
                  )}
                  <span>{t[0].toUpperCase() + t.slice(1)}</span>
                </button>
              ))}
            </div>
          )}
          {selectedObject && mode === "3D Preview" && (
            <div className="scene-hint">
              {tool === "move"
                ? "Drag across a tier to place on its surface"
                : `${selectedObject.name} · Attached to tier ${config.tiers.findIndex((t) => t.id === selectedObject.attachment.tierId) + 1}`}
            </div>
          )}
          <div className="canvas-renderer">
            {mode === "3D Preview" ? (
              <Suspense
                fallback={
                  <div className="canvas-loading">
                    <Loader2 className="spin" size={24} />
                    <span>A little magic is taking shape...</span>
                  </div>
                }
              >
                <Cake3D
                  config={config}
                  selected={selected}
                  onSelect={selectObject}
                  view={view}
                  zoom={zoom}
                  reset={reset}
                  autoRotate={autoRotate}
                  tool={tool}
                  onObjectChange={updateObject}
                  onPlace={placeAsset}
                />
              </Suspense>
            ) : (
              <div
                className="design-2d-stage"
                style={{ transform: `scale(${1 + zoom * 0.08})` }}
              >
                <Cake2D
                  config={config}
                  selected={selected}
                  onSelect={selectObject}
                />
              </div>
            )}
          </div>
          <div className="canvas-bottom-controls">
            <div className="camera-views">
              {mode === "3D Preview" &&
                ["Perspective", "Front", "Side", "Top", "Close-up"].map((v) => (
                  <button
                    key={v}
                    aria-label={v}
                    title={`${v} view`}
                    className={view === v ? "active" : ""}
                    onClick={() => setView(v as typeof view)}
                  >
                    {v === "Perspective" ? <Box size={15} /> : v}
                  </button>
                ))}
            </div>
            <div className="zoom-controls">
              <IconButton
                label="Zoom out"
                disabled={zoom <= -3}
                onClick={() => setZoom((z) => z - 1)}
              >
                <Minus size={16} />
              </IconButton>
              <span>{100 + zoom * 13}%</span>
              <IconButton
                label="Zoom in"
                disabled={zoom >= 8}
                onClick={() => setZoom((z) => z + 1)}
              >
                <Plus size={16} />
              </IconButton>
              <span className="toolbar-separator" />
              <IconButton
                label="Reset view"
                onClick={() => {
                  setView("Perspective");
                  setZoom(0);
                  setReset((r) => r + 1);
                }}
              >
                <RotateCcw size={16} />
              </IconButton>
              {mode === "3D Preview" && (
                <IconButton
                  label={autoRotate ? "Pause rotation" : "Auto rotate"}
                  className={autoRotate ? "active" : ""}
                  onClick={() => setAutoRotate(!autoRotate)}
                >
                  <RotateCw size={16} />
                </IconButton>
              )}
            </div>
          </div>
          <div className="canvas-status">
            <span>
              {config.shape} cake<span>·</span>
              {config.tiers.length} tiers<span>·</span>
              {price.servings} servings
            </span>
            <span>{config.tiers.map((t) => `${t.diameter}″`).join(" + ")}</span>
          </div>
        </main>
        <aside
          className={`studio-properties ${mobilePanel === "properties" ? "mobile-visible" : ""}`}
          inert={compact && mobilePanel !== "properties"}
          role={compact ? "dialog" : undefined}
          aria-modal={
            compact && mobilePanel === "properties" ? true : undefined
          }
          aria-label="Cake properties and pricing"
        >
          <div className="studio-panel-mobile-heading">
            <strong>The finishing touches</strong>
            <IconButton
              label="Close properties"
              onClick={() => setMobilePanel("none")}
            >
              <X size={17} />
            </IconButton>
          </div>
          <Tabs
            options={["Design", "Pricing"]}
            value={panel}
            onChange={setPanel}
          />
          {panel === "Design" ? (
            <div className="properties-scroll">
              <div className="selected-object">
                <span className="selected-icon">
                  {selectedObject ? (
                    <Flower2 size={17} />
                  ) : selected === "text" ? (
                    <Type size={17} />
                  ) : selected === "topper" ? (
                    <Sparkles size={17} />
                  ) : (
                    <Layers size={17} />
                  )}
                </span>
                <span>
                  <small>SELECTED</small>
                  <strong>
                    {selectedObject
                      ? selectedObject.name
                      : selected === "text"
                        ? "Cake lettering"
                        : selected === "topper"
                          ? "Custom topper"
                          : selected === "board"
                            ? "Cake board"
                            : `${tierIndex === 0 ? "Bottom" : tierIndex === config.tiers.length - 1 ? "Top" : `Middle`} tier`}
                  </strong>
                </span>
                <Select
                  label="Selected layer"
                  value={selected}
                  onChange={setSelected}
                  options={[
                    ...config.tiers.map((t, i) => ({
                      value: t.id,
                      label: `Tier ${i + 1} · ${t.diameter}″`,
                    })),
                    ...(config.objects || []).map((o) => ({
                      value: o.id,
                      label: o.name,
                    })),
                    { value: "text", label: "Lettering" },
                    { value: "topper", label: "Topper" },
                    { value: "board", label: "Cake board" },
                  ]}
                />
              </div>
              <SceneActions
                config={config}
                selected={selected}
                onChange={change}
                onSelect={selectObject}
              />
              {selectedObject ? (
                <ObjectInspector
                  object={selectedObject}
                  config={config}
                  onChange={updateObject}
                />
              ) : selected === "text" ? (
                <fieldset
                  disabled={config.lettering!.text.locked}
                  className="studio-section"
                >
                  <Field label="Your message">
                    <textarea
                      rows={3}
                      maxLength={80}
                      value={config.text}
                      onChange={(e) =>
                        change((c) => ({ ...c, text: e.target.value }))
                      }
                    />
                  </Field>
                  <Field label="Lettering style">
                    <Select
                      value={config.textStyle}
                      onChange={(v) =>
                        change((c) => ({
                          ...c,
                          textStyle: v as CakeConfig["textStyle"],
                          lettering: {
                            ...c.lettering!,
                            text: {
                              ...c.lettering!.text,
                              font: v === "Modern" ? "helvetiker" : "optimer",
                            },
                          },
                        }))
                      }
                      options={["Elegant", "Modern", "Playful"]}
                    />
                  </Field>
                  <Field label="Size">
                    <input
                      type="range"
                      min="12"
                      max="40"
                      value={config.textSize}
                      onChange={(e) =>
                        change((c) => ({
                          ...c,
                          textSize: Number(e.target.value),
                        }))
                      }
                    />
                  </Field>
                  <Field label="Lettering color">
                    <input
                      type="color"
                      value={config.textColor}
                      onChange={(e) =>
                        change((c) => ({ ...c, textColor: e.target.value }))
                      }
                    />
                  </Field>
                </fieldset>
              ) : selected === "topper" ? (
                <fieldset
                  disabled={config.lettering!.topper.locked}
                  className="studio-section"
                >
                  <Field label="Topper">
                    <Select
                      value={
                        [
                          "Happy Birthday",
                          "Happy Anniversary",
                          "Love",
                          "Oh Baby",
                        ].includes(config.topper)
                          ? config.topper
                          : "Custom"
                      }
                      onChange={(v) =>
                        change((c) => ({
                          ...c,
                          topper: v === "Custom" ? "Your name" : v,
                        }))
                      }
                      options={[
                        "Happy Birthday",
                        "Happy Anniversary",
                        "Love",
                        "Oh Baby",
                        "Custom",
                      ]}
                    />
                  </Field>
                  <Field label="Topper text">
                    <input
                      value={config.topper}
                      maxLength={50}
                      onChange={(e) =>
                        change((c) => ({ ...c, topper: e.target.value }))
                      }
                    />
                  </Field>
                  <Button
                    variant="ghost"
                    onClick={() => change((c) => ({ ...c, topper: "" }))}
                  >
                    Remove topper
                  </Button>
                </fieldset>
              ) : selected === "board" ? (
                <div className="studio-section">
                  <Numeric
                    label="Board diameter (in)"
                    min={4}
                    max={24}
                    value={config.board!.diameter}
                    onChange={(diameter) =>
                      change((c) => ({
                        ...c,
                        board: { ...c.board!, diameter },
                      }))
                    }
                  />
                  <Numeric
                    label="Board thickness (in)"
                    min={0.1}
                    max={1}
                    value={config.board!.thickness}
                    onChange={(thickness) =>
                      change((c) => ({
                        ...c,
                        board: { ...c.board!, thickness },
                      }))
                    }
                  />
                  <Field label="Board material">
                    <Select
                      value={config.board!.material}
                      options={[...materialNames]}
                      onChange={(material) =>
                        change((c) => ({
                          ...c,
                          board: {
                            ...c.board!,
                            material: material as NonNullable<
                              CakeConfig["board"]
                            >["material"],
                          },
                        }))
                      }
                    />
                  </Field>
                  <p className="small-copy muted">
                    The board grows to support wider tiers.
                  </p>
                  <Field label="Board color">
                    <input
                      type="color"
                      value={config.boardColor}
                      onChange={(e) =>
                        change((c) => ({ ...c, boardColor: e.target.value }))
                      }
                    />
                  </Field>
                </div>
              ) : (
                <fieldset
                  className="tier-properties"
                  disabled={selectedTier.locked}
                >
                  <div className="studio-section">
                    <Field label="Shape">
                      <Select
                        value={selectedTier.shape ?? config.shape}
                        onChange={(v) =>
                          updateTier({ shape: v as CakeConfig["shape"] })
                        }
                        options={[
                          "Round",
                          "Square",
                          "Heart",
                          "Number",
                          "Custom",
                        ]}
                      />
                    </Field>
                    {(selectedTier.shape ?? config.shape) === "Number" && (
                      <Field label="Number">
                        <input
                          maxLength={2}
                          inputMode="numeric"
                          value={config.number}
                          onChange={(e) =>
                            change((c) => ({
                              ...c,
                              number: e.target.value.replace(/\D/g, ""),
                            }))
                          }
                        />
                      </Field>
                    )}
                    <div className="form-grid">
                      <Field label="Diameter">
                        <div className="unit-input">
                          <input
                            aria-label="Tier diameter"
                            type="number"
                            min="4"
                            max="16"
                            step="1"
                            value={selectedTier.diameter}
                            onChange={(e) => {
                              const value = Number(e.target.value);
                              if (value >= 4 && value <= 16)
                                updateTier({ diameter: value });
                            }}
                          />
                          <span>in</span>
                        </div>
                      </Field>
                      <Field label="Height">
                        <div className="unit-input">
                          <input
                            aria-label="Tier height"
                            type="number"
                            min="2"
                            max="8"
                            step=".5"
                            value={selectedTier.height}
                            onChange={(e) => {
                              const value = Number(e.target.value);
                              if (value >= 2 && value <= 8)
                                updateTier({ height: value });
                            }}
                          />
                          <span>in</span>
                        </div>
                      </Field>
                    </div>
                  </div>
                  <div className="studio-section">
                    <h3>A little color</h3>
                    <div className="color-swatches">
                      {swatches.map((color) => (
                        <button
                          key={color}
                          className={
                            selectedTier.color === color ? "selected" : ""
                          }
                          style={{ background: color }}
                          aria-label={`Use color ${color}`}
                          onClick={() => updateTier({ color })}
                        >
                          {selectedTier.color === color && (
                            <Check
                              size={13}
                              style={{
                                color:
                                  color === "#303034" || color === "#765047"
                                    ? "white"
                                    : "#5f4b68",
                              }}
                            />
                          )}
                        </button>
                      ))}
                    </div>
                    <div className="custom-color">
                      <input
                        aria-label="Custom frosting color"
                        type="color"
                        value={selectedTier.color}
                        onChange={(e) => updateTier({ color: e.target.value })}
                      />
                      <span>{selectedTier.color.toUpperCase()}</span>
                      <span>100%</span>
                    </div>
                  </div>
                  <div className="studio-section">
                    <Field label="Frosting">
                      <Select
                        value={selectedTier.frosting}
                        onChange={(v) =>
                          updateTier({ frosting: v as Tier["frosting"] })
                        }
                        options={[
                          "Buttercream",
                          "Fondant",
                          "Ganache",
                          "Whipped Cream",
                        ]}
                      />
                    </Field>
                    <Field label="Finish">
                      <Select
                        value={selectedTier.finish}
                        onChange={(v) =>
                          updateTier({ finish: v as Tier["finish"] })
                        }
                        options={[
                          "Smooth",
                          "Textured",
                          "Vintage",
                          "Minimal",
                          "Ruffled",
                          "Drip",
                          "Rough",
                          "Semi-naked",
                          "Naked",
                          "Piped",
                        ]}
                      />
                    </Field>
                  </div>
                  <TierDetails tier={selectedTier} onChange={updateTier} />
                  <div className="studio-section">
                    <Button
                      variant="secondary"
                      onClick={() => {
                        setLibrary("Elements");
                        setMobilePanel("library");
                      }}
                    >
                      <Plus size={14} />
                      Add decorations
                    </Button>
                  </div>
                </fieldset>
              )}
              {(selected === "text" || selected === "topper") && (
                <LetteringDetails
                  config={config}
                  kind={selected}
                  onChange={change}
                />
              )}
              <div className="studio-section">
                <details>
                  <summary>Studio environment</summary>
                  <Field label="Background color">
                    <input
                      type="color"
                      value={config.background!.color}
                      onChange={(e) =>
                        change((c) => ({
                          ...c,
                          background: {
                            ...c.background!,
                            color: e.target.value,
                          },
                        }))
                      }
                    />
                  </Field>
                  <Numeric
                    label="Exposure"
                    min={0.4}
                    max={2}
                    step={0.05}
                    value={config.background!.exposure}
                    onChange={(exposure) =>
                      change((c) => ({
                        ...c,
                        background: { ...c.background!, exposure },
                      }))
                    }
                  />
                </details>
              </div>
              <div className="studio-section">
                <Field label="Cake flavor">
                  <Select
                    value={config.flavor}
                    onChange={(v) => change((c) => ({ ...c, flavor: v }))}
                    options={flavors}
                  />
                </Field>
                <Field label="Collection">
                  <Select
                    value={category}
                    onChange={(v) => {
                      setCategory(v);
                      dirty();
                    }}
                    options={categories}
                  />
                </Field>
              </div>
            </div>
          ) : (
            <div className="properties-scroll">
              <div className="studio-section">
                <span className="eyebrow">A FAIR PRICE FOR YOUR CRAFT</span>
                <h3>Every little detail adds up.</h3>
                <div className="price-lines studio-price-lines">
                  {price.lines.map((l) => (
                    <div key={l.label}>
                      <span>{l.label}</span>
                      <strong>{inr(l.amount)}</strong>
                    </div>
                  ))}
                  <div className="price-total">
                    <span>Production cost</span>
                    <strong>{inr(price.cost)}</strong>
                  </div>
                </div>
                <Field
                  label="Selling price (₹)"
                  hint={`Suggested ${inr(price.suggested)}`}
                >
                  <input
                    aria-label="Selling price override"
                    type="number"
                    min="0"
                    max="1000000"
                    value={config.sellingPrice ?? ""}
                    placeholder={String(price.suggested)}
                    onChange={(e) =>
                      change((c) => ({
                        ...c,
                        sellingPrice:
                          e.target.value === ""
                            ? null
                            : Math.max(0, Number(e.target.value)),
                      }))
                    }
                  />
                </Field>
                <Field label="Delivery fee (₹)">
                  <input
                    type="number"
                    min="0"
                    max="100000"
                    value={config.delivery}
                    onChange={(e) =>
                      change((c) => ({
                        ...c,
                        delivery: Math.max(0, Number(e.target.value)),
                      }))
                    }
                  />
                </Field>
                <div className="form-grid">
                  <Field label="Discount (₹)">
                    <input
                      type="number"
                      min="0"
                      max={price.selling}
                      value={config.discount}
                      onChange={(e) =>
                        change((c) => ({
                          ...c,
                          discount: Math.max(0, Number(e.target.value)),
                        }))
                      }
                    />
                  </Field>
                  <Field label="Tax (%)">
                    <input
                      type="number"
                      min="0"
                      max="40"
                      value={config.tax}
                      onChange={(e) =>
                        change((c) => ({
                          ...c,
                          tax: Math.min(
                            40,
                            Math.max(0, Number(e.target.value)),
                          ),
                        }))
                      }
                    />
                  </Field>
                </div>
                <div className="studio-profit">
                  <div>
                    <span>Estimated profit</span>
                    <strong>{inr(price.profit)}</strong>
                  </div>
                  <div>
                    <span>Margin</span>
                    <strong>{price.margin.toFixed(1)}%</strong>
                  </div>
                </div>
              </div>
              <div className="studio-section">
                <details>
                  <summary>Recipe ingredients</summary>
                  <div className="recipe-list">
                    {recipeFor(config).map((i) => (
                      <div key={i.name}>
                        <span>{i.name}</span>
                        <strong>
                          {i.quantity} {i.unit}
                        </strong>
                      </div>
                    ))}
                  </div>
                </details>
              </div>
            </div>
          )}
          <div className="studio-price-footer">
            <div>
              <span>Estimated selling price</span>
              <strong>{inr(price.total)}</strong>
            </div>
            <small>
              {price.servings} servings<span>·</span>
              {inr(price.profit)} estimated profit
            </small>
            <Button onClick={() => void useForOrder()} loading={busy}>
              <ShoppingBagIcon />
              {params.has("orderId")
                ? "Update order"
                : params.has("order")
                  ? "Use this cake"
                  : "Create order"}
              <ArrowRight size={15} />
            </Button>
          </div>
        </aside>
      </div>
      <div className="studio-mobile-toolbar">
        <button onClick={() => setMobilePanel("library")}>
          <Shapes size={19} />
          <span>Elements</span>
        </button>
        <button
          onClick={() => {
            setLibrary("Templates");
            setMobilePanel("library");
          }}
        >
          <Layers size={19} />
          <span>Templates</span>
        </button>
        <button onClick={() => setMobilePanel("properties")}>
          <SlidersHorizontal size={19} />
          <span>Customize</span>
        </button>
        <button
          onClick={() => {
            setPanel("Pricing");
            setMobilePanel("properties");
          }}
        >
          <span className="mobile-price">{inr(price.total)}</span>
          <span>Pricing</span>
        </button>
      </div>
      {mobilePanel !== "none" && (
        <div
          className="studio-mobile-backdrop"
          onClick={() => setMobilePanel("none")}
        />
      )}
      {modal === "image" && (
        <ImageCakeDialog
          onClose={() => setModal("")}
          onApply={(c) => {
            change(c);
            setSelected(c.tiers.at(-1)!.id);
            setModal("");
            setReset((r) => r + 1);
          }}
        />
      )}
      {modal === "quote" && (
        <QuoteForm
          design={activeDesign}
          orderId={params.get("orderId") || undefined}
          customerId={
            d.orders.find((o) => o.id === params.get("orderId"))?.customerId
          }
          onClose={() => setModal("")}
        />
      )}{" "}
      {modal === "preview" && (
        <Modal
          title={name}
          description={`${config.flavor} · ${config.tiers.map((t) => `${t.diameter}″`).join(" + ")} · ${price.servings} servings`}
          wide
          onClose={() => setModal("")}
        >
          <div className="studio-preview-modal">
            <Suspense fallback={<Skeleton rows={2} />}>
              <Cake3D config={config} autoRotate />
            </Suspense>
          </div>
          <div className="modal-actions">
            <strong>{inr(price.total)}</strong>
            <Button
              variant="secondary"
              onClick={() => {
                setMode("3D Preview");
                setModal("");
              }}
            >
              Back to studio
            </Button>
            <Button onClick={() => void quote()}>
              <Send size={15} />
              Generate quote
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
function ShoppingBagIcon() {
  return <CakeSlice size={15} />;
}
