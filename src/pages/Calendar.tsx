import { useState } from "react";
import { Link } from "react-router-dom";
import {
  addDays,
  addMonths,
  addWeeks,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import {
  ArrowUpRight,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Plus,
} from "lucide-react";
import { useData } from "../lib/store";
import { today } from "../domain/models";
import {
  Badge,
  Button,
  CakeImage,
  EmptyState,
  IconButton,
  PageHeader,
  Tabs,
} from "../components/ui";

export default function Calendar() {
  const d = useData();
  const [anchor, setAnchor] = useState(new Date());
  const [view, setView] = useState("Month");
  const [selected, setSelected] = useState(today());
  const [events, setEvents] = useState("All events");
  const orders = d.orders.filter((o) => o.status !== "Cancelled");
  const move = (n: number) => {
    const next =
      view === "Month"
        ? addMonths(anchor, n)
        : view === "Week"
          ? addWeeks(anchor, n)
          : addDays(anchor, n);
    setAnchor(next);
    if (view === "Day") setSelected(format(next, "yyyy-MM-dd"));
  };
  const days =
    view === "Month"
      ? eachDayOfInterval({
          start: startOfWeek(startOfMonth(anchor), { weekStartsOn: 1 }),
          end: endOfWeek(endOfMonth(anchor), { weekStartsOn: 1 }),
        })
      : view === "Week"
        ? eachDayOfInterval({
            start: startOfWeek(anchor, { weekStartsOn: 1 }),
            end: endOfWeek(anchor, { weekStartsOn: 1 }),
          })
        : [anchor];
  const filtered = orders.filter(
    (o) =>
      events === "All events" ||
      events === o.fulfillment ||
      (events === "Production" &&
        ["Confirmed", "Paid", "Preparing", "Baking", "Decorating"].includes(
          o.status,
        )),
  );
  const selectedOrders = filtered
    .filter((o) => o.date === selected)
    .sort((a, b) => a.time.localeCompare(b.time));
  const tomorrow = orders.filter(
    (o) => o.date === format(addDays(new Date(), 1), "yyyy-MM-dd"),
  ).length;
  return (
    <>
      <PageHeader
        eyebrow="A LITTLE PLANNING. A LOT OF PEACE OF MIND."
        title="Days worth celebrating"
        description={`${tomorrow} cake${tomorrow === 1 ? "" : "s"} to make tomorrow. There’s something lovely ahead.`}
      >
        <Link className="button primary" to="/orders/new">
          <Plus size={16} />
          New order
        </Link>
      </PageHeader>
      <div className="calendar-toolbar">
        <div className="button-row">
          <h2>
            {format(anchor, view === "Day" ? "d MMMM yyyy" : "MMMM yyyy")}
          </h2>
          <IconButton label="Previous period" onClick={() => move(-1)}>
            <ChevronLeft size={18} />
          </IconButton>
          <IconButton label="Next period" onClick={() => move(1)}>
            <ChevronRight size={18} />
          </IconButton>
          <Button
            variant="secondary"
            onClick={() => {
              setAnchor(new Date());
              setSelected(today());
            }}
          >
            Today
          </Button>
        </div>
        <Tabs
          className="segmented"
          options={["Month", "Week", "Day"]}
          value={view}
          onChange={setView}
        />
      </div>
      <div className="calendar-layout">
        <div className="calendar-main">
          <Tabs
            options={["All events", "Delivery", "Pickup", "Production"]}
            value={events}
            onChange={setEvents}
          />
          {view === "Day" ? (
            <div className="day-calendar">
              {Array.from({ length: 13 }, (_, i) => i + 7).map((hour) => (
                <div className="day-hour" key={hour}>
                  <span>{format(new Date(2026, 0, 1, hour), "h a")}</span>
                  <div>
                    {filtered
                      .filter(
                        (o) =>
                          o.date === format(anchor, "yyyy-MM-dd") &&
                          Number(o.time.split(":")[0]) === hour,
                      )
                      .map((o) => (
                        <Link
                          key={o.id}
                          className={`day-event event-${o.fulfillment.toLowerCase()}`}
                          to={`/orders/${o.id}`}
                        >
                          <strong>
                            {o.time} · {o.cakeName}
                          </strong>
                          <small>
                            {
                              d.customers.find((c) => c.id === o.customerId)
                                ?.name
                            }{" "}
                            · {o.fulfillment}
                          </small>
                          <Badge>{o.status}</Badge>
                        </Link>
                      ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <>
              <div className="calendar-weekdays">
                {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(
                  (day) => (
                    <span key={day}>{day}</span>
                  ),
                )}
              </div>
              <div className={`calendar-grid ${view.toLowerCase()}`}>
                {days.map((day) => {
                  const date = format(day, "yyyy-MM-dd");
                  const items = filtered
                    .filter((o) => o.date === date)
                    .sort((a, b) => a.time.localeCompare(b.time));
                  return (
                    <div
                      key={date}
                      className={`calendar-cell ${!isSameMonth(day, anchor) && view === "Month" ? "other-month" : ""} ${selected === date ? "selected" : ""}`}
                      onClick={() => setSelected(date)}
                    >
                      <button
                        className={`calendar-date ${date === today() ? "today" : ""}`}
                        onClick={() => setSelected(date)}
                        aria-label={format(day, "EEEE d MMMM")}
                      >
                        {format(day, "d")}
                      </button>
                      <div className="calendar-events">
                        {items.slice(0, view === "Month" ? 3 : 20).map((o) => (
                          <Link
                            key={o.id}
                            to={`/orders/${o.id}`}
                            className={`calendar-event event-${o.fulfillment.toLowerCase()}`}
                          >
                            <span>{o.time}</span>
                            <strong>
                              {
                                d.customers
                                  .find((c) => c.id === o.customerId)
                                  ?.name.split(" ")[0]
                              }
                            </strong>
                            {view === "Week" && <small>{o.cakeName}</small>}
                          </Link>
                        ))}
                        {view === "Month" && items.length > 3 && (
                          <button
                            className="more-events"
                            onClick={() => setSelected(date)}
                          >
                            +{items.length - 3} more
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
          <div className="calendar-legend">
            <span>
              <i className="purple-dot" />
              Pickup
            </span>
            <span>
              <i className="green-dot" />
              Delivery
            </span>
            <span>{filtered.length} celebrations in your diary</span>
          </div>
        </div>
        <aside className="calendar-agenda">
          <div className="eyebrow">ON THE COUNTER</div>
          <h2>{format(new Date(selected + "T12:00:00"), "EEEE, d MMM")}</h2>
          <p>
            {selectedOrders.length} cake{selectedOrders.length === 1 ? "" : "s"}{" "}
            to make someone’s day
          </p>
          {selectedOrders.map((o) => (
            <Link
              className="calendar-agenda-item"
              key={o.id}
              to={`/orders/${o.id}`}
            >
              <div>
                <Clock3 size={13} />
                {o.time}
                <span>{o.fulfillment}</span>
              </div>
              <CakeImage
                index={d.designs.find((x) => x.id === o.designId)?.image}
                label={o.cakeName}
              />
              <strong>{o.cakeName}</strong>
              <small>
                {d.customers.find((c) => c.id === o.customerId)?.name}
              </small>
              <Badge>{o.status}</Badge>
            </Link>
          ))}
          {!selectedOrders.length && (
            <EmptyState
              title="Room for a little inspiration"
              description="No orders on this day."
              action={
                <Link to="/studio" className="text-link">
                  Visit Cake Studio
                  <ArrowUpRight size={14} />
                </Link>
              }
            />
          )}
        </aside>
      </div>
    </>
  );
}
