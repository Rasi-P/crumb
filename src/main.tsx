import React, {
  Component,
  Suspense,
  lazy,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { createRoot } from "react-dom/client";
import {
  BrowserRouter,
  Link,
  Navigate,
  Route,
  Routes,
  useLocation,
  useParams,
} from "react-router-dom";
import { CakeSlice, LockKeyhole, RefreshCw } from "lucide-react";
import { Layout } from "./components/Layout";
import {
  Button,
  EmptyState,
  Field,
  Form,
  Skeleton,
  Toasts,
} from "./components/ui";
import { useStore } from "./lib/store";
import "@fontsource-variable/dm-sans";
import "./styles.css";

const Dashboard = lazy(() => import("./pages/Dashboard"));
const Orders = lazy(() => import("./pages/Orders"));
const OrderDetail = lazy(() =>
  import("./pages/Orders").then((m) => ({ default: m.OrderDetail })),
);
const NewOrder = lazy(() => import("./pages/NewOrder"));
const Customers = lazy(() => import("./pages/Customers"));
const CustomerDetail = lazy(() =>
  import("./pages/Customers").then((m) => ({ default: m.CustomerDetail })),
);
const Catalog = lazy(() => import("./pages/Catalog"));
const Calendar = lazy(() => import("./pages/Calendar"));
const Expenses = lazy(() => import("./pages/Operations"));
const Inventory = lazy(() =>
  import("./pages/Operations").then((m) => ({ default: m.Inventory })),
);
const Analytics = lazy(() => import("./pages/Analytics"));
const Settings = lazy(() => import("./pages/Settings"));
const Studio = lazy(() => import("./studio/Studio"));
const PublicQuote = lazy(() => import("./pages/Quotations"));
class ErrorBoundary extends Component<
  { children: ReactNode },
  { error: Error | null }
> {
  state: { error: Error | null } = { error: null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  componentDidCatch(error: Error) {
    console.error("Crumb render error:", error);
  }
  render() {
    if (this.state.error)
      return (
        <div className="app-error">
          <EmptyState
            title="A little pause in the kitchen"
            description="This screen could not finish loading. Your saved bakery data is still in place."
            action={
              <Button onClick={() => location.reload()}>
                <RefreshCw size={16} />
                Reload workspace
              </Button>
            }
          />
          <details>
            <summary>Error details</summary>
            <code>{this.state.error.message}</code>
          </details>
        </div>
      );
    return this.props.children;
  }
}
function StudioRoute() {
  return <Studio />;
}
function AuthenticatedApp() {
  const { data, load, error, loading } = useStore();
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [authError, setAuthError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    fetch("/api/session")
      .then((r) => r.json())
      .then((body) => setAuthenticated(body.authenticated))
      .catch(() =>
        setAuthError(
          "The bakery server is unavailable. Start the server and reload this page.",
        ),
      );
  }, []);
  useEffect(() => {
    if (authenticated) void load();
  }, [authenticated, load]);
  if (authenticated === false)
    return (
      <div className="login-page">
        <div className="login-visual">
          <div className="login-brand">
            <CakeSlice size={34} />
            crumb.
          </div>
          <h1>
            A little flour.
            <br />A lot of possibility.
          </h1>
          <div className="login-cake" />
        </div>
        <div className="login-form">
          <span className="eyebrow">YOUR CREATIVE BUSINESS WORKSPACE</span>
          <h1>Welcome back.</h1>
          <p>Your next lovely celebration is waiting.</p>
          <Form
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              setAuthError("");
              try {
                const response = await fetch("/api/login", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    password: new FormData(e.currentTarget).get("password"),
                  }),
                });
                const body = await response.json();
                if (!response.ok) throw new Error(body.error);
                setAuthenticated(true);
              } catch (error) {
                setAuthError((error as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <Field label="Workspace password">
              <input
                name="password"
                type="password"
                required
                autoComplete="current-password"
                autoFocus
              />
            </Field>
            {authError && (
              <p role="alert" className="error-message">
                {authError}
              </p>
            )}
            <Button type="submit" loading={busy}>
              <LockKeyhole size={16} />
              Open your workspace
            </Button>
          </Form>
        </div>
      </div>
    );
  if (authError || error)
    return (
      <EmptyState
        title="Your workspace needs a moment"
        description={authError || error}
        action={<Button onClick={() => location.reload()}>Try again</Button>}
      />
    );
  if (!data || loading || authenticated === null)
    return (
      <div className="app-loading">
        <span className="brand">
          <CakeSlice size={27} />
          crumb.
        </span>
        <Skeleton />
      </div>
    );
  return (
    <Suspense fallback={<Skeleton />}>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="orders" element={<Orders />} />
          <Route path="orders/new" element={<NewOrder />} />
          <Route path="orders/:id/edit" element={<NewOrder />} />
          <Route path="orders/:id" element={<OrderDetail />} />
          <Route path="customers" element={<Customers />} />
          <Route path="customers/:id" element={<CustomerDetail />} />
          <Route path="catalog" element={<Catalog />} />
          <Route path="calendar" element={<Calendar />} />
          <Route path="inventory" element={<Inventory />} />
          <Route path="expenses" element={<Expenses />} />
          <Route path="analytics" element={<Analytics />} />
          <Route path="settings" element={<Settings />} />
          <Route
            path="*"
            element={
              <EmptyState
                title="A little off the beaten path"
                description="There’s nothing at this address."
                action={
                  <Link className="button primary" to="/">
                    Back to your bakery
                  </Link>
                }
              />
            }
          />
        </Route>
        <Route path="studio/:id?" element={<StudioRoute />} />
      </Routes>
    </Suspense>
  );
}
function App() {
  const location = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);
  return (
    <ErrorBoundary>
      <Suspense fallback={<Skeleton />}>
        {location.pathname.startsWith("/q/") ? (
          <Routes>
            <Route path="/q/:token" element={<PublicQuote />} />
          </Routes>
        ) : (
          <AuthenticatedApp />
        )}
      </Suspense>
      <Toasts />
    </ErrorBoundary>
  );
}
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
);
