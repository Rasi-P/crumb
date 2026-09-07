import { useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowUpRight,
  Download,
  IndianRupee,
  ShoppingBag,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { useData } from "../lib/store";
import { businessMetrics, inr, orderRevenue } from "../domain/pricing";
import { dateOffset, today } from "../domain/models";
import {
  Avatar,
  Button,
  CakeImage,
  Field,
  PageHeader,
  SectionHeading,
  Select,
  Stat,
  Tabs,
} from "../components/ui";
import { RevenueChart } from "../components/RevenueChart";

export default function Analytics() {
  const d = useData();
  const [period, setPeriod] = useState("30");
  const [from, setFrom] = useState(dateOffset(-30));
  const [to, setTo] = useState(today());
  const start = period === "custom" ? from : dateOffset(-Number(period) + 1);
  const end = period === "custom" ? to : today();
  const m = businessMetrics(d, start, end);
  const orders = d.orders.filter(
    (o) => o.status === "Completed" && o.date >= start && o.date <= end,
  );
  const best = d.products
    .map((p) => {
      const list = orders.filter((o) => o.designId === p.designId);
      return {
        ...p,
        count: list.length,
        revenue: list.reduce((n, o) => n + orderRevenue(o), 0),
        profit: list.reduce((n, o) => n + orderRevenue(o) - o.cost, 0),
      };
    })
    .filter((p) => p.count)
    .sort((a, b) => b.revenue - a.revenue);
  const customers = d.customers
    .map((c) => ({
      ...c,
      spend: orders
        .filter((o) => o.customerId === c.id)
        .reduce((n, o) => n + o.total, 0),
    }))
    .filter((c) => c.spend)
    .sort((a, b) => b.spend - a.spend)
    .slice(0, 5);
  const flavors = Array.from(new Set(orders.map((o) => o.config.flavor)))
    .map((flavor) => ({
      name: flavor,
      count: orders.filter((o) => o.config.flavor === flavor).length,
    }))
    .sort((a, b) => b.count - a.count);
  const cats = Array.from(new Set(d.expenses.map((e) => e.category)))
    .map((category) => ({
      name: category,
      value: d.expenses
        .filter(
          (e) => e.category === category && e.date >= start && e.date <= end,
        )
        .reduce((n, e) => n + e.amount, 0),
    }))
    .filter((c) => c.value)
    .sort((a, b) => b.value - a.value);
  return (
    <>
      <PageHeader
        eyebrow="LOOK AT WHAT YOU’RE GROWING"
        title="Every slice tells a story"
        description="A thoughtful look at the business you’re building."
      >
        <Select
          label="Analytics date range"
          value={period}
          onChange={setPeriod}
          options={[
            { value: "7", label: "Last 7 days" },
            { value: "30", label: "Last 30 days" },
            { value: "90", label: "Last 3 months" },
            { value: "365", label: "Last 12 months" },
            { value: "custom", label: "Custom dates" },
          ]}
        />
        <Button variant="secondary" onClick={() => window.print()}>
          <Download size={16} />
          Export report
        </Button>
      </PageHeader>
      {period === "custom" && (
        <div className="filter-panel">
          <Field label="From">
            <input
              type="date"
              value={from}
              max={to}
              onChange={(e) => setFrom(e.target.value)}
            />
          </Field>
          <Field label="To">
            <input
              type="date"
              value={to}
              min={from}
              onChange={(e) => setTo(e.target.value)}
            />
          </Field>
        </div>
      )}
      <div className="stats-grid">
        <Stat
          label="Revenue"
          value={inr(m.revenue)}
          icon={<IndianRupee size={17} />}
          foot={`${m.completed} completed orders`}
        />
        <Stat
          label="Net profit"
          value={inr(m.netProfit)}
          icon={<TrendingUp size={17} />}
          foot={`${m.margin.toFixed(1)}% net margin`}
        />
        <Stat
          label="Average order"
          value={inr(m.average)}
          icon={<ShoppingBag size={17} />}
          foot="Per completed celebration"
        />
        <Stat
          label="Operating expenses"
          value={inr(m.expenses)}
          icon={<Wallet size={17} />}
          foot="Excludes recipe production costs"
        />
      </div>
      <div className="analytics-top">
        <section>
          <SectionHeading
            title="Your business, in bloom"
            subtitle="Revenue and gross profit over time."
          />
          <div className="chart-summary">
            <strong>{inr(m.revenue)}</strong>
            <div className="button-row">
              <span className="chart-legend">
                <i />
                Revenue
              </span>
              <span className="chart-legend green">
                <i />
                Gross profit
              </span>
            </div>
          </div>
          <RevenueChart data={d} from={start} to={end} profit />
        </section>
        <section className="profit-waterfall">
          <SectionHeading title="Where every rupee goes" />
          <div className="money-breakdown">
            <div>
              <span>Revenue</span>
              <strong>{inr(m.revenue)}</strong>
            </div>
            <div>
              <span>Production costs</span>
              <strong>− {inr(m.cost)}</strong>
            </div>
            <div>
              <span>Gross profit</span>
              <strong>{inr(m.grossProfit)}</strong>
            </div>
            <div>
              <span>Operating expenses</span>
              <strong>− {inr(m.expenses)}</strong>
            </div>
            <div className="net-profit">
              <span>Net profit</span>
              <strong>{inr(m.netProfit)}</strong>
            </div>
          </div>
          <div className="margin-display">
            <div className="margin-track">
              <i
                style={{ width: `${Math.max(0, Math.min(100, m.margin))}%` }}
              />
            </div>
            <span>{m.margin.toFixed(1)}% stays with your business</span>
          </div>
        </section>
      </div>
      <div className="analytics-mid">
        <section>
          <SectionHeading
            title="A taste for the favorites"
            subtitle="Your best-selling cakes, by revenue."
            action="Catalog"
            to="/catalog"
          />
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Cake</th>
                  <th>Orders</th>
                  <th>Revenue</th>
                  <th>Gross profit</th>
                </tr>
              </thead>
              <tbody>
                {best.slice(0, 6).map((p) => (
                  <tr key={p.id}>
                    <td>
                      <Link className="cake-cell" to={`/studio/${p.designId}`}>
                        <CakeImage
                          index={
                            d.designs.find((x) => x.id === p.designId)?.image
                          }
                          label={p.name}
                        />
                        <strong>{p.name}</strong>
                      </Link>
                    </td>
                    <td>{p.count}</td>
                    <td className="number">{inr(p.revenue)}</td>
                    <td className="green-text number">{inr(p.profit)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!best.length && (
              <p className="empty-inline">
                Completed orders will bring this view to life.
              </p>
            )}
          </div>
        </section>
        <section>
          <SectionHeading
            title="The flavors they love"
            subtitle="A little insight for your next menu."
          />
          <div className="flavor-list">
            {flavors.map((f, i) => (
              <div key={f.name}>
                <div>
                  <span>
                    <i
                      style={{
                        background: [
                          "#8f7898",
                          "#b8a184",
                          "#8aa697",
                          "#c48990",
                          "#8faabc",
                        ][i % 5],
                      }}
                    />
                    {f.name}
                  </span>
                  <strong>
                    {Math.round((f.count / Math.max(1, orders.length)) * 100)}%
                  </strong>
                </div>
                <div className="flavor-track">
                  <span
                    style={{
                      width: `${(f.count / Math.max(1, orders.length)) * 100}%`,
                      background: [
                        "#9b85a3",
                        "#c4ad94",
                        "#a0b7a9",
                        "#d5a1a7",
                        "#a5bdce",
                      ][i % 5],
                    }}
                  />
                </div>
                <small>{f.count} orders</small>
              </div>
            ))}
            {!flavors.length && (
              <p className="empty-inline">
                Your next completed cake will appear here.
              </p>
            )}
          </div>
        </section>
      </div>
      <div className="analytics-bottom">
        <section>
          <SectionHeading title="Your lovely regulars" />
          <div className="regulars-list">
            {customers.map((c, i) => (
              <Link key={c.id} to={`/customers/${c.id}`}>
                <span className="rank">0{i + 1}</span>
                <Avatar name={c.name} />
                <strong>{c.name}</strong>
                <span>{inr(c.spend)}</span>
                <ArrowUpRight size={14} />
              </Link>
            ))}
          </div>
        </section>
        <section>
          <SectionHeading
            title="A closer look at expenses"
            action="View expenses"
            to="/expenses"
          />
          <div className="expense-breakdown">
            {cats.map((c, i) => (
              <div key={c.name}>
                <span
                  className="expense-category-dot"
                  style={{
                    background: [
                      "#9b85a3",
                      "#a0b7a9",
                      "#c4ad94",
                      "#d5a1a7",
                      "#a5bdce",
                    ][i % 5],
                  }}
                />
                <span>{c.name}</span>
                <div className="expense-bar">
                  <i
                    style={{
                      width: `${(c.value / Math.max(...cats.map((c) => c.value), 1)) * 100}%`,
                    }}
                  />
                </div>
                <strong>{inr(c.value)}</strong>
              </div>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}
