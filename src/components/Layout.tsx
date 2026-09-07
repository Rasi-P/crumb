import { useState, useEffect } from "react";
import {
  Link,
  NavLink,
  Outlet,
  useLocation,
  useNavigate,
} from "react-router-dom";
import {
  LayoutDashboard,
  ShoppingBag,
  UsersRound,
  WandSparkles,
  BookOpen,
  CalendarDays,
  Package,
  Receipt,
  ChartNoAxesCombined,
  Settings2,
  CircleHelp,
  Search,
  Bell,
  ChevronDown,
  ChevronsLeft,
  ChevronsRight,
  Plus,
  ArrowUpRight,
  CakeSlice,
  Command,
  Menu as MenuIcon,
  X,
  Sun,
  CheckCheck,
  House,
} from "lucide-react";
import {
  Avatar,
  Badge,
  Button,
  CakeImage,
  EmptyState,
  IconButton,
  Modal,
  SearchInput,
} from "./ui";
import { useData, useStore } from "../lib/store";
import { inr } from "../domain/pricing";

const navigation = [
  ["Dashboard", "/", LayoutDashboard],
  ["Orders", "/orders", ShoppingBag],
  ["Customers", "/customers", UsersRound],
  ["Cake Studio", "/studio", WandSparkles],
  ["Catalog", "/catalog", BookOpen],
  ["Calendar", "/calendar", CalendarDays],
  ["Inventory", "/inventory", Package],
  ["Expenses", "/expenses", Receipt],
  ["Analytics", "/analytics", ChartNoAxesCombined],
] as const;
export function Layout() {
  const data = useData();
  const [collapsed, setCollapsed] = useState(false);
  const [mobile, setMobile] = useState(false);
  const [search, setSearch] = useState(false);
  const [notifications, setNotifications] = useState(false);
  const [help, setHelp] = useState(false);
  const location = useLocation();
  const command = useStore((s) => s.command);
  const title =
    navigation.find((n) =>
      n[1] === "/"
        ? location.pathname === "/"
        : location.pathname.startsWith(n[1]),
    )?.[0] || "Settings";
  useEffect(() => {
    setMobile(false);
  }, [location.pathname]);
  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === "visible")
        void useStore.getState().refresh();
    };
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    const interval = setInterval(refresh, 15000);
    return () => {
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
      clearInterval(interval);
    };
  }, []);
  useEffect(() => {
    const listener = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setSearch((v) => !v);
      }
    };
    document.addEventListener("keydown", listener);
    return () => document.removeEventListener("keydown", listener);
  }, []);
  useEffect(() => {
    const dark =
      data.business.theme === "Dark" ||
      (data.business.theme === "System" &&
        matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.dataset.theme = dark ? "dark" : "light";
  }, [data.business.theme]);
  return (
    <div className={`app-shell ${collapsed ? "collapsed" : ""}`}>
      {mobile && (
        <div className="sidebar-backdrop" onClick={() => setMobile(false)} />
      )}
      <aside className={`sidebar ${mobile ? "mobile-open" : ""}`}>
        <Link to="/" className="brand">
          <span className="brand-mark">
            <CakeSlice size={26} strokeWidth={1.6} />
          </span>
          <span>
            crumb<span className="brand-dot">.</span>
          </span>
        </Link>
        <Link to="/settings" className="business-switch">
          <span className="business-monogram">L</span>
          <span>
            <strong>{data.business.name}</strong>
            <small>Your sweet little business</small>
          </span>
          <ChevronDown size={14} />
        </Link>
        <div className="nav-label">WORKSPACE</div>
        <nav>
          {navigation.map(([name, path, Icon]) => (
            <NavLink
              key={name}
              to={path}
              end={path === "/"}
              className={({ isActive }) =>
                `${isActive ? "active" : ""} ${name === "Cake Studio" ? "studio-nav" : ""}`
              }
              title={collapsed ? name : undefined}
            >
              <Icon size={19} strokeWidth={1.6} />
              <span>{name}</span>
              {name === "Orders" && (
                <small>
                  {
                    data.orders.filter(
                      (o) =>
                        !["Completed", "Cancelled", "Inquiry"].includes(
                          o.status,
                        ),
                    ).length
                  }
                </small>
              )}
              {name === "Cake Studio" && <span className="nav-new">NEW</span>}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-note">
            <span className="note-icon">
              <WandSparkles size={18} />
            </span>
            <strong>A little idea. A lovely cake.</strong>
            <p>
              Make your next celebration
              <br />
              something special.
            </p>
            <Link to="/studio">
              Let’s create
              <ArrowUpRight size={14} />
            </Link>
          </div>
          <NavLink className="bottom-link" to="/settings">
            <Settings2 size={18} />
            <span>Settings</span>
          </NavLink>
          <button className="bottom-link" onClick={() => setHelp(true)}>
            <CircleHelp size={18} />
            <span>Help & resources</span>
            <ArrowUpRight size={14} />
          </button>
          <div className="sidebar-profile">
            <Avatar name="Sarah Mitchell" />
            <span>
              <strong>{data.business.owner} Mitchell</strong>
              <small>Business owner</small>
            </span>
            <IconButton
              label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              onClick={() => setCollapsed(!collapsed)}
            >
              {collapsed ? (
                <ChevronsRight size={16} />
              ) : (
                <ChevronsLeft size={16} />
              )}
            </IconButton>
          </div>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <div className="breadcrumb">
            <IconButton
              label="Open navigation"
              className="mobile-menu"
              onClick={() => setMobile(true)}
            >
              <MenuIcon size={20} />
            </IconButton>
            <House size={15} />
            <span>/</span>
            <strong>{title}</strong>
          </div>
          <div className="topbar-actions">
            <button
              className="global-search-button"
              onClick={() => setSearch(true)}
            >
              <Search size={16} />
              <span>Search anything...</span>
              <kbd>
                <Command size={11} /> K
              </kbd>
            </button>
            <span className="topbar-divider" />
            <IconButton
              label="Notifications"
              className="notification-button"
              onClick={() => setNotifications(true)}
            >
              <Bell size={19} />
              {data.notifications.some((n) => !n.read) && <i />}
            </IconButton>
            <Link to="/settings" aria-label="Business profile">
              <Avatar name="Sarah Mitchell" size="small" />
            </Link>
          </div>
        </header>
        <main className="page-content">
          <Outlet />
        </main>
        <footer className="workspace-footer">
          <span>Made for your kind of business.</span>
          <span>
            <span className="online-dot" />
            All your little details, together.
          </span>
        </footer>
      </div>
      <nav className="mobile-bottom">
        {navigation
          .filter((_, i) => [0, 1, 3, 5].includes(i))
          .map(([name, path, Icon]) => (
            <NavLink key={name} to={path} end={path === "/"}>
              <Icon size={20} />
              <span>{name === "Cake Studio" ? "Studio" : name}</span>
            </NavLink>
          ))}
        <button onClick={() => setMobile(true)}>
          <MenuIcon size={20} />
          <span>More</span>
        </button>
      </nav>
      {search && <GlobalSearch onClose={() => setSearch(false)} />}
      {notifications && (
        <Modal
          title="Your updates"
          description="The little things worth knowing."
          onClose={() => setNotifications(false)}
        >
          <div className="notification-list">
            {data.notifications.map((n) => (
              <Link
                className={!n.read ? "unread" : ""}
                key={n.id}
                to={n.href}
                onClick={() => setNotifications(false)}
              >
                <span className={`notification-type ${n.type}`}>
                  {n.type === "stock" ? (
                    <Package size={19} />
                  ) : n.type === "quote" ? (
                    <WandSparkles size={19} />
                  ) : n.type === "payment" ? (
                    <Receipt size={19} />
                  ) : (
                    <ShoppingBag size={19} />
                  )}
                </span>
                <span>
                  <strong>{n.title}</strong>
                  <p>{n.text}</p>
                  <small>
                    {new Date(n.date).toLocaleDateString("en-IN", {
                      day: "numeric",
                      month: "short",
                    })}
                  </small>
                </span>
                {!n.read && <i />}
              </Link>
            ))}
          </div>
          <div className="modal-actions">
            <Button
              variant="secondary"
              onClick={() =>
                void command(
                  { type: "notifications.read" },
                  "You’re all caught up",
                ).catch(() => {})
              }
            >
              <CheckCheck size={16} />
              Mark all as read
            </Button>
          </div>
        </Modal>
      )}
      {help && (
        <Modal title="A hand with your bakery" onClose={() => setHelp(false)}>
          <div className="help-list">
            <details open>
              <summary>How do I turn a design into an order?</summary>
              <p>
                Save a cake in the Studio, then choose Quote. Select your
                customer and share the quotation link. Once approved, create an
                order from the Quotes tab in your catalog.
              </p>
            </details>
            <details>
              <summary>When is revenue recorded?</summary>
              <p>
                Revenue is recognized when an order is completed. Payments track
                money received separately. Net profit subtracts production costs
                and recorded operating expenses.
              </p>
            </details>
            <details>
              <summary>How does pantry tracking work?</summary>
              <p>
                On completing an order, choose to record its recipe ingredients.
                Stock is deducted together in one transaction. You can review
                every adjustment in the item’s stock history.
              </p>
            </details>
            <details>
              <summary>Where is my work saved?</summary>
              <p>
                Your bakery data is saved in a SQLite database on the computer
                running Crumb. Studio changes save automatically after you pause
                editing.
              </p>
            </details>
            <details>
              <summary>Studio controls</summary>
              <p>
                Drag to rotate the 3D cake and scroll to zoom. Use Cmd/Ctrl + Z
                to undo, Shift + Cmd/Ctrl + Z to redo, and Cmd/Ctrl + S to save.
                Select a tier to adjust its properties.
              </p>
            </details>
          </div>
        </Modal>
      )}
    </div>
  );
}
function GlobalSearch({ onClose }: { onClose: () => void }) {
  const [s, setS] = useState("");
  const d = useData();
  const q = s.toLowerCase().trim();
  const navigate = useNavigate();
  const items = [
    ...d.customers.map((c) => ({
      type: "Customer",
      label: c.name,
      sub: c.phone,
      href: `/customers/${c.id}`,
    })),
    ...d.orders.map((o) => ({
      type: "Order",
      label: `#${o.number} · ${d.customers.find((c) => c.id === o.customerId)?.name}`,
      sub: o.cakeName,
      href: `/orders/${o.id}`,
    })),
    ...d.designs.map((c) => ({
      type: "Design",
      label: c.name,
      sub: c.category,
      href: `/studio/${c.id}`,
    })),
    ...d.products.map((c) => ({
      type: "Cake",
      label: c.name,
      sub: inr(c.price),
      href: "/catalog",
    })),
    ...d.inventory.map((c) => ({
      type: "Inventory",
      label: c.name,
      sub: `${c.stock} ${c.unit}`,
      href: `/inventory?search=${encodeURIComponent(c.name)}`,
    })),
  ]
    .filter((x) => `${x.label} ${x.sub}`.toLowerCase().includes(q))
    .slice(0, 9);
  return (
    <Modal title="Find a little something" onClose={onClose}>
      <SearchInput
        value={s}
        onChange={setS}
        placeholder="Search orders, customers, cakes..."
      />
      <div className="command-results">
        {items.map((item, i) => (
          <button
            key={i}
            onClick={() => {
              navigate(item.href);
              onClose();
            }}
          >
            <span>
              <small>{item.type}</small>
              <strong>{item.label}</strong>
              <span>{item.sub}</span>
            </span>
            <ArrowUpRight size={16} />
          </button>
        ))}
        {!items.length && (
          <EmptyState
            title="Nothing here just yet"
            description={`No results for “${s}”. Try a customer name or order number.`}
          />
        )}
      </div>
    </Modal>
  );
}
