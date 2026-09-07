import { useState } from "react";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import {
  ArrowDownLeft,
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  ChevronDown,
  Clock3,
  CreditCard,
  IndianRupee,
  Package,
  Plus,
  Receipt,
  ShoppingBag,
  Sparkles,
  TrendingUp,
  UserRoundPlus,
  WandSparkles,
} from "lucide-react";
import { useData } from "../lib/store";
import { dateOffset, today } from "../domain/models";
import { businessMetrics, inr, orderRevenue } from "../domain/pricing";
import {
  Badge,
  Button,
  CakeImage,
  EmptyState,
  PageHeader,
  SectionHeading,
  Select,
  Stat,
  Tabs,
} from "../components/ui";
import { RevenueChart } from "../components/RevenueChart";
import { CustomerForm } from "./Customers";
import { ExpenseForm } from "./Operations";

export default function Dashboard() {
  const data = useData();
  const [period, setPeriod] = useState("30D");
  const [agenda, setAgenda] = useState("Today");
  const [modal, setModal] = useState("");
  const days =
    period === "7D" ? 7 : period === "30D" ? 30 : period === "3M" ? 90 : 365;
  const m = businessMetrics(data, dateOffset(-days + 1), today());
  const prev = businessMetrics(
    data,
    dateOffset(-days * 2 + 1),
    dateOffset(-days),
  );
  const change = (n: number, p: number) =>
    p > 0
      ? `${n >= p ? "+" : ""}${(((n - p) / p) * 100).toFixed(1)}%`
      : undefined;
  const day = agenda === "Today" ? today() : dateOffset(1);
  const orders = data.orders
    .filter((o) => o.date === day && o.status !== "Cancelled")
    .sort((a, b) => a.time.localeCompare(b.time));
  const low = data.inventory.filter((i) => i.stock <= i.minimum);
  const pending = data.orders
    .filter(
      (o) => o.date > today() && !["Cancelled", "Completed"].includes(o.status),
    )
    .sort((a, b) => a.date.localeCompare(b.date));
  const best = data.products
    .map((p) => {
      const orders = data.orders.filter(
        (o) => o.designId === p.designId && o.status === "Completed",
      );
      return {
        ...p,
        count: orders.length,
        revenue: orders.reduce((a, o) => a + orderRevenue(o), 0),
        image: data.designs.find((d) => d.id === p.designId)?.image || 0,
      };
    })
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 3);
  return (
    <>
      <PageHeader
        eyebrow={format(new Date(), "EEEE, d MMMM yyyy")}
        title={`Good morning, ${data.business.owner}`}
        description="A fresh day, a few celebrations, and a little magic to make."
      >
        <Select
          label="Dashboard period"
          value={period}
          onChange={setPeriod}
          options={[
            { value: "7D", label: "Last 7 days" },
            { value: "30D", label: "Last 30 days" },
            { value: "3M", label: "Last 3 months" },
            { value: "12M", label: "Last 12 months" },
          ]}
        />
        <Link className="button primary" to="/orders/new">
          <Plus size={17} />
          New order
        </Link>
      </PageHeader>
      <div className="stats-grid">
        <Stat
          label="Total revenue"
          value={inr(m.revenue)}
          change={change(m.revenue, prev.revenue)}
          icon={<IndianRupee size={17} />}
          foot={
            !prev.revenue ? `${m.completed} completed celebrations` : undefined
          }
        />
        <Stat
          label="Orders"
          value={String(m.orders)}
          change={change(m.orders, prev.orders)}
          icon={<ShoppingBag size={17} />}
          foot={!prev.orders ? "A little joy in every box" : undefined}
        />
        <Stat
          label="Net profit"
          value={inr(m.netProfit)}
          change={change(m.netProfit, prev.netProfit)}
          icon={<TrendingUp size={17} />}
          foot={`${m.margin.toFixed(1)}% profit margin`}
        />
        <Stat
          label="Pending payments"
          value={inr(m.outstanding)}
          icon={<CreditCard size={17} />}
          foot="A gentle reminder goes a long way"
        />
      </div>
      <div className="dashboard-upper">
        <section className="agenda-section">
          <div className="section-heading">
            <div className="heading-inline">
              <h2>On your kitchen counter</h2>
              <span className="count-badge">{orders.length}</span>
            </div>
            <Tabs
              className="segmented small"
              value={agenda}
              onChange={setAgenda}
              options={["Today", "Tomorrow"]}
            />
          </div>
          <div className="agenda-list">
            {orders.map((o) => (
              <Link to={`/orders/${o.id}`} className="agenda-row" key={o.id}>
                <div className="agenda-time">
                  <strong>
                    {format(new Date(`${o.date}T${o.time}`), "h:mm")}
                  </strong>
                  <small>{format(new Date(`${o.date}T${o.time}`), "a")}</small>
                </div>
                <div className="timeline-mark">
                  <i />
                </div>
                <CakeImage
                  index={data.designs.find((d) => d.id === o.designId)?.image}
                  label={o.cakeName}
                />
                <div className="agenda-info">
                  <strong>{o.cakeName}</strong>
                  <span>
                    {data.customers.find((c) => c.id === o.customerId)?.name}
                    <i /> {o.fulfillment}
                  </span>
                </div>
                <div className="agenda-end">
                  <Badge>{o.status}</Badge>
                  <strong>{inr(o.total)}</strong>
                </div>
                <ArrowUpRight size={16} className="row-arrow" />
              </Link>
            ))}
            {!orders.length && (
              <EmptyState
                title="A little room to breathe"
                description="No cakes scheduled for this day."
              />
            )}
          </div>
          <Link className="agenda-footer" to="/orders?view=board">
            <span>
              <span className="online-dot" />
              Your kitchen, beautifully in flow
            </span>
            <span>
              Production board
              <ArrowRight size={14} />
            </span>
          </Link>
        </section>
        <section className="studio-feature">
          <div className="studio-feature-copy">
            <span className="eyebrow">
              <Sparkles size={13} />
              YOUR CREATIVE CORNER
            </span>
            <h2>
              From a little idea
              <br />
              to a lovely cake.
            </h2>
            <p>
              Make something that’s
              <br />
              uniquely theirs.
            </p>
            <Link to="/studio" className="button studio-button">
              <WandSparkles size={15} />
              Open Cake Studio
              <ArrowUpRight size={15} />
            </Link>
          </div>
          <CakeImage
            index={0}
            className="studio-feature-image"
            label="Handcrafted two-tier pink floral cake"
          />
          <span className="studio-feature-caption">
            A little imagination. Endless possibilities.
          </span>
        </section>
      </div>
      <div className="quick-actions">
        <span>Make room for what’s next</span>
        <Link to="/orders/new">
          <Plus size={16} />
          New order
        </Link>
        <button onClick={() => setModal("customer")}>
          <UserRoundPlus size={16} />
          Add customer
        </button>
        <Link to="/catalog?new=1">
          <CakeSliceIcon />
          New cake
        </Link>
        <button onClick={() => setModal("expense")}>
          <Receipt size={16} />
          Record expense
        </button>
      </div>
      <div className="dashboard-lower">
        <section className="chart-section">
          <div className="section-heading">
            <div>
              <h2>A slice of your growth</h2>
              <p>Small moments. A growing business.</p>
            </div>
            <Tabs
              options={["7D", "30D", "3M", "12M"]}
              value={period}
              onChange={setPeriod}
              className="segmented small"
            />
          </div>
          <div className="chart-summary">
            <strong>{inr(m.revenue)}</strong>
            <span className="chart-legend">
              <i />
              Revenue
            </span>
          </div>
          <RevenueChart data={data} from={dateOffset(-days + 1)} to={today()} />
        </section>
        <section className="bestsellers-section">
          <SectionHeading
            title="The crowd favorites"
            subtitle="The cakes they come back for."
            action="Catalog"
            to="/catalog"
          />
          <div className="bestsellers">
            {best.map((p, i) => (
              <Link key={p.id} to={`/studio/${p.designId}`}>
                <span className="rank">0{i + 1}</span>
                <CakeImage index={p.image} label={p.name} />
                <span className="bestseller-info">
                  <strong>{p.name}</strong>
                  <small>
                    {p.count} orders<span>·</span>
                    {p.category}
                  </small>
                </span>
                <strong>{inr(p.revenue)}</strong>
              </Link>
            ))}
          </div>
          <Link to="/analytics" className="bestseller-footer">
            There’s a story in every slice
            <ArrowUpRight size={15} />
          </Link>
        </section>
      </div>
      <div className="dashboard-bottom">
        <section>
          <SectionHeading
            title="Coming out of the oven soon"
            action="Calendar"
            to="/calendar"
          />
          <div className="upcoming-strip">
            {pending.slice(0, 3).map((o) => (
              <Link key={o.id} to={`/orders/${o.id}`}>
                <span className="date-tile">
                  <small>{format(new Date(o.date + "T12:00:00"), "MMM")}</small>
                  <strong>
                    {format(new Date(o.date + "T12:00:00"), "dd")}
                  </strong>
                </span>
                <span>
                  <strong>
                    {data.customers.find((c) => c.id === o.customerId)?.name}
                  </strong>
                  <small>{o.cakeName}</small>
                  <span>
                    {o.time} · {o.fulfillment}
                  </span>
                </span>
                <ArrowUpRight size={15} />
              </Link>
            ))}
          </div>
        </section>
        <section>
          <SectionHeading
            title="A little pantry check"
            action="View pantry"
            to="/inventory"
          />
          <div className="low-stock-summary">
            <span className="low-stock-icon">
              <Package size={22} />
            </span>
            <span>
              <strong>{low.length} essentials running low</strong>
              <p>
                {low
                  .slice(0, 3)
                  .map((i) =>
                    i.name.replace("Unsalted ", "").replace("Whipping ", ""),
                  )
                  .join(", ")}
                {low.length > 3 ? " & more" : ""}
              </p>
            </span>
            <Link
              className="icon-button"
              to="/inventory?low=1"
              aria-label="View low stock"
            >
              <ArrowRight size={17} />
            </Link>
          </div>
        </section>
      </div>
      {modal === "customer" && <CustomerForm onClose={() => setModal("")} />}{" "}
      {modal === "expense" && <ExpenseForm onClose={() => setModal("")} />}
    </>
  );
}
function CakeSliceIcon() {
  return <ShoppingBag size={16} />;
}
