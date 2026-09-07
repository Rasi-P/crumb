import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ArrowUpRight,
  CakeSlice,
  CalendarDays,
  Heart,
  IndianRupee,
  Mail,
  MapPin,
  Pencil,
  Phone,
  Plus,
  ShoppingBag,
  UserRoundPlus,
} from "lucide-react";
import { format } from "date-fns";
import { useData, useStore } from "../lib/store";
import { uid, flavors, type Customer } from "../domain/models";
import { balance, inr } from "../domain/pricing";
import {
  Avatar,
  BackLink,
  Badge,
  Button,
  CakeImage,
  EmptyState,
  Field,
  Form,
  Modal,
  PageHeader,
  SearchInput,
  SectionHeading,
  Select,
  Stat,
} from "../components/ui";

export function CustomerForm({
  customer,
  onClose,
  onSaved,
}: {
  customer?: Customer;
  onClose: () => void;
  onSaved?: (customer: Customer) => void;
}) {
  const [busy, setBusy] = useState(false);
  const command = useStore((s) => s.command);
  return (
    <Modal
      title={customer ? "A few personal details" : "Meet your next regular"}
      description={
        customer
          ? "Keep their preferences close, and their cakes personal."
          : "Every lovely cake starts with a person."
      }
      onClose={onClose}
    >
      <Form
        onSubmit={async (e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          const value: Customer = {
            id: customer?.id || uid(),
            name: String(f.get("name")).trim(),
            phone: String(f.get("phone")),
            email: String(f.get("email")),
            address: String(f.get("address")),
            flavor: String(f.get("flavor")),
            style: String(f.get("style")),
            colors: String(f.get("colors")),
            notes: String(f.get("notes")),
            createdAt: customer?.createdAt || new Date().toISOString(),
          };
          setBusy(true);
          try {
            await command(
              { type: "customer.save", value },
              customer ? "Customer updated" : "Customer added",
            );
            onSaved?.(value);
            onClose();
          } catch {
          } finally {
            setBusy(false);
          }
        }}
      >
        <Field label="Full name">
          <input
            name="name"
            required
            minLength={2}
            maxLength={100}
            autoFocus
            placeholder="e.g. Aisha Rahman"
            defaultValue={customer?.name}
          />
        </Field>
        <div className="form-grid">
          <Field label="Phone">
            <input
              name="phone"
              type="tel"
              placeholder="+91"
              defaultValue={customer?.phone}
            />
          </Field>
          <Field label="Email">
            <input
              name="email"
              type="email"
              placeholder="hello@example.com"
              defaultValue={customer?.email}
            />
          </Field>
        </div>
        <Field label="Delivery address">
          <input
            name="address"
            placeholder="Street, neighborhood, city"
            defaultValue={customer?.address}
          />
        </Field>
        <div className="form-grid">
          <Field label="Favorite flavor">
            <select name="flavor" defaultValue={customer?.flavor || "Vanilla"}>
              {flavors.map((f) => (
                <option key={f}>{f}</option>
              ))}
            </select>
          </Field>
          <Field label="Preferred style">
            <select name="style" defaultValue={customer?.style || "Minimal"}>
              {[
                "Minimal",
                "Floral",
                "Vintage",
                "Modern",
                "Playful",
                "Classic",
              ].map((f) => (
                <option key={f}>{f}</option>
              ))}
            </select>
          </Field>
        </div>
        <Field label="Favorite colors">
          <input
            name="colors"
            placeholder="Blush pink, ivory & gold"
            defaultValue={customer?.colors}
          />
        </Field>
        <Field label="Preferences, allergies & little details">
          <textarea
            name="notes"
            rows={3}
            placeholder="Anything that makes their cake extra personal..."
            defaultValue={customer?.notes}
          />
        </Field>
        <div className="modal-actions">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button loading={busy} type="submit">
            <UserRoundPlus size={16} />
            {customer ? "Save changes" : "Add customer"}
          </Button>
        </div>
      </Form>
    </Modal>
  );
}
export default function Customers() {
  const d = useData();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("Everyone");
  const [edit, setEdit] = useState<Customer | null | undefined>();
  const enriched = d.customers.map((c) => {
    const orders = d.orders.filter(
      (o) => o.customerId === c.id && o.status !== "Cancelled",
    );
    return {
      ...c,
      orders,
      spend: orders
        .filter((o) => o.status === "Completed")
        .reduce((n, o) => n + o.total, 0),
      outstanding: orders.reduce(
        (n, o) => n + balance(o, d.payments).remaining,
        0,
      ),
      last: orders
        .map((o) => o.date)
        .sort()
        .reverse()[0],
    };
  });
  const rows = enriched.filter(
    (c) =>
      `${c.name} ${c.email} ${c.phone}`
        .toLowerCase()
        .includes(query.toLowerCase()) &&
      (filter === "Everyone" ||
        (filter === "Returning customers" && c.orders.length > 1) ||
        (filter === "Outstanding balance" && c.outstanding > 0)),
  );
  return (
    <>
      <PageHeader
        eyebrow="THE PEOPLE BEHIND THE CELEBRATIONS"
        title="Good cakes. Great people."
        description="A little care for the customers who make it all worthwhile."
      >
        <Button onClick={() => setEdit(null)}>
          <Plus size={16} />
          Add customer
        </Button>
      </PageHeader>
      <div className="summary-band">
        <div>
          <span>Your community</span>
          <strong>
            {d.customers.length}
            <small>customers</small>
          </strong>
        </div>
        <div>
          <span>Coming back for seconds</span>
          <strong>
            {enriched.filter((c) => c.orders.length > 1).length}
            <small>returning customers</small>
          </strong>
        </div>
        <div>
          <span>Customer revenue</span>
          <strong>{inr(enriched.reduce((n, c) => n + c.spend, 0))}</strong>
        </div>
        <div>
          <span>A little love, on repeat</span>
          <strong>
            {enriched.length
              ? Math.round(
                  (enriched.filter((c) => c.orders.length > 1).length /
                    enriched.length) *
                    100,
                )
              : 0}
            %<small>repeat rate</small>
          </strong>
        </div>
      </div>
      <div className="list-toolbar">
        <SearchInput
          value={query}
          onChange={setQuery}
          placeholder="Find a customer..."
        />
        <Select
          label="Customer filter"
          value={filter}
          onChange={setFilter}
          options={["Everyone", "Returning customers", "Outstanding balance"]}
        />
        <span className="muted results-count">{rows.length} customers</span>
      </div>
      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Customer</th>
              <th>Orders</th>
              <th>Total spend</th>
              <th>Last order</th>
              <th>Relationship</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => (
              <tr key={c.id}>
                <td>
                  <Link to={`/customers/${c.id}`} className="person-cell">
                    <Avatar name={c.name} />
                    <span>
                      <strong>{c.name}</strong>
                      <small>{c.email}</small>
                    </span>
                  </Link>
                </td>
                <td>{c.orders.length}</td>
                <td className="number">{inr(c.spend)}</td>
                <td>
                  {c.last
                    ? format(new Date(c.last + "T12:00:00"), "d MMM yyyy")
                    : "No orders yet"}
                </td>
                <td>
                  <Badge tone={c.orders.length > 1 ? "purple" : "gray"}>
                    {c.orders.length > 1 ? "Returning" : "New customer"}
                  </Badge>
                </td>
                <td>
                  <Link
                    aria-label={`View ${c.name}`}
                    className="icon-button"
                    to={`/customers/${c.id}`}
                  >
                    <ArrowUpRight size={16} />
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length && (
          <EmptyState
            title="Your next regular is out there"
            description="Add a customer or try a different search."
            action={
              <Button onClick={() => setEdit(null)}>
                <Plus size={16} />
                Add customer
              </Button>
            }
          />
        )}
      </div>
      {edit !== undefined && (
        <CustomerForm
          customer={edit || undefined}
          onClose={() => setEdit(undefined)}
        />
      )}
    </>
  );
}
export function CustomerDetail() {
  const { id } = useParams();
  const d = useData();
  const c = d.customers.find((c) => c.id === id);
  const [edit, setEdit] = useState(false);
  if (!c)
    return (
      <EmptyState
        title="Customer not found"
        description="This customer may have been removed."
        action={
          <Link className="button secondary" to="/customers">
            All customers
          </Link>
        }
      />
    );
  const orders = d.orders
    .filter((o) => o.customerId === c.id)
    .sort((a, b) => b.date.localeCompare(a.date));
  const spend = orders
    .filter((o) => o.status === "Completed")
    .reduce((n, o) => n + o.total, 0);
  const outstanding = orders
    .filter((o) => o.status !== "Cancelled")
    .reduce((n, o) => n + balance(o, d.payments).remaining, 0);
  const designs = d.designs.filter((design) =>
    orders.some((o) => o.designId === design.id),
  );
  return (
    <>
      <BackLink to="/customers" label="All customers" />
      <div className="profile-heading">
        <Avatar name={c.name} size="large" />
        <div>
          <div className="eyebrow">A PART OF YOUR STORY</div>
          <h1>{c.name}</h1>
          <p>Customer since {format(new Date(c.createdAt), "MMMM yyyy")}</p>
        </div>
        <div className="profile-actions">
          <Button variant="secondary" onClick={() => setEdit(true)}>
            <Pencil size={15} />
            Edit profile
          </Button>
          <Link to={`/orders/new?customer=${c.id}`} className="button primary">
            <Plus size={16} />
            New order
          </Link>
        </div>
      </div>
      <div className="detail-layout">
        <aside className="detail-side">
          <section>
            <h3>The little details</h3>
            <a className="contact-line" href={`tel:${c.phone}`}>
              <Phone size={16} />
              {c.phone || "No phone added"}
            </a>
            <a className="contact-line" href={`mailto:${c.email}`}>
              <Mail size={16} />
              {c.email || "No email added"}
            </a>
            <p className="contact-line">
              <MapPin size={16} />
              {c.address || "No address added"}
            </p>
          </section>
          <section>
            <h3>Made just for them</h3>
            <dl className="detail-dl">
              <dt>Favorite flavor</dt>
              <dd>{c.flavor}</dd>
              <dt>Preferred style</dt>
              <dd>{c.style}</dd>
              <dt>Favorite colors</dt>
              <dd>{c.colors || "Not added yet"}</dd>
            </dl>
          </section>
          <section className="personal-note">
            <Heart size={18} />
            <h3>Worth remembering</h3>
            <p>
              {c.notes ||
                "Add preferences and special details to make every order personal."}
            </p>
            <button className="text-link" onClick={() => setEdit(true)}>
              Edit notes
              <Pencil size={13} />
            </button>
          </section>
        </aside>
        <div className="detail-main">
          <div className="stats-grid three">
            <Stat
              label="Celebrations together"
              value={String(orders.length)}
              icon={<ShoppingBag size={17} />}
              foot="Every occasion, a little sweeter"
            />
            <Stat
              label="Total revenue"
              value={inr(spend)}
              icon={<IndianRupee size={17} />}
              foot="From completed orders"
            />
            <Stat
              label="Outstanding balance"
              value={inr(outstanding)}
              icon={<ReceiptIcon />}
              foot={outstanding ? "Across open orders" : "All caught up"}
            />
          </div>
          <section>
            <SectionHeading
              title="Their celebrations"
              action="New order"
              to={`/orders/new?customer=${c.id}`}
            />
            <div className="customer-order-list">
              {orders.map((o) => (
                <Link to={`/orders/${o.id}`} key={o.id}>
                  <CakeImage
                    index={
                      d.designs.find((design) => design.id === o.designId)
                        ?.image
                    }
                    label={o.cakeName}
                  />
                  <div>
                    <strong>{o.cakeName}</strong>
                    <small>
                      #{o.number} ·{" "}
                      {format(new Date(o.date + "T12:00:00"), "d MMM yyyy")}
                    </small>
                  </div>
                  <Badge>{o.status}</Badge>
                  <strong>{inr(o.total)}</strong>
                  <ArrowUpRight size={15} />
                </Link>
              ))}
              {!orders.length && (
                <EmptyState
                  title="Their first celebration awaits"
                  description="Create a cake as unique as they are."
                  action={
                    <Link
                      className="button primary"
                      to={`/orders/new?customer=${c.id}`}
                    >
                      Create order
                    </Link>
                  }
                />
              )}
            </div>
          </section>
          <section>
            <SectionHeading title="A few favorites" />
            <div className="mini-design-grid">
              {designs.map((design) => (
                <Link key={design.id} to={`/studio/${design.id}`}>
                  <CakeImage index={design.image} label={design.name} />
                  <strong>{design.name}</strong>
                  <small>{design.category}</small>
                </Link>
              ))}
            </div>
          </section>
          <section>
            <SectionHeading title="Along the way" />
            <div className="activity-list">
              {orders
                .flatMap((o) =>
                  o.activity.map((a) => ({ ...a, number: o.number })),
                )
                .sort((a, b) => b.date.localeCompare(a.date))
                .slice(0, 8)
                .map((a) => (
                  <div key={a.id}>
                    <span className="activity-dot" />
                    <div>
                      <p>{a.text}</p>
                      <small>
                        Order #{a.number} ·{" "}
                        {format(new Date(a.date), "d MMM, h:mm a")}
                      </small>
                    </div>
                  </div>
                ))}
            </div>
          </section>
        </div>
      </div>
      {edit && <CustomerForm customer={c} onClose={() => setEdit(false)} />}
    </>
  );
}
function ReceiptIcon() {
  return <IndianRupee size={17} />;
}
