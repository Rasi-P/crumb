import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import { format, parseISO, addDays } from "date-fns";
import type { AppState } from "../domain/models";
import { inr, orderRevenue } from "../domain/pricing";

export function RevenueChart({
  data,
  from,
  to,
  profit = false,
}: {
  data: AppState;
  from: string;
  to: string;
  profit?: boolean;
}) {
  const days = Math.max(
    1,
    Math.round((+parseISO(to) - +parseISO(from)) / 86400000) + 1,
  );
  const step = Math.max(1, Math.ceil(days / 14));
  const points = [];
  for (let i = 0; i < days; i += step) {
    const date = format(addDays(parseISO(from), i), "yyyy-MM-dd");
    const end = format(
      addDays(parseISO(from), Math.min(days - 1, i + step - 1)),
      "yyyy-MM-dd",
    );
    const orders = data.orders.filter(
      (o) => o.date >= date && o.date <= end && o.status === "Completed",
    );
    points.push({
      date: format(parseISO(date), days > 90 ? "MMM d" : "d MMM"),
      revenue: orders.reduce((a, o) => a + orderRevenue(o), 0),
      profit: orders.reduce((a, o) => a + orderRevenue(o) - o.cost, 0),
    });
  }
  return (
    <div className="revenue-chart">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={points}
          margin={{ top: 14, right: 12, bottom: 0, left: -14 }}
        >
          <defs>
            <linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#96809d" stopOpacity={0.18} />
              <stop offset="100%" stopColor="#96809d" stopOpacity={0.015} />
            </linearGradient>
          </defs>
          <CartesianGrid
            vertical={false}
            stroke="var(--border)"
            strokeDasharray="4 5"
          />
          <XAxis
            dataKey="date"
            tickLine={false}
            axisLine={false}
            minTickGap={22}
            tick={{ fill: "var(--muted)", fontSize: 11 }}
            dy={10}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            tick={{ fill: "var(--muted)", fontSize: 11 }}
            tickFormatter={(n) => (n ? `${n / 1000}k` : "0")}
          />
          <Tooltip
            contentStyle={{
              border: "1px solid #e9e5ea",
              borderRadius: 8,
              fontSize: 12,
              boxShadow: "0 4px 18px #3023360c",
            }}
            formatter={(value) => inr(Number(value))}
          />
          <Area
            name="Revenue"
            type="monotone"
            dataKey="revenue"
            stroke="#7b6285"
            strokeWidth={2.5}
            fill="url(#revenueFill)"
            activeDot={{ r: 5, strokeWidth: 3, stroke: "#fff" }}
          />
          {profit && (
            <Area
              name="Gross profit"
              type="monotone"
              dataKey="profit"
              stroke="#83a895"
              strokeWidth={2}
              fill="transparent"
            />
          )}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
