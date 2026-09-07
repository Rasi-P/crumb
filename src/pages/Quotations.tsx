import { lazy, Suspense, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Box,
  CakeSlice,
  Check,
  CheckCircle2,
  Copy,
  Download,
  Heart,
  Mail,
  MessageSquare,
  Phone,
  Send,
  Sparkles,
} from "lucide-react";
import { format } from "date-fns";
import { useData, useStore, copyLink } from "../lib/store";
import {
  uid,
  dateOffset,
  today,
  type Business,
  type Design,
  type Quote,
} from "../domain/models";
import { calculatePrice, inr } from "../domain/pricing";
import {
  Badge,
  Button,
  EmptyState,
  Field,
  Form,
  Modal,
  Select,
  Skeleton,
  Tabs,
} from "../components/ui";
import { Cake2D } from "../studio/Cake2D";
const Cake3D = lazy(() => import("../studio/Cake3D"));
export function QuoteForm({
  design,
  customerId,
  orderId,
  onClose,
}: {
  design: Design;
  customerId?: string;
  orderId?: string;
  onClose: () => void;
}) {
  const d = useData();
  const command = useStore((s) => s.command);
  const [customer, setCustomer] = useState(
    customerId || d.customers[0]?.id || "",
  );
  const [valid, setValid] = useState(dateOffset(7));
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState<Quote | null>(null);
  const price = calculatePrice(design.config, d.business.margin, d.inventory);
  return (
    <Modal
      title={
        saved
          ? "A lovely idea, ready to share"
          : "A little proposal for something lovely"
      }
      description={design.name}
      onClose={onClose}
    >
      {saved ? (
        <>
          <div className="quote-success">
            <CheckCircle2 size={36} />
            <h3>Your quotation is ready</h3>
            <p>
              {d.customers.find((c) => c.id === customer)?.name} can review the
              cake and approve the design.
            </p>
          </div>
          <Field label="Customer preview link">
            <div className="copy-field">
              <input
                readOnly
                value={`${location.origin}/q/${saved.token}`}
                onFocus={(e) => e.target.select()}
              />
              <Button
                variant="secondary"
                onClick={() =>
                  void copyLink(`/q/${saved.token}`).catch(() =>
                    useStore
                      .getState()
                      .toast(
                        "Select and copy the link above. Clipboard access is unavailable.",
                        "error",
                      ),
                  )
                }
              >
                <Copy size={16} />
              </Button>
            </div>
          </Field>
          <div className="modal-actions">
            <Button variant="secondary" onClick={onClose}>
              Done
            </Button>
            <Link
              to={`/q/${saved.token}`}
              target="_blank"
              className="button primary"
            >
              Open customer preview
              <ArrowUpRight size={15} />
            </Link>
          </div>
        </>
      ) : (
        <Form
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            const q: Quote = {
              id: uid(),
              token: uid(),
              customerId: customer,
              designId: design.id,
              config: {
                ...structuredClone(design.config),
                sellingPrice: price.selling,
              },
              name: design.name,
              total: price.total,
              date: today(),
              validUntil: valid,
              status: "Sent",
              request: "",
              orderId: orderId || null,
            };
            try {
              await command(
                { type: "quote.save", value: q },
                "Quotation created",
              );
              setSaved(q);
            } catch {
            } finally {
              setBusy(false);
            }
          }}
        >
          <div className="quote-mini-preview">
            <Cake2D config={design.config} />
            <div>
              <strong>{design.name}</strong>
              <p>
                {design.config.flavor} ·{" "}
                {design.config.tiers.map((t) => `${t.diameter}″`).join(" + ")}
              </p>
              <strong>{inr(price.total)}</strong>
            </div>
          </div>
          <Field label="Prepared for">
            <Select
              value={customer}
              onChange={setCustomer}
              options={[
                { value: "", label: "Choose a customer" },
                ...d.customers.map((c) => ({ value: c.id, label: c.name })),
              ]}
            />
          </Field>
          <Field label="Valid until">
            <input
              type="date"
              required
              min={today()}
              value={valid}
              onChange={(e) => setValid(e.target.value)}
            />
          </Field>
          <div className="quote-terms">
            <strong>Your booking terms</strong>
            <p>{d.business.terms}</p>
          </div>
          <div className="modal-actions">
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" loading={busy} disabled={!customer}>
              <Send size={15} />
              Create quotation
            </Button>
          </div>
        </Form>
      )}
    </Modal>
  );
}
type PublicData = {
  quote: Quote;
  business: Pick<
    Business,
    "name" | "phone" | "email" | "terms" | "address" | "logo"
  >;
  customer: { name: string };
  image: number;
};
export default function PublicQuote() {
  const { token } = useParams();
  const [data, setData] = useState<PublicData | null>(null);
  const [error, setError] = useState("");
  const [mode, setMode] = useState("Design");
  const [changes, setChanges] = useState(false);
  const [request, setRequest] = useState("");
  const [busy, setBusy] = useState(false);
  const [approval, setApproval] = useState(false);
  const fetchQuote = async () => {
    try {
      const response = await fetch(`/api/quotes/${token}`);
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);
      setData(body);
    } catch (e) {
      setError((e as Error).message);
    }
  };
  useEffect(() => {
    void fetchQuote();
    void fetch(`/api/quotes/${token}/respond`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "Viewed" }),
    });
  }, [token]);
  const respond = async (status: string) => {
    setBusy(true);
    try {
      const response = await fetch(`/api/quotes/${token}/respond`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, request }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);
      await fetchQuote();
      setChanges(false);
      setApproval(false);
    } catch (e) {
      useStore.getState().toast((e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  };
  if (error)
    return (
      <main className="public-error">
        <EmptyState
          title="This little celebration is out of reach"
          description={error}
          action={
            <Button
              variant="secondary"
              onClick={() => {
                setError("");
                void fetchQuote();
              }}
            >
              Try again
            </Button>
          }
        />
      </main>
    );
  if (!data) return <Skeleton />;
  const { quote: q, business: b, customer: c } = data;
  const p = calculatePrice(q.config);
  const expired = q.validUntil < today();
  return (
    <div className="public-quote">
      <header className="public-header">
        <span className="public-brand">
          {b.logo ? (
            <img src={b.logo} alt={b.name} />
          ) : (
            <CakeSlice size={27} strokeWidth={1.5} />
          )}
          <span>
            {b.name}
            <small>HANDCRAFTED WITH A LITTLE LOVE</small>
          </span>
        </span>
        <a href={`tel:${b.phone}`}>
          <Phone size={15} />
          <span>Let’s talk cake</span>
        </a>
      </header>
      <main>
        <div className="public-heading">
          <span className="eyebrow">A LITTLE SOMETHING, JUST FOR YOU</span>
          <h1>
            Your celebration.
            <br />
            Beautifully imagined.
          </h1>
          <p>
            {c.name.split(" ")[0]}, here’s the cake we dreamed up for your
            special day.
          </p>
        </div>
        <div className="public-design-layout">
          <section className="public-canvas">
            <Tabs
              className="segmented"
              value={mode}
              onChange={setMode}
              options={["Design", "3D preview"]}
            />
            {mode === "Design" ? (
              <Cake2D config={q.config} />
            ) : (
              <Suspense fallback={<Skeleton rows={2} />}>
                <Cake3D config={q.config} />
              </Suspense>
            )}
            <span className="public-canvas-note">
              Made by hand. Made for you.
            </span>
          </section>
          <section className="public-details">
            <div className="eyebrow">YOUR CAKE DESIGN</div>
            <h2>{q.name}</h2>
            <div className="public-specs">
              <div>
                <span>Flavor</span>
                <strong>{q.config.flavor}</strong>
              </div>
              <div>
                <span>Size</span>
                <strong>
                  {q.config.tiers.map((t) => `${t.diameter}″`).join(" + ")}
                </strong>
              </div>
              <div>
                <span>Servings</span>
                <strong>Approx. {p.servings}</strong>
              </div>
              <div>
                <span>Frosting</span>
                <strong>{q.config.tiers[0].frosting}</strong>
              </div>
            </div>
            <div className="tag-list">
              {Array.from(
                new Set(q.config.tiers.flatMap((t) => t.decorations)),
              ).map((dec) => (
                <span key={dec}>{dec}</span>
              ))}
            </div>
            {q.config.text && (
              <div className="public-message">
                <span>The finishing touch</span>
                <p>“{q.config.text}”</p>
              </div>
            )}
            <div className="price-lines">
              <div>
                <span>Cake & customization</span>
                <strong>{inr(p.selling)}</strong>
              </div>
              {q.config.delivery > 0 && (
                <div>
                  <span>Delivery</span>
                  <strong>{inr(q.config.delivery)}</strong>
                </div>
              )}
              {q.config.discount > 0 && (
                <div>
                  <span>Discount</span>
                  <strong>−{inr(q.config.discount)}</strong>
                </div>
              )}
              {p.tax > 0 && (
                <div>
                  <span>Tax</span>
                  <strong>{inr(p.tax)}</strong>
                </div>
              )}
              <div className="price-total">
                <span>Your celebration</span>
                <strong>{inr(q.total)}</strong>
              </div>
            </div>
            {q.status === "Approved" ? (
              <div className="approval-state">
                <CheckCircle2 size={25} />
                <strong>A lovely choice. Your design is approved.</strong>
                <p>
                  We’ll be in touch about your booking and the next little
                  details.
                </p>
              </div>
            ) : q.status === "Changes Requested" ? (
              <div className="approval-state requested">
                <MessageSquare size={23} />
                <strong>Your little changes are with us.</strong>
                <p>“{q.request}”</p>
                <p>We’ll get back to you with an updated design.</p>
              </div>
            ) : expired ? (
              <div className="inline-notice">
                <p>
                  This quotation has expired. Contact {b.name} for a fresh one.
                </p>
              </div>
            ) : (
              <div className="public-approval-actions">
                <Button onClick={() => setApproval(true)}>
                  <Check size={16} />I love it. Approve design
                </Button>
                <Button variant="secondary" onClick={() => setChanges(true)}>
                  <MessageSquare size={15} />A few little changes
                </Button>
                <small>
                  Quotation valid until{" "}
                  {format(new Date(q.validUntil + "T12:00:00"), "d MMMM yyyy")}
                </small>
              </div>
            )}
          </section>
        </div>
        <section className="public-terms">
          <Heart size={21} />
          <div>
            <h3>A few things, before the celebration</h3>
            <p>{b.terms}</p>
          </div>
          <Button variant="ghost" onClick={() => window.print()}>
            <Download size={16} />
            Save quotation
          </Button>
        </section>
      </main>
      <footer className="public-footer">
        <span>
          {b.name}
          <small>{b.address}</small>
        </span>
        <a href={`mailto:${b.email}`}>{b.email}</a>
        <span className="powered-by">
          A little magic, with <strong>crumb.</strong>
        </span>
      </footer>
      {changes && (
        <Modal
          title="Let’s make it more you"
          description="Tell us what you’d like to change. Colors, details, or a little something extra."
          onClose={() => setChanges(false)}
        >
          <Form
            onSubmit={(e) => {
              e.preventDefault();
              void respond("Changes Requested");
            }}
          >
            <Field label="Your changes">
              <textarea
                required
                minLength={3}
                maxLength={2000}
                rows={5}
                autoFocus
                value={request}
                onChange={(e) => setRequest(e.target.value)}
                placeholder="I’d love a little more..."
              />
            </Field>
            <div className="modal-actions">
              <Button
                type="button"
                variant="secondary"
                onClick={() => setChanges(false)}
              >
                Cancel
              </Button>
              <Button loading={busy} type="submit">
                <Send size={15} />
                Send changes
              </Button>
            </div>
          </Form>
        </Modal>
      )}
      {approval && (
        <Modal
          title="Shall we make it yours?"
          description={`Approve ${q.name} for ${inr(q.total)}. ${b.terms}`}
          onClose={() => setApproval(false)}
        >
          <div className="modal-actions">
            <Button variant="secondary" onClick={() => setApproval(false)}>
              One more look
            </Button>
            <Button loading={busy} onClick={() => void respond("Approved")}>
              <Check size={16} />
              Approve design
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
