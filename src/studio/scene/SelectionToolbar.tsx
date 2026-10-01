import { useRef } from "react";
import { Html } from "@react-three/drei";
import { Copy, Maximize2, RotateCw, Trash2 } from "lucide-react";
import type { CakeObject } from "../../domain/models";
import { rotateAboutNormal } from "../../domain/cakeScene";
import { placementOf, type SceneContext } from "./placement";

// A press-and-drag control: horizontal travel adjusts the value live, and the
// result is committed once on release. Arrow keys make the same adjustment.
function DragHandle({
  label,
  object,
  children,
  apply,
  onPreview,
  onCommit,
}: {
  label: string;
  object: CakeObject;
  children: React.ReactNode;
  apply: (base: CakeObject, pixels: number) => CakeObject;
  onPreview: (o: CakeObject | null) => void;
  onCommit: (o: CakeObject) => void;
}) {
  // The object as it was when the drag began; the live preview is re-derived
  // from it on every move rather than compounding on itself.
  const drag = useRef<{
    x: number;
    base: CakeObject;
    last?: CakeObject;
  } | null>(null);
  return (
    <button
      type="button"
      className="drag-handle"
      aria-label={label}
      title={`${label} — drag sideways`}
      onPointerDown={(e) => {
        drag.current = { x: e.clientX, base: object };
        e.currentTarget.setPointerCapture(e.pointerId);
      }}
      onPointerMove={(e) => {
        if (!drag.current) return;
        drag.current.last = apply(
          drag.current.base,
          e.clientX - drag.current.x,
        );
        onPreview(drag.current.last);
      }}
      onPointerUp={() => {
        const last = drag.current?.last;
        drag.current = null;
        if (last) onCommit(last);
        onPreview(null);
      }}
      onPointerCancel={() => {
        drag.current = null;
        onPreview(null);
      }}
      onKeyDown={(e) => {
        if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
          e.preventDefault();
          onCommit(apply(object, e.key === "ArrowRight" ? 20 : -20));
        }
      }}
    >
      {children}
    </button>
  );
}

// Controls that travel with the selected decoration, so the common edits do
// not need a trip to the side panel.
export function SelectionToolbar({
  object,
  context,
  onPreview,
  onChange,
  onDuplicate,
  onDelete,
}: {
  object: CakeObject;
  context: SceneContext;
  onPreview: (o: CakeObject | null) => void;
  onChange: (o: CakeObject) => void;
  onDuplicate?: () => void;
  onDelete?: () => void;
}) {
  const placement = placementOf(object, context);
  if (!placement) return null;
  return (
    <Html
      // Sit just above the decoration rather than on top of it.
      position={[
        placement.position.x,
        placement.position.y + 0.3 * object.scale,
        placement.position.z,
      ]}
      zIndexRange={[40, 0]}
    >
      <div
        className="selection-toolbar"
        role="toolbar"
        aria-label={`${object.name} quick actions`}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <DragHandle
          label="Rotate"
          object={object}
          apply={(base, px) => ({
            ...base,
            rotation: rotateAboutNormal(base.rotation, px * 0.0131),
          })}
          onPreview={onPreview}
          onCommit={onChange}
        >
          <RotateCw size={15} />
        </DragHandle>
        <DragHandle
          label="Resize"
          object={object}
          apply={(base, px) => ({
            ...base,
            scale: Math.min(4, Math.max(0.1, base.scale * Math.exp(px / 160))),
          })}
          onPreview={onPreview}
          onCommit={onChange}
        >
          <Maximize2 size={15} />
        </DragHandle>
        <span className="selection-toolbar-size">
          {Math.round(object.scale * 100)}%
        </span>
        <button
          type="button"
          aria-label="Duplicate selected"
          title="Duplicate (⌘/Ctrl D)"
          onClick={onDuplicate}
        >
          <Copy size={15} />
        </button>
        <button
          type="button"
          aria-label="Delete selected"
          title="Delete"
          onClick={onDelete}
        >
          <Trash2 size={15} />
        </button>
      </div>
    </Html>
  );
}
