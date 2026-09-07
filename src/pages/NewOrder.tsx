import { useEffect, useState } from "react";
import {
  Link,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Check,
  CheckCircle2,
  Plus,
  ShoppingBag,
  WandSparkles,
} from "lucide-react";
import { useData, useStore } from "../lib/store";
import { uid, today, type Order, type CakeConfig } from "../domain/models";
import { calculatePrice, inr } from "../domain/pricing";
import {
  Avatar,
  BackLink,
  Button,
  CakeImage,
  EmptyState,
  Field,
  Form,
  PageHeader,
  SearchInput,
  Select,
} from "../components/ui";
import { CustomerForm } from "./Customers";
import { Cake2D } from "../studio/Cake2D";

type Draft = {
  customerId: string;
  designId: string;
  date: string;
  time: string;
  fulfillment: "Delivery" | "Pickup";
  address: string;
  notes: string;
  price: string;
  delivery: string;
  discount: string;
  tax: string;
};
export default function NewOrder() {
  const d = useData();
  const { id } = useParams();
  const [params] = useSearchParams();
  const existing = d.orders.find((o) => o.id === id);
  const quote = d.quotes.find((q) => q.id === params.get("quote"));
  const navigate = useNavigate();
  const command = useStore((s) => s.command);
  const [step, setStep] = useState(0);
  const [search, setSearch] = useState("");
  const [showCustomer, setShowCustomer] = useState(false);
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState<Draft>(() => {
    let saved: Partial<Draft> = {};
    try {
      saved = JSON.parse(sessionStorage.getItem("crumb-order-draft") || "{}");
    } catch {}
    return {
      customerId:
        existing?.customerId ||
        params.get("customer") ||
        quote?.customerId ||
        saved.customerId ||
        "",
      designId:
        existing?.designId ||
        params.get("design") ||
        quote?.designId ||
        saved.designId ||
        "",
      date: existing?.date || saved.date || today(),
      time: existing?.time || saved.time || "15:00",
      fulfillment: existing?.fulfillment || saved.fulfillment || "Pickup",
      address: existing?.address || saved.address || "",
      notes: existing?.notes || saved.notes || "",
      price: existing ? String(existing.config.sellingPrice ?? "") : "",
      delivery: existing ? String(existing.config.delivery) : "0",
      discount: existing ? String(existing.config.discount) : "0",
      tax: existing ? String(existing.config.tax) : String(d.business.tax),
    };
  });
  const chosen = d.designs.find((x) => x.id === draft.designId);
  const customer = d.customers.find((x) => x.id === draft.customerId);
  const config: CakeConfig | undefined = chosen
    ? {
        ...(quote?.config ||
          (existing?.designId === chosen.id ? existing.config : chosen.config)),
        sellingPrice:
          draft.price === ""
            ? (quote?.config.sellingPrice ??
              existing?.config.sellingPrice ??
              chosen.config.sellingPrice)
            : Number(draft.price),
        delivery: Number(draft.delivery),
        discount: Number(draft.discount),
        tax: Number(draft.tax),
      }
    : undefined;
  const price = config
    ? calculatePrice(config, d.business.margin, d.inventory)
    : null;
  const update = (key: keyof Draft, value: string) =>
    setDraft((s) => ({ ...s, [key]: value }));
  useEffect(() => {
    if (!existing)
      sessionStorage.setItem("crumb-order-draft", JSON.stringify(draft));
  }, [draft, existing]);
  const create = async () => {
    if (!config || !chosen || !customer || !price) return;
    setBusy(true);
    const order: Order = {
      id: existing?.id || uid(),
      number: existing?.number || 0,
      customerId: customer.id,
      designId: chosen.id,
      cakeName: quote?.name || chosen.name,
      config,
      date: draft.date,
      time: draft.time,
      fulfillment: draft.fulfillment,
      address: draft.address || customer.address,
      status:
        existing?.status ||
        (quote?.status === "Approved" ? "Confirmed" : "Confirmed"),
      total: price.total,
      cost: price.cost,
      notes: draft.notes,
      priority: existing?.priority || "Normal",
      activity: existing?.activity || [
        {
          id: uid(),
          date: new Date().toISOString(),
          text: quote
            ? "Order created from approved quotation."
            : "Order confirmed. A new celebration is on the books.",
        },
      ],
      inventoryConsumed: existing?.inventoryConsumed || false,
      createdAt: existing?.createdAt || new Date().toISOString(),
    };
    try {
      const next = await command(
        { type: "order.save", value: order },
        existing ? "Order updated" : "A new celebration is on the books",
      );
      if (quote && !quote.orderId)
        await command({
          type: "quote.save",
          value: { ...quote, orderId: order.id },
        });
      sessionStorage.removeItem("crumb-order-draft");
      navigate(`/orders/${order.id}`);
    } catch {
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <BackLink to="/orders" label="All orders" />
      <PageHeader
        eyebrow={
          existing ? `ORDER #${existing.number}` : "LET’S MAKE SOMEONE’S DAY"
        }
        title={existing ? "A few finishing touches" : "A new celebration"}
        description="The person, the cake, and all the little details."
      />
      <div className="wizard-steps">
        {["Customer", "Cake", "Schedule", "Pricing", "Review"].map((s, i) => (
          <button
            key={s}
            className={i === step ? "active" : i < step ? "complete" : ""}
            disabled={i > step}
            onClick={() => setStep(i)}
          >
            <span>{i < step ? <Check size={14} /> : i + 1}</span>
            {s}
          </button>
        ))}
      </div>
      <div className="wizard-layout">
        <div className="wizard-main">
          <Form
            onSubmit={(e) => {
              e.preventDefault();
              if (step < 4) setStep(step + 1);
              else void create();
            }}
          >
            {step === 0 && (
              <>
                <div className="section-heading">
                  <div>
                    <h2>Who are we celebrating?</h2>
                    <p>A familiar face or someone new.</p>
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => setShowCustomer(true)}
                  >
                    <Plus size={15} />
                    New customer
                  </Button>
                </div>
                <SearchInput
                  value={search}
                  onChange={setSearch}
                  placeholder="Find a customer by name..."
                />
                <div className="customer-picker">
                  {d.customers
                    .filter((c) =>
                      c.name.toLowerCase().includes(search.toLowerCase()),
                    )
                    .map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        className={c.id === draft.customerId ? "selected" : ""}
                        onClick={() => {
                          update("customerId", c.id);
                          update("address", c.address);
                        }}
                      >
                        <Avatar name={c.name} />
                        <span>
                          <strong>{c.name}</strong>
                          <small>{c.phone}</small>
                        </span>
                        {draft.customerId === c.id ? (
                          <CheckCircle2 size={19} />
                        ) : (
                          <span className="radio-ring" />
                        )}
                      </button>
                    ))}
                </div>
              </>
            )}
            {step === 1 && (
              <>
                <div className="section-heading">
                  <div>
                    <h2>Something worth celebrating</h2>
                    <p>Start with a favorite, or make it their own.</p>
                  </div>
                </div>
                <Link to="/studio?order=1" className="custom-cake-option">
                  <span className="custom-cake-icon">
                    <WandSparkles size={24} />
                  </span>
                  <span>
                    <strong>Create a custom cake</strong>
                    <small>A little imagination, made just for them.</small>
                  </span>
                  <ArrowRight size={18} />
                </Link>
                <div className="design-picker">
                  {d.designs
                    .filter((design) => design.state !== "Archived")
                    .map((design) => (
                      <button
                        key={design.id}
                        type="button"
                        className={
                          design.id === draft.designId ? "selected" : ""
                        }
                        onClick={() => {
                          update("designId", design.id);
                          update("price", "");
                        }}
                      >
                        <CakeImage index={design.image} label={design.name} />
                        <span>
                          <strong>{design.name}</strong>
                          <small>
                            {inr(
                              calculatePrice(
                                design.config,
                                d.business.margin,
                                d.inventory,
                              ).selling,
                            )}
                          </small>
                        </span>
                        {design.id === draft.designId && (
                          <CheckCircle2 size={19} />
                        )}
                      </button>
                    ))}
                </div>
              </>
            )}
            {step === 2 && (
              <>
                <h2>A date for the diary</h2>
                <p className="muted">
                  Give every little detail a time and a place.
                </p>
                <div className="form-grid">
                  <Field label="Celebration date">
                    <input
                      type="date"
                      required
                      value={draft.date}
                      onChange={(e) => update("date", e.target.value)}
                    />
                  </Field>
                  <Field label="Ready by">
                    <input
                      type="time"
                      required
                      value={draft.time}
                      onChange={(e) => update("time", e.target.value)}
                    />
                  </Field>
                </div>
                <Field label="How will it arrive?">
                  <Select
                    value={draft.fulfillment}
                    onChange={(v) => {
                      update("fulfillment", v);
                      update(
                        "delivery",
                        v === "Delivery" ? String(d.business.deliveryFee) : "0",
                      );
                    }}
                    options={["Pickup", "Delivery"]}
                  />
                </Field>
                {draft.fulfillment === "Delivery" ? (
                  <Field label="Delivery address">
                    <textarea
                      required
                      rows={3}
                      value={draft.address}
                      onChange={(e) => update("address", e.target.value)}
                    />
                  </Field>
                ) : (
                  <div className="inline-notice">
                    <MapPinIcon />
                    <span>
                      <strong>Pickup at {d.business.name}</strong>
                      <p>{d.business.address}</p>
                    </span>
                  </div>
                )}
                <Field label="Preferences, allergies & special requests">
                  <textarea
                    rows={4}
                    placeholder="The little things that make this cake theirs..."
                    value={draft.notes}
                    onChange={(e) => update("notes", e.target.value)}
                  />
                </Field>
              </>
            )}
            {step === 3 && price && (
              <>
                <h2>A fair price for your craft</h2>
                <p className="muted">
                  Calculated from the cake, with room for your own touch.
                </p>
                <div className="price-lines">
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
                <div className="form-grid">
                  <Field
                    label="Selling price (₹)"
                    hint={`Suggested ${inr(price.suggested)}`}
                  >
                    <input
                      type="number"
                      min="0"
                      max="1000000"
                      value={draft.price}
                      placeholder={String(price.selling)}
                      onChange={(e) => update("price", e.target.value)}
                    />
                  </Field>
                  <Field label="Delivery (₹)">
                    <input
                      type="number"
                      min="0"
                      required
                      value={draft.delivery}
                      onChange={(e) => update("delivery", e.target.value)}
                    />
                  </Field>
                  <Field label="Discount (₹)">
                    <input
                      type="number"
                      min="0"
                      max={price.selling}
                      required
                      value={draft.discount}
                      onChange={(e) => update("discount", e.target.value)}
                    />
                  </Field>
                  <Field label="Tax (%)">
                    <input
                      type="number"
                      min="0"
                      max="40"
                      required
                      value={draft.tax}
                      onChange={(e) => update("tax", e.target.value)}
                    />
                  </Field>
                </div>
                <div className="inline-notice green">
                  <CheckCircle2 size={19} />
                  <span>
                    <strong>{inr(price.profit)} estimated gross profit</strong>
                    <p>
                      {price.margin.toFixed(1)}% margin before operating
                      expenses
                    </p>
                  </span>
                </div>
              </>
            )}
            {step === 4 && (
              <>
                <span className="review-check">
                  <CheckCircle2 size={30} />
                </span>
                <h2>All the lovely details, together.</h2>
                <p className="muted">One last look before it’s in the books.</p>
                <dl className="review-details">
                  <dt>Customer</dt>
                  <dd>{customer?.name}</dd>
                  <dt>Cake</dt>
                  <dd>{chosen?.name}</dd>
                  <dt>Flavor & size</dt>
                  <dd>
                    {config?.flavor} ·{" "}
                    {config?.tiers.map((t) => `${t.diameter}″`).join(" + ")}
                  </dd>
                  <dt>When</dt>
                  <dd>
                    {draft.date} at {draft.time}
                  </dd>
                  <dt>Fulfillment</dt>
                  <dd>{draft.fulfillment}</dd>
                  {draft.fulfillment === "Delivery" && (
                    <>
                      <dt>Address</dt>
                      <dd>{draft.address}</dd>
                    </>
                  )}
                  <dt>Total</dt>
                  <dd>
                    <strong>{inr(price?.total || 0)}</strong>
                  </dd>
                </dl>
                {draft.notes && <p className="personal-note">{draft.notes}</p>}
              </>
            )}
            <div className="wizard-actions">
              <Button
                type="button"
                variant="ghost"
                disabled={step === 0}
                onClick={() => setStep(step - 1)}
              >
                <ArrowLeft size={16} />
                Back
              </Button>
              <Button
                type="submit"
                loading={busy}
                disabled={
                  step === 0
                    ? !draft.customerId
                    : step === 1
                      ? !draft.designId
                      : false
                }
              >
                {step === 4
                  ? existing
                    ? "Save order"
                    : "Create order"
                  : "Continue"}
                {step === 4 ? <Check size={16} /> : <ArrowRight size={16} />}
              </Button>
            </div>
          </Form>
        </div>
        <aside className="wizard-preview">
          <span className="eyebrow">YOUR CELEBRATION, SO FAR</span>
          {config ? (
            <div className="wizard-cake">
              <Cake2D config={config} />
            </div>
          ) : (
            <div className="wizard-cake-empty">
              <ShoppingBag size={38} />
            </div>
          )}
          <h3>{chosen?.name || "A little something special"}</h3>
          <p>
            {customer ? `For ${customer.name}` : "One happy customer-to-be"}
          </p>
          {config && (
            <div className="tag-list">
              <span>{config.flavor}</span>
              <span>
                {config.tiers.length} tier{config.tiers.length > 1 ? "s" : ""}
              </span>
              <span>{price?.servings} servings</span>
            </div>
          )}
          <div className="wizard-preview-total">
            <span>Order total</span>
            <strong>{inr(price?.total || 0)}</strong>
          </div>
        </aside>
      </div>
      {showCustomer && (
        <CustomerForm
          onClose={() => setShowCustomer(false)}
          onSaved={(c) => {
            update("customerId", c.id);
            update("address", c.address);
          }}
        />
      )}
    </>
  );
}
function MapPinIcon() {
  return <CalendarDays size={18} />;
}
