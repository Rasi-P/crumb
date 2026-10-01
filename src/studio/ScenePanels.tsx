import { useState } from "react";
import {
  Copy,
  Eye,
  EyeOff,
  Lock,
  Unlock,
  Trash2,
  ArrowUp,
  ArrowDown,
  Flower2,
  Layers,
  Circle,
  Type,
  Sparkles,
} from "lucide-react";
import { Field, Select, IconButton, Button } from "../components/ui";
import {
  materialNames,
  type CakeConfig,
  type CakeObject,
  type Tier,
} from "../domain/models";
import { assets, assetById, decorationGroup } from "../domain/cakeScene";
export function Numeric({
  label,
  value,
  min,
  max,
  step = 0.1,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (n: number) => void;
}) {
  return (
    <Field label={label}>
      <input
        type="number"
        value={Math.round(value * 1000) / 1000}
        min={min}
        max={max}
        step={step}
        onChange={(e) => {
          if (
            e.target.value !== "" &&
            Number.isFinite(e.target.valueAsNumber) &&
            e.target.valueAsNumber >= min &&
            e.target.valueAsNumber <= max
          )
            onChange(e.target.valueAsNumber);
        }}
      />
    </Field>
  );
}
export function AssetLibrary({
  tierId,
  onAdd,
}: {
  tierId: string;
  onAdd: (objects: CakeObject[]) => void;
}) {
  const [quantity, setQuantity] = useState(1),
    [spacing, setSpacing] = useState(360),
    [filter, setFilter] = useState("");
  return (
    <div className="studio-section asset-library">
      <h3>Decoration library</h3>
      <p className="small-copy muted">Drag onto a tier, or click to add.</p>
      <input
        aria-label="Search decorations"
        placeholder="Search flowers, pearls…"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
      />
      <div className="form-grid">
        <Numeric
          label="Quantity"
          value={quantity}
          min={1}
          max={100}
          step={1}
          onChange={setQuantity}
        />
        <Numeric
          label="Spread (°)"
          value={spacing}
          min={0}
          max={360}
          step={5}
          onChange={setSpacing}
        />
      </div>
      {["Flowers", "Decorations", "Patisserie"].map((category) => (
        <div key={category}>
          <h4>{category}</h4>
          <div className="decorations-picker">
            {assets
              .filter(
                (a) =>
                  a.category === category &&
                  a.name.toLowerCase().includes(filter.toLowerCase()),
              )
              .map((a) => (
                <button
                  key={a.id}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData("application/x-cake-asset", a.id);
                    e.dataTransfer.effectAllowed = "copy";
                  }}
                  onClick={() =>
                    onAdd(
                      decorationGroup(
                        a.id,
                        tierId,
                        quantity,
                        spacing,
                        Date.now() % 100000,
                      ),
                    )
                  }
                  aria-label={a.id === "macaron" ? "Macarons" : a.name}
                  title={`${a.name} · ₹${a.unitPrice} each`}
                >
                  <span
                    className={`asset-thumbnail asset-${a.kind}`}
                    style={{ color: a.color }}
                  >
                    {a.thumbnail ? (
                      <img src={a.thumbnail} alt="" draggable={false} />
                    ) : a.kind === "pearl" ? (
                      <span
                        className="asset-pearl"
                        style={{ background: a.color }}
                      />
                    ) : a.kind === "leaf" ? (
                      <span className="asset-leaf" />
                    ) : (
                      <Sparkles size={24} />
                    )}
                  </span>
                  <span>{a.name}</span>
                  <small>₹{a.unitPrice}</small>
                </button>
              ))}
          </div>
        </div>
      ))}
    </div>
  );
}
export function ObjectInspector({
  object,
  config,
  onChange,
}: {
  object: CakeObject;
  config: CakeConfig;
  onChange: (o: CakeObject) => void;
}) {
  const patch = (p: Partial<CakeObject>) => onChange({ ...object, ...p });
  const attach = (p: Partial<CakeObject["attachment"]>) =>
    patch({ attachment: { ...object.attachment, ...p } });
  return (
    <fieldset
      disabled={object.locked}
      className="studio-section scene-inspector"
    >
      <Field label="Object name">
        <input
          value={object.name}
          maxLength={100}
          onChange={(e) => {
            if (e.target.value) patch({ name: e.target.value });
          }}
        />
      </Field>
      <Field label="Attached tier">
        <Select
          value={object.attachment.tierId}
          options={config.tiers.map((t, i) => ({
            value: t.id,
            label: `Tier ${i + 1} · ${t.diameter}″`,
          }))}
          onChange={(tierId) => attach({ tierId })}
        />
      </Field>
      <Field label="Placement">
        <Select
          value={object.attachment.surface}
          options={
            assetById(object.assetId)?.allowedPlacements || ["top", "side"]
          }
          onChange={(surface) => attach({ surface: surface as "top" | "side" })}
        />
      </Field>
      <div className="form-grid">
        <Numeric
          label="Angle (°)"
          min={-360}
          max={360}
          step={5}
          value={(object.attachment.angle * 180) / Math.PI}
          onChange={(angle) => attach({ angle: (angle * Math.PI) / 180 })}
        />
        <Numeric
          label={
            object.attachment.surface === "top" ? "Radius (%)" : "Height (%)"
          }
          min={0}
          max={100}
          step={1}
          value={
            (object.attachment.surface === "top"
              ? object.attachment.radius
              : object.attachment.height) * 100
          }
          onChange={(v) =>
            attach(
              object.attachment.surface === "top"
                ? { radius: v / 100 }
                : { height: v / 100 },
            )
          }
        />
        <Numeric
          label="Surface offset (in)"
          min={-0.1}
          max={2}
          value={object.attachment.offset}
          onChange={(offset) => attach({ offset })}
        />
        <Numeric
          label="Scale"
          min={0.1}
          max={4}
          value={object.scale}
          onChange={(scale) => patch({ scale })}
        />
      </div>
      <div className="transform-fields">
        {["X", "Y", "Z"].map((axis, i) => (
          <Numeric
            key={axis}
            label={`Rotate ${axis} (°)`}
            min={-360}
            max={360}
            step={5}
            value={(object.rotation[i] * 180) / Math.PI}
            onChange={(v) => {
              const rotation = [...object.rotation] as CakeObject["rotation"];
              rotation[i] = (v * Math.PI) / 180;
              patch({ rotation });
            }}
          />
        ))}
      </div>
      <Field label="Material">
        <Select
          value={object.material}
          options={[...materialNames]}
          onChange={(material) =>
            patch({ material: material as CakeObject["material"] })
          }
        />
      </Field>
      <Field label="Object color">
        <input
          type="color"
          value={object.color}
          onChange={(e) => patch({ color: e.target.value })}
        />
      </Field>
      <Numeric
        label="Component cost (₹)"
        min={0}
        max={100000}
        step={1}
        value={object.unitPrice}
        onChange={(unitPrice) => patch({ unitPrice })}
      />
      <p className="small-copy muted">
        Position follows the tier as its dimensions change.
      </p>
    </fieldset>
  );
}
export function LayerTree({
  config,
  selected,
  onSelect,
}: {
  config: CakeConfig;
  selected: string;
  onSelect: (id: string) => void;
}) {
  const row = (
    id: string,
    name: string,
    icon: React.ReactNode,
    hidden = false,
    locked = false,
  ) => (
    <button
      key={id}
      className={`${selected === id ? "selected" : ""} ${hidden ? "layer-hidden" : ""}`}
      onClick={() => onSelect(id)}
      aria-pressed={selected === id}
    >
      {icon}
      <span>{name}</span>
      {locked ? (
        <Lock size={12} />
      ) : hidden ? (
        <EyeOff size={12} />
      ) : (
        <Eye size={12} />
      )}
    </button>
  );
  return (
    <div className="layers-panel">
      <div className="studio-library-heading">
        <h3>Scene layers</h3>
        <p>
          {config.tiers.length} tiers · {config.objects?.length || 0}{" "}
          decorations
        </p>
      </div>
      {[...config.tiers].reverse().map((t, i) => (
        <div key={t.id}>
          {row(
            t.id,
            `Tier ${config.tiers.length - i} · ${t.diameter}″`,
            <Layers size={15} />,
            t.hidden,
            t.locked,
          )}
          <div className="layer-children">
            {row(
              t.id,
              `${t.frosting} · ${t.finish}`,
              <span className="tiny-color" style={{ background: t.color }} />,
              t.hidden,
              t.locked,
            )}
            {["Flowers", "Decorations", "Patisserie"].map((category) => {
              const objects = (config.objects || []).filter(
                (o) =>
                  o.attachment.tierId === t.id &&
                  assetById(o.assetId)?.category === category,
              );
              if (!objects.length) return null;
              return (
                <details
                  key={category}
                  open={
                    objects.some((o) => o.id === selected) ||
                    category === "Flowers"
                  }
                >
                  <summary>
                    {category} <span>{objects.length}</span>
                  </summary>
                  {objects.map((o) =>
                    row(
                      o.id,
                      o.name,
                      <Flower2 size={12} />,
                      o.hidden,
                      o.locked,
                    ),
                  )}
                </details>
              );
            })}
          </div>
        </div>
      ))}
      {config.topper &&
        row(
          "topper",
          config.topper,
          <Sparkles size={15} />,
          config.lettering?.topper.hidden,
          config.lettering?.topper.locked,
        )}
      {config.text &&
        row(
          "text",
          config.text,
          <Type size={15} />,
          config.lettering?.text.hidden,
          config.lettering?.text.locked,
        )}
      {row("board", "Cake board", <Circle size={15} />)}
    </div>
  );
}
export function SceneActions({
  config,
  selected,
  onChange,
  onSelect,
}: {
  config: CakeConfig;
  selected: string;
  onChange: (c: CakeConfig) => void;
  onSelect: (id: string) => void;
}) {
  const o = config.objects?.find((o) => o.id === selected),
    t = config.tiers.find((t) => t.id === selected),
    letter = selected === "text" || selected === "topper" ? selected : null;
  const locked =
      o?.locked ??
      t?.locked ??
      (letter ? config.lettering?.[letter].locked : false),
    hidden =
      o?.hidden ??
      t?.hidden ??
      (letter ? config.lettering?.[letter].hidden : false);
  if (!o && !t && !letter) return null;
  const flag = (key: "hidden" | "locked", value: boolean) => {
    const c = structuredClone(config);
    if (o)
      c.objects = c.objects!.map((x) =>
        x.id === selected ? { ...x, [key]: value } : x,
      );
    else if (t)
      c.tiers = c.tiers.map((x) =>
        x.id === selected ? { ...x, [key]: value } : x,
      );
    else if (letter) c.lettering![letter][key] = value;
    onChange(c);
  };
  const remove = () => {
    const c = structuredClone(config);
    if (o) c.objects = c.objects!.filter((x) => x.id !== selected);
    else if (t) {
      c.tiers = c.tiers.filter((x) => x.id !== selected);
      c.objects = c.objects!.filter((x) => x.attachment.tierId !== selected);
    } else if (letter) c[letter] = "";
    onChange(c);
    onSelect(c.tiers.at(-1)!.id);
  };
  const duplicate = () => {
    const c = structuredClone(config),
      id = crypto.randomUUID();
    if (o)
      c.objects!.push({
        ...structuredClone(o),
        id,
        name: `${o.name} copy`,
        attachment: { ...o.attachment, angle: o.attachment.angle + 0.18 },
        locked: false,
      });
    else if (t) {
      c.tiers.push({ ...structuredClone(t), id, locked: false });
      c.objects!.push(
        ...c
          .objects!.filter((x) => x.attachment.tierId === t.id)
          .map((x) => ({
            ...structuredClone(x),
            id: crypto.randomUUID(),
            attachment: { ...x.attachment, tierId: id },
          })),
      );
    }
    onChange(c);
    onSelect(id);
  };
  const reorder = (direction: number) => {
    const c = structuredClone(config),
      list = o ? c.objects! : c.tiers,
      index = list.findIndex((x) => x.id === selected),
      next = index + (o ? -direction : direction);
    if (next < 0 || next >= list.length) return;
    const a = list[index];
    list[index] = list[next];
    list[next] = a;
    onChange(c);
  };
  return (
    <div className="scene-actions">
      <IconButton
        label="Duplicate object"
        disabled={!!locked || !!letter || (!!t && config.tiers.length >= 4)}
        onClick={duplicate}
      >
        <Copy size={15} />
      </IconButton>
      <IconButton
        label={locked ? "Unlock object" : "Lock object"}
        onClick={() => flag("locked", !locked)}
      >
        {locked ? <Unlock size={15} /> : <Lock size={15} />}
      </IconButton>
      <IconButton
        label={hidden ? "Show object" : "Hide object"}
        onClick={() => flag("hidden", !hidden)}
      >
        {hidden ? <Eye size={15} /> : <EyeOff size={15} />}
      </IconButton>
      {!letter && (
        <>
          <IconButton
            label="Move layer up"
            disabled={!!locked}
            onClick={() => reorder(1)}
          >
            <ArrowUp size={15} />
          </IconButton>
          <IconButton
            label="Move layer down"
            disabled={!!locked}
            onClick={() => reorder(-1)}
          >
            <ArrowDown size={15} />
          </IconButton>
        </>
      )}
      <IconButton
        label="Delete object"
        disabled={!!locked || (!!t && config.tiers.length === 1)}
        onClick={remove}
      >
        <Trash2 size={15} />
      </IconButton>
    </div>
  );
}
export function TierDetails({
  tier,
  onChange,
}: {
  tier: Tier;
  onChange: (p: Partial<Tier>) => void;
}) {
  return (
    <div className="studio-section">
      <details>
        <summary>Surface & position</summary>
        <div className="form-grid">
          <Numeric
            label="Frosting thickness (in)"
            min={0.02}
            max={0.3}
            step={0.01}
            value={tier.frostingThickness ?? 0.16}
            onChange={(frostingThickness) => onChange({ frostingThickness })}
          />
          <Numeric
            label="Roughness"
            min={0.1}
            max={1}
            step={0.05}
            value={tier.roughness ?? 0.79}
            onChange={(roughness) => onChange({ roughness })}
          />
          <Numeric
            label="Specular"
            min={0}
            max={1}
            step={0.05}
            value={tier.specular ?? 0.28}
            onChange={(specular) => onChange({ specular })}
          />
          <Numeric
            label="Imperfection"
            min={0}
            max={1}
            step={0.05}
            value={tier.imperfection ?? 0.4}
            onChange={(imperfection) => onChange({ imperfection })}
          />
          <Numeric
            label="Position X (in)"
            min={-8}
            max={8}
            value={tier.position?.[0] ?? 0}
            onChange={(x) =>
              onChange({ position: [x, tier.position?.[1] ?? 0] })
            }
          />
          <Numeric
            label="Position Z (in)"
            min={-8}
            max={8}
            value={tier.position?.[1] ?? 0}
            onChange={(z) =>
              onChange({ position: [tier.position?.[0] ?? 0, z] })
            }
          />
          <Numeric
            label="Tier spacing (in)"
            min={0}
            max={4}
            value={tier.spacing ?? 0}
            onChange={(spacing) => onChange({ spacing })}
          />
        </div>
      </details>
    </div>
  );
}
export function LetteringDetails({
  config,
  kind,
  onChange,
}: {
  config: CakeConfig;
  kind: "text" | "topper";
  onChange: (c: CakeConfig) => void;
}) {
  const s = config.lettering![kind],
    patch = (p: Partial<typeof s>) =>
      onChange({
        ...config,
        lettering: { ...config.lettering!, [kind]: { ...s, ...p } },
      });
  return (
    <fieldset disabled={s.locked} className="studio-section">
      <Field label="3D font">
        <Select
          value={s.font}
          options={[
            { value: "great-vibes", label: "Great Vibes · Script" },
            { value: "optimer", label: "Optimer · Serif" },
            { value: "helvetiker", label: "Helvetiker · Sans" },
          ]}
          onChange={(font) => patch({ font: font as typeof s.font })}
        />
      </Field>
      <div className="form-grid">
        <Numeric
          label="Font size (in)"
          min={0.15}
          max={1.5}
          step={0.05}
          value={s.size}
          onChange={(size) => patch({ size })}
        />
        <Numeric
          label="Extrusion (in)"
          min={0.02}
          max={0.3}
          step={0.01}
          value={s.depth}
          onChange={(depth) => patch({ depth })}
        />
        <Numeric
          label="Text scale"
          min={0.2}
          max={3}
          value={s.scale}
          onChange={(scale) => patch({ scale })}
        />
      </div>
      <Field label="Text material">
        <Select
          value={s.material}
          options={[...materialNames]}
          onChange={(material) =>
            patch({ material: material as typeof s.material })
          }
        />
      </Field>
      {kind === "topper" && (
        <Field label="Topper color">
          <input
            type="color"
            value={s.color}
            onChange={(e) => patch({ color: e.target.value })}
          />
        </Field>
      )}
      <details>
        <summary>Text transform</summary>
        {["X", "Y", "Z"].map((a, i) => (
          <div className="form-grid" key={a}>
            <Numeric
              label={`Text position ${a} (in)`}
              min={-8}
              max={8}
              value={s.position[i]}
              onChange={(v) => {
                const position = [...s.position] as typeof s.position;
                position[i] = v;
                patch({ position });
              }}
            />
            <Numeric
              label={`Text rotation ${a} (°)`}
              min={-360}
              max={360}
              step={5}
              value={(s.rotation[i] * 180) / Math.PI}
              onChange={(v) => {
                const rotation = [...s.rotation] as typeof s.rotation;
                rotation[i] = (v * Math.PI) / 180;
                patch({ rotation });
              }}
            />
          </div>
        ))}
      </details>
    </fieldset>
  );
}
