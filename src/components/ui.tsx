import {
  cloneElement,
  isValidElement,
  useEffect,
  useId,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type ReactNode,
  type ReactElement,
  type FormEvent,
} from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronDown,
  Loader2,
  Search,
  X,
  AlertCircle,
  CakeSlice,
  MoreHorizontal,
} from "lucide-react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import { useStore } from "../lib/store";

export function Button({
  children,
  variant = "primary",
  className = "",
  loading = false,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  loading?: boolean;
}) {
  return (
    <button
      className={`button ${variant} ${className}`}
      {...props}
      disabled={props.disabled || loading}
    >
      {loading ? <Loader2 size={16} className="spin" /> : null}
      {children}
    </button>
  );
}
export function IconButton({
  label,
  children,
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      {...props}
      className={`icon-button ${className}`}
      aria-label={label}
      title={label}
    >
      {children}
    </button>
  );
}
export function Badge({
  children,
  tone,
}: {
  children: ReactNode;
  tone?: string;
}) {
  const text = String(children);
  const derived =
    /Completed|Paid$|Approved|In Stock|Saved|Published/.test(text) &&
    text !== "Partially Paid"
      ? "green"
      : /Preparing|Decorating|Partial|Viewed|Draft/.test(text)
        ? "amber"
        : /Ready|Confirmed|Baking/.test(text)
          ? "purple"
          : /Low|Out of Stock|Cancelled|Unpaid|Changes/.test(text)
            ? "red"
            : "gray";
  return (
    <span className={`badge ${tone || derived}`}>
      <span />
      {children}
    </span>
  );
}
export function Avatar({
  name,
  size = "normal",
}: {
  name: string;
  size?: "small" | "normal" | "large";
}) {
  const index = name.charCodeAt(0) % 5;
  return (
    <span className={`avatar avatar-${index} ${size}`}>
      {name
        .split(" ")
        .map((n) => n[0])
        .slice(0, 2)
        .join("")}
    </span>
  );
}
export function CakeImage({
  index = 0,
  className = "",
  label = "Cake design",
}: {
  index?: number;
  className?: string;
  label?: string;
}) {
  return (
    <div
      role="img"
      aria-label={label}
      className={`cake-image ${className}`}
      style={{
        backgroundImage: "url(/images/cake-collection.png)",
        backgroundSize: "400% 300%",
        backgroundPosition: `${((index % 4) / 3) * 100}% ${(Math.floor(index / 4) / 2) * 100}%`,
      }}
    />
  );
}
export function PageHeader({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  children?: ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      <div className="page-heading-actions">{children}</div>
    </div>
  );
}
export function SectionHeading({
  title,
  subtitle,
  action,
  to,
}: {
  title: string;
  subtitle?: string;
  action?: string;
  to?: string;
}) {
  return (
    <div className="section-heading">
      <div>
        <h2>{title}</h2>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {action && to && (
        <Link className="text-link" to={to}>
          {action}
          <ArrowRight size={14} />
        </Link>
      )}
    </div>
  );
}
export function SearchInput({
  value,
  onChange,
  placeholder = "Search...",
}: {
  value: string;
  onChange: (s: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="search-input">
      <Search size={17} />
      <input
        aria-label={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
      {value && (
        <IconButton label="Clear search" onClick={() => onChange("")}>
          <X size={14} />
        </IconButton>
      )}
    </div>
  );
}
export function Field({
  label,
  children,
  hint,
  className = "",
}: {
  label: string;
  children: ReactNode;
  hint?: string;
  className?: string;
}) {
  const id = useId();
  let control = children;
  if (isValidElement(children)) {
    const child = children as ReactElement<Record<string, unknown>>;
    if (
      typeof child.type === "string" &&
      ["input", "select", "textarea"].includes(child.type)
    )
      control = cloneElement(child, {
        id: child.props.id || id,
        "aria-label": child.props["aria-label"] || label,
      });
    else if (child.type === Select)
      control = cloneElement(child, { label: child.props.label || label });
  }
  return (
    <label className={`field ${className}`}>
      <span>{label}</span>
      {control}
      {hint && <small>{hint}</small>}
    </label>
  );
}
export function Select({
  value,
  onChange,
  options,
  label,
  className = "",
}: {
  value: string;
  onChange: (v: string) => void;
  options: readonly (string | { value: string; label: string })[];
  label?: string;
  className?: string;
}) {
  return (
    <div className={`select-wrap ${className}`}>
      <select
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map((o) => (
          <option
            key={typeof o === "string" ? o : o.value}
            value={typeof o === "string" ? o : o.value}
          >
            {typeof o === "string" ? o : o.label}
          </option>
        ))}
      </select>
      <ChevronDown size={14} />
    </div>
  );
}
export function Tabs({
  options,
  value,
  onChange,
  className = "",
}: {
  options: readonly (
    string | { value: string; label: string; count?: number }
  )[];
  value: string;
  onChange: (v: string) => void;
  className?: string;
}) {
  return (
    <div
      role="tablist"
      className={`tabs ${className}`}
      onKeyDown={(event) => {
        if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key))
          return;
        event.preventDefault();
        const current = options.findIndex(
          (o) => (typeof o === "string" ? o : o.value) === value,
        );
        const next =
          event.key === "Home"
            ? 0
            : event.key === "End"
              ? options.length - 1
              : (current +
                  (event.key === "ArrowRight" ? 1 : -1) +
                  options.length) %
                options.length;
        const option = options[next];
        onChange(typeof option === "string" ? option : option.value);
        event.currentTarget
          .querySelectorAll<HTMLButtonElement>('[role="tab"]')
          [next]?.focus();
      }}
    >
      {options.map((o) => {
        const item = typeof o === "string" ? { value: o, label: o } : o;
        return (
          <button
            type="button"
            role="tab"
            aria-selected={value === item.value}
            tabIndex={value === item.value ? 0 : -1}
            key={item.value}
            className={value === item.value ? "active" : ""}
            onClick={() => onChange(item.value)}
          >
            {item.label}
            {item.count !== undefined && <span>{item.count}</span>}
          </button>
        );
      })}
    </div>
  );
}
export function Modal({
  title,
  description,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const before = useRef<HTMLElement | null>(null);
  useEffect(() => {
    before.current = document.activeElement as HTMLElement;
    ref.current?.showModal();
    const bodyOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = bodyOverflow;
      before.current?.focus();
    };
  }, []);
  return createPortal(
    <dialog
      className={`modal ${wide ? "wide" : ""}`}
      ref={ref}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      aria-label={title}
    >
      <div className="modal-inner">
        <header>
          <div>
            <h2>{title}</h2>
            {description && <p>{description}</p>}
          </div>
          <IconButton label="Close dialog" onClick={onClose}>
            <X size={20} />
          </IconButton>
        </header>
        {children}
      </div>
    </dialog>,
    document.body,
  );
}
export function Confirm({
  title,
  description,
  onConfirm,
  onClose,
  danger = false,
  children,
}: {
  title: string;
  description: string;
  onConfirm: () => Promise<void> | void;
  onClose: () => void;
  danger?: boolean;
  children?: ReactNode;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <Modal title={title} description={description} onClose={onClose}>
      {children}
      <div className="modal-actions">
        <Button variant="secondary" onClick={onClose}>
          Keep as is
        </Button>
        <Button
          variant={danger ? "danger" : "primary"}
          loading={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await onConfirm();
              onClose();
            } catch {
            } finally {
              setBusy(false);
            }
          }}
        >
          {danger ? "Confirm" : "Continue"}
          <Check size={15} />
        </Button>
      </div>
    </Modal>
  );
}
export function EmptyState({
  title,
  description,
  action,
  icon,
}: {
  title: string;
  description: string;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <div className="empty-icon">{icon || <CakeSlice size={28} />}</div>
      <h3>{title}</h3>
      <p>{description}</p>
      {action}
    </div>
  );
}
export function Toasts() {
  const { toasts, dismiss } = useStore();
  return (
    <div className="toast-container" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`toast ${t.kind}`}>
          {t.kind === "error" ? (
            <AlertCircle size={19} />
          ) : (
            <CheckCircle2 size={19} />
          )}
          <span>{t.message}</span>
          <IconButton
            label="Dismiss notification"
            onClick={() => dismiss(t.id)}
          >
            <X size={15} />
          </IconButton>
        </div>
      ))}
    </div>
  );
}
export function Skeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="skeleton-page">
      <div className="skeleton" style={{ width: "36%", height: 36 }} />
      <div className="skeleton" style={{ height: 110 }} />
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="skeleton" style={{ height: 56 }} />
      ))}
    </div>
  );
}
export function Menu({
  children,
  label = "More actions",
}: {
  children: ReactNode;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const click = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("click", click);
    return () => document.removeEventListener("click", click);
  }, []);
  return (
    <div className="menu" ref={ref}>
      <IconButton
        label={label}
        onClick={() => setOpen(!open)}
        aria-expanded={open}
      >
        <MoreHorizontal size={18} />
      </IconButton>
      {open && (
        <div
          className="menu-items"
          onClick={() => setOpen(false)}
          onKeyDown={(e) => {
            if (e.key === "Escape") setOpen(false);
          }}
        >
          {children}
        </div>
      )}
    </div>
  );
}
export function Form({
  children,
  onSubmit,
  className = "",
}: {
  children: ReactNode;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
  className?: string;
}) {
  return (
    <form className={`form ${className}`} onSubmit={onSubmit}>
      {children}
    </form>
  );
}
export function BackLink({ to, label }: { to: string; label: string }) {
  return (
    <Link to={to} className="back-link">
      <ArrowLeft size={15} />
      {label}
    </Link>
  );
}
export function Stat({
  label,
  value,
  change,
  icon,
  foot,
}: {
  label: string;
  value: string;
  change?: string;
  icon: ReactNode;
  foot?: string;
}) {
  return (
    <div className="stat">
      <div className="stat-top">
        <span>{label}</span>
        <span className="stat-icon">{icon}</span>
      </div>
      <strong>{value}</strong>
      <div className="stat-bottom">
        {change && <span className="stat-change">{change}</span>}
        <span>{foot || "vs. previous period"}</span>
      </div>
    </div>
  );
}
