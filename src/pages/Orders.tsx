import { useState } from "react";
import {
  Link,
  useNavigate,
  useParams,
  useSearchParams,
} from "react-router-dom";
import { format } from "date-fns";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Copy,
  CreditCard,
  Download,
  LayoutGrid,
  List,
  MapPin,
  MessageSquare,
  MoreHorizontal,
  Pencil,
  Plus,
  Send,
  ShoppingBag,
  Truck,
  WandSparkles,
} from "lucide-react";
import { useData, useStore } from "../lib/store";
import {
  uid,
  today,
  statuses,
  stages,
  type Order,
  type OrderStatus,
  type Payment,
} from "../domain/models";
import { balance, calculatePrice, inr, recipeFor } from "../domain/pricing";
import {
  Avatar,
  BackLink,
  Badge,
  Button,
  CakeImage,
  Confirm,
  EmptyState,
  Field,
  Form,
  IconButton,
  Modal,
  PageHeader,
  SearchInput,
  SectionHeading,
  Select,
  Tabs,
} from "../components/ui";
import { CustomerForm } from "./Customers";
import { Cake2D } from "../studio/Cake2D";
import { QuoteForm } from "./Quotations";

export default function Orders() {
  const d = useData();
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("All statuses");
  const [payment, setPayment] = useState("All payments");
  const [date, setDate] = useState("");
  const [customer, setCustomer] = useState("");
  const [flavor, setFlavor] = useState("");
  const [advanced, setAdvanced] = useState(false);
  const view = params.get("view") === "board" ? "board" : "list";
  const orders = d.orders.filter(
    (o) =>
      `${o.number} ${o.cakeName} ${d.customers.find((c) => c.id === o.customerId)?.name}`
        .toLowerCase()
        .includes(search.toLowerCase()) &&
      (status === "All statuses" || o.status === status) &&
      (payment === "All payments" ||
        balance(o, d.payments).status === payment) &&
      (!date || o.date === date) &&
      (!customer || o.customerId === customer) &&
      (!flavor || o.config.flavor === flavor),
  );
  return (
    <>
      <PageHeader
        eyebrow="EVERY ORDER, A CELEBRATION"
        title="Good things in the making"
        description="From the first little idea to the very last slice."
      >
        <Link to="/orders/new" className="button primary">
          <Plus size={16} />
          New order
        </Link>
      </PageHeader>
      <div className="order-summary">
        <button onClick={() => setStatus("All statuses")}>
          <span>All orders</span>
          <strong>{d.orders.length}</strong>
        </button>
        <button onClick={() => setStatus("Confirmed")}>
          <span>Upcoming</span>
          <strong>
            {
              d.orders.filter((o) =>
                ["Confirmed", "Paid", "Quotation Sent"].includes(o.status),
              ).length
            }
          </strong>
        </button>
        <button onClick={() => setStatus("Preparing")}>
          <span>
            <i className="amber-dot" />
            In the kitchen
          </span>
          <strong>
            {
              d.orders.filter((o) =>
                ["Preparing", "Baking", "Decorating"].includes(o.status),
              ).length
            }
          </strong>
        </button>
        <button onClick={() => setStatus("Ready")}>
          <span>
            <i className="green-dot" />
            Ready to celebrate
          </span>
          <strong>{d.orders.filter((o) => o.status === "Ready").length}</strong>
        </button>
        <button onClick={() => setStatus("Completed")}>
          <span>Delivered with love</span>
          <strong>
            {d.orders.filter((o) => o.status === "Completed").length}
          </strong>
        </button>
      </div>
      <div className="list-toolbar">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search orders or customers..."
        />
        <Select
          label="Filter order status"
          value={status}
          onChange={setStatus}
          options={["All statuses", ...statuses]}
        />
        <Select
          label="Filter payment"
          value={payment}
          onChange={setPayment}
          options={["All payments", "Unpaid", "Partially Paid", "Paid"]}
        />
        <Button variant="secondary" onClick={() => setAdvanced(!advanced)}>
          <CalendarDays size={15} />
          Filters
          {(date || customer || flavor) && <span className="filter-dot" />}
        </Button>
        <div className="view-toggle">
          <IconButton
            label="List view"
            className={view === "list" ? "active" : ""}
            onClick={() => setParams({})}
          >
            <List size={17} />
          </IconButton>
          <IconButton
            label="Production board"
            className={view === "board" ? "active" : ""}
            onClick={() => setParams({ view: "board" })}
          >
            <LayoutGrid size={17} />
          </IconButton>
        </div>
      </div>
      {advanced && (
        <div className="filter-panel">
          <Field label="Delivery date">
            <input
              aria-label="Filter delivery date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </Field>
          <Field label="Customer">
            <Select
              value={customer}
              onChange={setCustomer}
              options={[
                { value: "", label: "All customers" },
                ...d.customers.map((c) => ({ value: c.id, label: c.name })),
              ]}
            />
          </Field>
          <Field label="Flavor">
            <Select
              value={flavor}
              onChange={setFlavor}
              options={[
                { value: "", label: "All flavors" },
                ...Array.from(new Set(d.orders.map((o) => o.config.flavor))),
              ]}
            />
          </Field>
          <Button
            variant="ghost"
            onClick={() => {
              setDate("");
              setCustomer("");
              setFlavor("");
              setPayment("All payments");
              setStatus("All statuses");
            }}
          >
            Clear filters
          </Button>
        </div>
      )}
      {view === "board" ? (
        <ProductionBoard orders={orders} />
      ) : (
        <OrderTable orders={orders} />
      )}
    </>
  );
}
export function OrderTable({ orders }: { orders: Order[] }) {
  const d = useData();
  return (
    <div className="table-container">
      <table className="orders-table">
        <thead>
          <tr>
            <th>Order / cake</th>
            <th>Customer</th>
            <th>Delivery</th>
            <th>Amount</th>
            <th>Payment</th>
            <th>Status</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {orders.map((o) => (
            <tr key={o.id}>
              <td>
                <Link className="cake-cell" to={`/orders/${o.id}`}>
                  <CakeImage
                    index={
                      d.designs.find((design) => design.id === o.designId)
                        ?.image
                    }
                    label={o.cakeName}
                  />
                  <span>
                    <small>#{o.number}</small>
                    <strong>{o.cakeName}</strong>
                  </span>
                </Link>
              </td>
              <td>
                <Link
                  className="customer-name"
                  to={`/customers/${o.customerId}`}
                >
                  {d.customers.find((c) => c.id === o.customerId)?.name}
                </Link>
              </td>
              <td>
                <div className="stack-cell">
                  <strong>
                    {o.date === today()
                      ? "Today"
                      : format(new Date(o.date + "T12:00:00"), "d MMM yyyy")}
                  </strong>
                  <small>
                    {format(new Date(o.date + "T" + o.time), "h:mm a")} ·{" "}
                    {o.fulfillment}
                  </small>
                </div>
              </td>
              <td className="number">{inr(o.total)}</td>
              <td>
                <Badge>{balance(o, d.payments).status}</Badge>
              </td>
              <td>
                <Badge>{o.status}</Badge>
              </td>
              <td>
                <Link
                  className="icon-button"
                  aria-label={`Open order ${o.number}`}
                  to={`/orders/${o.id}`}
                >
                  <ArrowUpRight size={16} />
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {!orders.length && (
        <EmptyState
          title="A fresh page for something lovely"
          description="No orders match these filters. Clear them or start a new celebration."
          action={
            <Link to="/orders/new" className="button primary">
              <Plus size={16} />
              New order
            </Link>
          }
        />
      )}
      <div className="table-footer">
        <span>{orders.length} orders</span>
        <span>Every little detail, accounted for.</span>
      </div>
    </div>
  );
}
function ProductionBoard({ orders }: { orders: Order[] }) {
  const d = useData();
  const command = useStore((s) => s.command);
  const [hover, setHover] = useState("");
  const [complete, setComplete] = useState<string | null>(null);
  const [consume, setConsume] = useState(true);
  const move = (id: string, status: OrderStatus) => {
    if (status === "Completed") {
      setComplete(id);
      return;
    }
    void command(
      { type: "order.status", id, status },
      `Moved to ${status.toLowerCase()}`,
    ).catch(() => {});
  };
  return (
    <>
      <div className="production-board">
        {stages.map((stage) => (
          <section
            className={`production-column ${hover === stage ? "drag-over" : ""}`}
            key={stage}
            onDragOver={(e) => {
              e.preventDefault();
              setHover(stage);
            }}
            onDragLeave={() => setHover("")}
            onDrop={(e) => {
              e.preventDefault();
              setHover("");
              const id = e.dataTransfer.getData("text/plain");
              if (d.orders.some((o) => o.id === id)) move(id, stage);
            }}
          >
            <header>
              <span className={`stage-dot ${stage.toLowerCase()}`} />
              <h3>{stage === "Completed" ? "Delivered" : stage}</h3>
              <span>
                {
                  orders.filter(
                    (o) =>
                      o.status === stage ||
                      (stage === "Confirmed" && o.status === "Paid"),
                  ).length
                }
              </span>
            </header>
            {orders
              .filter(
                (o) =>
                  o.status === stage ||
                  (stage === "Confirmed" && o.status === "Paid"),
              )
              .map((o) => (
                <article
                  key={o.id}
                  className="production-card"
                  draggable={o.status !== "Completed"}
                  onDragStart={(e) =>
                    e.dataTransfer.setData("text/plain", o.id)
                  }
                >
                  <div className="production-card-top">
                    <Link to={`/orders/${o.id}`}>#{o.number}</Link>
                    {o.priority === "High" && (
                      <Badge tone="red">Priority</Badge>
                    )}
                  </div>
                  <Link to={`/orders/${o.id}`}>
                    <CakeImage
                      index={d.designs.find((x) => x.id === o.designId)?.image}
                      label={o.cakeName}
                    />
                    <h4>{o.cakeName}</h4>
                    <p>
                      {d.customers.find((c) => c.id === o.customerId)?.name}
                    </p>
                  </Link>
                  <div className="production-due">
                    <Clock3 size={13} />
                    {o.date === today()
                      ? "Today"
                      : format(new Date(o.date + "T12:00:00"), "d MMM")}{" "}
                    · {o.time}
                  </div>
                  {o.status !== "Completed" && (
                    <Select
                      label={`Move order ${o.number}`}
                      value={o.status === "Paid" ? "Confirmed" : o.status}
                      onChange={(value) => move(o.id, value as OrderStatus)}
                      options={stages}
                    />
                  )}
                </article>
              ))}
            {!orders.some((o) => o.status === stage) && (
              <div className="column-empty">A little breathing room</div>
            )}
          </section>
        ))}
      </div>
      <p className="board-extras">
        {
          orders.filter(
            (o) =>
              ![
                "Confirmed",
                "Paid",
                "Preparing",
                "Baking",
                "Decorating",
                "Ready",
                "Completed",
              ].includes(o.status),
          ).length
        }{" "}
        orders in inquiry, quotation, delivery or cancelled stages are available
        in list view.
      </p>
      {complete && (
        <Confirm
          title="Delivered with love"
          description="Complete this order and record its revenue. You can also deduct the recipe ingredients from your pantry."
          onClose={() => setComplete(null)}
          onConfirm={async () => {
            await command(
              {
                type: "order.status",
                id: complete,
                status: "Completed",
                consume,
              },
              "Order completed",
            );
          }}
        >
          <label className="checkbox-line">
            <input
              type="checkbox"
              checked={consume}
              onChange={(e) => setConsume(e.target.checked)}
            />
            Record ingredient consumption
          </label>
        </Confirm>
      )}
    </>
  );
}
export function PaymentForm({
  order,
  onClose,
}: {
  order: Order;
  onClose: () => void;
}) {
  const d = useData();
  const b = balance(order, d.payments);
  const [kind, setKind] = useState<"Payment" | "Refund">(
    b.remaining ? "Payment" : "Refund",
  );
  const [busy, setBusy] = useState(false);
  const command = useStore((s) => s.command);
  return (
    <Modal
      title="Keep the little numbers in order"
      description={`Order #${order.number} · ${d.customers.find((c) => c.id === order.customerId)?.name}`}
      onClose={onClose}
    >
      <div className="payment-summary">
        <div>
          <span>Order total</span>
          <strong>{inr(order.total)}</strong>
        </div>
        <div>
          <span>Received</span>
          <strong>{inr(b.paid)}</strong>
        </div>
        <div>
          <span>Remaining</span>
          <strong>{inr(b.remaining)}</strong>
        </div>
      </div>
      <Form
        onSubmit={async (e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          const value: Payment = {
            id: uid(),
            orderId: order.id,
            amount: Number(f.get("amount")),
            method: String(f.get("method")) as Payment["method"],
            reference: String(f.get("reference")),
            date: String(f.get("date")),
            kind,
          };
          setBusy(true);
          try {
            await command(
              { type: "payment.add", value },
              kind === "Refund" ? "Refund recorded" : "Payment recorded",
            );
            onClose();
          } catch {
          } finally {
            setBusy(false);
          }
        }}
      >
        <Field label="Transaction">
          <Select
            value={kind}
            onChange={(v) => setKind(v as typeof kind)}
            options={["Payment", "Refund"]}
          />
        </Field>
        <div className="form-grid">
          <Field label="Amount (₹)">
            <input
              key={kind}
              name="amount"
              type="number"
              required
              min="1"
              step="1"
              max={kind === "Payment" ? b.remaining : b.paid}
              defaultValue={kind === "Payment" ? b.remaining : b.paid}
            />
          </Field>
          <Field label="Method">
            <select name="method">
              {["UPI", "Cash", "Card", "Bank Transfer", "Other"].map((m) => (
                <option key={m}>{m}</option>
              ))}
            </select>
          </Field>
        </div>
        <div className="form-grid">
          <Field label="Date">
            <input
              name="date"
              type="date"
              required
              defaultValue={today()}
              max={today()}
            />
          </Field>
          <Field label="Reference (optional)">
            <input name="reference" placeholder="UPI or bank reference" />
          </Field>
        </div>
        <div className="modal-actions">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            loading={busy}
            disabled={kind === "Payment" ? !b.remaining : !b.paid}
          >
            <CreditCard size={16} />
            Record {kind.toLowerCase()}
          </Button>
        </div>
      </Form>
    </Modal>
  );
}
export function OrderDetail() {
  const { id } = useParams();
  const d = useData();
  const command = useStore((s) => s.command);
  const navigate = useNavigate();
  const [modal, setModal] = useState("");
  const [note, setNote] = useState("");
  const [consume, setConsume] = useState(true);
  const [confirmStatus, setConfirmStatus] = useState<OrderStatus | null>(null);
  const o = d.orders.find((o) => o.id === id);
  if (!o)
    return (
      <EmptyState
        title="This celebration isn’t here"
        description="The order could not be found."
        action={
          <Link className="button secondary" to="/orders">
            All orders
          </Link>
        }
      />
    );
  const customer = d.customers.find((c) => c.id === o.customerId)!;
  const design = d.designs.find((c) => c.id === o.designId)!;
  const b = balance(o, d.payments);
  const pricing = calculatePrice(o.config, d.business.margin, d.inventory);
  const closed = ["Completed", "Cancelled"].includes(o.status);
  const changeStatus = (status: string) => {
    if (status === "Completed" || status === "Cancelled")
      setConfirmStatus(status);
    else
      void command(
        { type: "order.status", id: o.id, status: status as OrderStatus },
        "Production updated",
      ).catch(() => {});
  };
  return (
    <>
      <BackLink to="/orders" label="All orders" />
      <PageHeader
        eyebrow={`ORDER #${o.number}`}
        title={customer.name}
        description={o.cakeName}
      >
        <Badge>{o.status}</Badge>
        <Button variant="secondary" onClick={() => setModal("quote")}>
          <Send size={15} />
          Quotation
        </Button>
        <Button
          onClick={() => setModal("payment")}
          disabled={o.status === "Cancelled"}
        >
          <CreditCard size={15} />
          Record payment
        </Button>
      </PageHeader>
      <div className="order-detail-layout">
        <div className="order-detail-main">
          <section className="order-design">
            <div className="order-design-canvas">
              <Cake2D config={o.config} />
              <span className="preview-caption">
                {o.config.tiers.length}-tier · {o.config.flavor} ·{" "}
                {pricing.servings} servings
              </span>
            </div>
            <div className="order-design-info">
              <span className="eyebrow">
                MADE JUST FOR {customer.name.split(" ")[0].toUpperCase()}
              </span>
              <h2>{o.cakeName}</h2>
              <p>
                {o.config.tiers.map((t) => `${t.diameter}″`).join(" + ")} ·{" "}
                {o.config.tiers[0].frosting}
              </p>
              <div className="tag-list">
                {Array.from(
                  new Set(o.config.tiers.flatMap((t) => t.decorations)),
                ).map((dec) => (
                  <span key={dec}>{dec}</span>
                ))}
              </div>
              <p className="cake-lettering">
                “{o.config.text || "A little celebration, made personal"}”
              </p>
              <div className="button-row">
                <Link
                  to={`/studio/${design.id}?orderId=${o.id}`}
                  className="button secondary"
                >
                  <WandSparkles size={15} />
                  View design
                </Link>
                {!closed && (
                  <Link
                    className="icon-button"
                    title="Edit order"
                    to={`/orders/${o.id}/edit`}
                  >
                    <Pencil size={16} />
                  </Link>
                )}
                <Button
                  variant="ghost"
                  onClick={() =>
                    navigate(
                      `/orders/new?design=${o.designId}&customer=${o.customerId}`,
                    )
                  }
                >
                  <Copy size={15} />
                  Duplicate
                </Button>
              </div>
            </div>
          </section>
          <section>
            <SectionHeading title="A little kitchen choreography" />
            <div className="production-progress">
              {stages.map((stage, i) => {
                const current = Math.max(
                  0,
                  stages.indexOf(o.status as (typeof stages)[number]),
                );
                return (
                  <button
                    disabled={closed}
                    key={stage}
                    className={`${i < current ? "done" : ""} ${i === current ? "current" : ""}`}
                    onClick={() => changeStatus(stage)}
                  >
                    <span>{i < current ? <Check size={15} /> : i + 1}</span>
                    <small>{stage === "Completed" ? "Delivered" : stage}</small>
                  </button>
                );
              })}
            </div>
            <div className="status-line">
              <span>Current stage</span>
              <Select
                label="Order status"
                value={o.status}
                onChange={changeStatus}
                options={statuses}
              />
              {closed && <small>This order is closed</small>}
            </div>
          </section>
          <section>
            <SectionHeading title="The details that matter" />
            <div className="order-info-grid">
              <div>
                <CalendarDays size={18} />
                <span>
                  <small>Delivery date</small>
                  <strong>
                    {format(new Date(o.date + "T12:00:00"), "EEEE, d MMMM")}
                  </strong>
                </span>
              </div>
              <div>
                <Clock3 size={18} />
                <span>
                  <small>Time</small>
                  <strong>
                    {format(new Date(`${o.date}T${o.time}`), "h:mm a")}
                  </strong>
                </span>
              </div>
              <div>
                <Truck size={18} />
                <span>
                  <small>Fulfillment</small>
                  <strong>{o.fulfillment}</strong>
                </span>
              </div>
              <div>
                <MapPin size={18} />
                <span>
                  <small>
                    {o.fulfillment === "Pickup"
                      ? "Pickup location"
                      : "Delivery address"}
                  </small>
                  <strong>
                    {o.fulfillment === "Pickup"
                      ? d.business.address
                      : o.address || customer.address}
                  </strong>
                </span>
              </div>
            </div>
            {o.notes && (
              <div className="order-notes">
                <MessageSquare size={17} />
                <p>{o.notes}</p>
              </div>
            )}
          </section>
          <section>
            <SectionHeading title="Along the way" />
            <Form
              className="note-form"
              onSubmit={async (e) => {
                e.preventDefault();
                try {
                  await command(
                    { type: "order.note", id: o.id, text: note },
                    "Note added",
                  );
                  setNote("");
                } catch {}
              }}
            >
              <input
                aria-label="Internal note"
                placeholder="Add a little note for yourself..."
                value={note}
                onChange={(e) => setNote(e.target.value)}
                required
                maxLength={2000}
              />
              <Button type="submit" variant="secondary" disabled={!note.trim()}>
                <Plus size={15} />
                Add note
              </Button>
            </Form>
            <div className="activity-list">
              {[...o.activity]
                .sort((a, b) => b.date.localeCompare(a.date))
                .map((a) => (
                  <div key={a.id}>
                    <span className="activity-dot" />
                    <div>
                      <p>{a.text}</p>
                      <small>
                        {format(new Date(a.date), "d MMM yyyy, h:mm a")}
                      </small>
                    </div>
                  </div>
                ))}
            </div>
          </section>
        </div>
        <aside className="order-detail-side">
          <section className="price-panel">
            <SectionHeading title="The numbers" />
            <div className="price-lines">
              <div>
                <span>Cake & customization</span>
                <strong>{inr(pricing.selling)}</strong>
              </div>
              <div>
                <span>Delivery</span>
                <strong>{inr(o.config.delivery)}</strong>
              </div>
              {o.config.discount > 0 && (
                <div>
                  <span>Discount</span>
                  <strong>-{inr(o.config.discount)}</strong>
                </div>
              )}
              {pricing.tax > 0 && (
                <div>
                  <span>Tax ({o.config.tax}%)</span>
                  <strong>{inr(pricing.tax)}</strong>
                </div>
              )}
              <div className="price-total">
                <span>Order total</span>
                <strong>{inr(o.total)}</strong>
              </div>
              <div className="green-text">
                <span>Received</span>
                <strong>{inr(b.paid)}</strong>
              </div>
              <div className="balance-line">
                <span>Remaining</span>
                <strong>{inr(b.remaining)}</strong>
              </div>
            </div>
            <div className="profit-box">
              <div>
                <span>Production cost</span>
                <strong>{inr(o.cost)}</strong>
              </div>
              <div>
                <span>Gross profit</span>
                <strong>{inr(o.total - o.cost - pricing.tax)}</strong>
              </div>
              <small>Before operating expenses</small>
            </div>
          </section>
          <section>
            <SectionHeading title="Payment history" />
            {d.payments
              .filter((p) => p.orderId === o.id)
              .map((p) => (
                <div className="payment-row" key={p.id}>
                  <span className="payment-icon">
                    <CreditCard size={17} />
                  </span>
                  <span>
                    <strong>
                      {p.method}
                      {p.kind === "Refund" ? " · Refund" : ""}
                    </strong>
                    <small>{format(new Date(p.date), "d MMM yyyy")}</small>
                    <small>{p.reference}</small>
                  </span>
                  <strong>
                    {p.kind === "Refund" ? "-" : ""}
                    {inr(p.amount)}
                  </strong>
                </div>
              ))}
            {!d.payments.some((p) => p.orderId === o.id) && (
              <p className="muted">No payments recorded yet.</p>
            )}
          </section>
          <section>
            <Link className="person-cell" to={`/customers/${customer.id}`}>
              <Avatar name={customer.name} />
              <span>
                <strong>{customer.name}</strong>
                <small>{customer.phone}</small>
              </span>
              <ArrowUpRight size={15} />
            </Link>
          </section>
          <section>
            <details>
              <summary className="details-heading">Production recipe</summary>
              <div className="recipe-list">
                {recipeFor(o.config).map((i) => (
                  <div key={i.name}>
                    <span>{i.name}</span>
                    <strong>
                      {i.quantity} {i.unit}
                    </strong>
                  </div>
                ))}
              </div>
              <small className="muted">
                {o.inventoryConsumed
                  ? "Ingredients recorded in your pantry."
                  : "Ingredients are recorded when you complete the order."}
              </small>
              <Button variant="ghost" onClick={() => window.print()}>
                <Download size={15} />
                Print production sheet
              </Button>
            </details>
          </section>
        </aside>
      </div>
      {modal === "payment" && (
        <PaymentForm order={o} onClose={() => setModal("")} />
      )}{" "}
      {modal === "quote" && (
        <QuoteForm
          design={{ ...design, config: o.config, name: o.cakeName }}
          customerId={o.customerId}
          orderId={o.id}
          onClose={() => setModal("")}
        />
      )}{" "}
      {confirmStatus && (
        <Confirm
          title={
            confirmStatus === "Cancelled"
              ? "Cancel this celebration?"
              : "Delivered with love"
          }
          description={
            confirmStatus === "Cancelled"
              ? "This closes the order. Refunded payments and the order history are retained."
              : "Complete the order to recognize its revenue and profit."
          }
          danger={confirmStatus === "Cancelled"}
          onClose={() => setConfirmStatus(null)}
          onConfirm={async () => {
            await command(
              {
                type: "order.status",
                id: o.id,
                status: confirmStatus,
                consume: confirmStatus === "Completed" && consume,
              },
              confirmStatus === "Completed"
                ? "Order completed"
                : "Order cancelled",
            );
          }}
        >
          {confirmStatus === "Completed" && (
            <label className="checkbox-line">
              <input
                type="checkbox"
                checked={consume}
                onChange={(e) => setConsume(e.target.checked)}
              />
              Record recipe ingredients in inventory
            </label>
          )}
        </Confirm>
      )}
    </>
  );
}
