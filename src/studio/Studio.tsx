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
  decorations,
  flavors,
  uid,
  type CakeConfig,
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
    present: structuredClone(source.config),
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
  const [view, setView] = useState("Perspective");
  const [zoom, setZoom] = useState(0);
  const [reset, setReset] = useState(0);
  const [autoRotate, setAutoRotate] = useState(false);
  const [modal, setModal] = useState("");
  const [mobilePanel, setMobilePanel] = useState<
    "none" | "library" | "properties"
  >("none");
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
  const selectedTier =
    config.tiers.find((t) => t.id === selected) ||
    config.tiers[config.tiers.length - 1];
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
          present: updated,
          future: [],
        };
      });
      setVersion((v) => v + 1);
      setSaved("Unsaved changes");
    },
    [],
  );
  const updateTier = (patch: Partial<Tier>) =>
    change((c) => ({
      ...c,
      tiers: c.tiers.map((t) =>
        t.id === selectedTier.id ? { ...t, ...patch } : t,
      ),
    }));
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
      present: structuredClone(design.config),
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
    if (selected === "text") change((c) => ({ ...c, text: "" }));
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
  }, [selected, config.tiers, change]);
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
      present: { ...structuredClone(design.config), sellingPrice: null },
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
      <div className="studio-body">
        <aside
          className={`studio-library ${mobilePanel === "library" ? "mobile-visible" : ""}`}
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
                      onClick={() => change((c) => ({ ...c, shape }))}
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
                      onClick={() => setTiers(count)}
                    >
                      {count}
                      <small>{count === 1 ? "tier" : "tiers"}</small>
                    </button>
                  ))}
                </div>
              </div>
              <div className="studio-section">
                <h3>The little extras</h3>
                <div className="decorations-picker">
                  {decorations.map((dec) => (
                    <button
                      key={dec}
                      className={
                        selectedTier.decorations.includes(dec) ? "selected" : ""
                      }
                      onClick={() =>
                        updateTier({
                          decorations: selectedTier.decorations.includes(dec)
                            ? selectedTier.decorations.filter((x) => x !== dec)
                            : [...selectedTier.decorations, dec],
                        })
                      }
                    >
                      <span
                        className={`decor-preview decor-${dec.toLowerCase().replace(" ", "-")}`}
                      >
                        {dec === "Roses" || dec === "Flowers" ? (
                          <Flower2 size={24} />
                        ) : dec === "Pearls" ? (
                          <span className="pearl-swatch" />
                        ) : dec === "Gold accents" ? (
                          <Sparkles size={23} />
                        ) : dec === "Ribbons" ? (
                          <span className="ribbon-swatch" />
                        ) : dec === "Sprinkles" ? (
                          <span className="sprinkle-swatch" />
                        ) : (
                          <CakeSlice size={22} />
                        )}
                      </span>
                      <span>{dec}</span>
                      {selectedTier.decorations.includes(dec) && (
                        <Check size={12} />
                      )}
                    </button>
                  ))}
                </div>
              </div>
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
            <div className="layers-panel">
              <div className="studio-library-heading">
                <h3>All the lovely layers</h3>
                <p>{config.tiers.length} tiers, countless little details.</p>
              </div>
              {config.text && (
                <button
                  className={selected === "text" ? "selected" : ""}
                  onClick={() => {
                    setSelected("text");
                    setPanel("Design");
                  }}
                >
                  <Type size={16} />
                  <span>{config.text}</span>
                  <Eye size={13} />
                </button>
              )}
              {config.topper && (
                <button
                  className={selected === "topper" ? "selected" : ""}
                  onClick={() => setSelected("topper")}
                >
                  <Sparkles size={16} />
                  <span>{config.topper}</span>
                  <Eye size={13} />
                </button>
              )}
              {[...config.tiers].reverse().map((tier, i) => (
                <div key={tier.id}>
                  <button
                    className={selected === tier.id ? "selected" : ""}
                    onClick={() => {
                      setSelected(tier.id);
                      setPanel("Design");
                    }}
                  >
                    <Layers size={16} />
                    <span>
                      {i === 0
                        ? "Top tier"
                        : i === config.tiers.length - 1
                          ? "Bottom tier"
                          : `Tier ${config.tiers.length - i}`}
                    </span>
                    <span
                      className="tiny-color"
                      style={{ background: tier.color }}
                    />
                  </button>
                  {tier.decorations.map((dec) => (
                    <button
                      className={`dec-layer ${selected === `dec:${tier.id}:${dec}` ? "selected" : ""}`}
                      key={dec}
                      onClick={() => setSelected(`dec:${tier.id}:${dec}`)}
                    >
                      <Flower2 size={13} />
                      <span>{dec}</span>
                      <Eye size={12} />
                    </button>
                  ))}
                </div>
              ))}
              <button
                onClick={() => setSelected("board")}
                className={selected === "board" ? "selected" : ""}
              >
                <Circle size={16} />
                <span>Cake board</span>
              </button>
              <Button
                variant="ghost"
                onClick={deleteLayer}
                disabled={
                  selected === "board" ||
                  (config.tiers.length === 1 && selected === config.tiers[0].id)
                }
              >
                Remove selected layer
              </Button>
            </div>
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
                  onSelect={setSelected}
                  view={view}
                  zoom={zoom}
                  reset={reset}
                  autoRotate={autoRotate}
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
                  onSelect={setSelected}
                />
              </div>
            )}
          </div>
          <div className="canvas-bottom-controls">
            <div className="camera-views">
              {mode === "3D Preview" &&
                ["Perspective", "Front", "Side", "Top"].map((v) => (
                  <button
                    key={v}
                    aria-label={v}
                    title={`${v} view`}
                    className={view === v ? "active" : ""}
                    onClick={() => setView(v)}
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
                  {selected === "text" ? (
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
                    {selected === "text"
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
                    { value: "text", label: "Lettering" },
                    { value: "topper", label: "Topper" },
                    { value: "board", label: "Cake board" },
                  ]}
                />
              </div>
              {selected === "text" ? (
                <div className="studio-section">
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
                </div>
              ) : selected === "topper" ? (
                <div className="studio-section">
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
                </div>
              ) : selected === "board" ? (
                <div className="studio-section">
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
                <>
                  <div className="studio-section">
                    <Field label="Shape">
                      <Select
                        value={config.shape}
                        onChange={(v) =>
                          change((c) => ({
                            ...c,
                            shape: v as CakeConfig["shape"],
                          }))
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
                    {config.shape === "Number" && (
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
                        ]}
                      />
                    </Field>
                  </div>
                  <div className="studio-section">
                    <div className="section-heading">
                      <h3>The finishing touches</h3>
                      <button
                        className="text-link"
                        onClick={() => {
                          setLibrary("Elements");
                          setMobilePanel("library");
                        }}
                      >
                        <Plus size={13} />
                        Add
                      </button>
                    </div>
                    {selectedTier.decorations.length ? (
                      selectedTier.decorations.map((dec) => (
                        <div className="selected-decoration" key={dec}>
                          <span className="decor-mini">
                            <Flower2 size={15} />
                          </span>
                          <span>{dec}</span>
                          <IconButton
                            label={`Remove ${dec}`}
                            onClick={() =>
                              updateTier({
                                decorations: selectedTier.decorations.filter(
                                  (x) => x !== dec,
                                ),
                              })
                            }
                          >
                            <X size={13} />
                          </IconButton>
                        </div>
                      ))
                    ) : (
                      <p className="muted small-copy">
                        A little simplicity is lovely, too.
                      </p>
                    )}
                  </div>
                </>
              )}
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
