import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  Archive,
  ArrowRight,
  ArrowUpRight,
  Copy,
  Heart,
  LayoutGrid,
  Pencil,
  Plus,
  Send,
  ShoppingBag,
  Star,
  WandSparkles,
} from "lucide-react";
import { format } from "date-fns";
import { useData, useStore } from "../lib/store";
import { categories, uid, type Product, type Design } from "../domain/models";
import { calculatePrice, inr } from "../domain/pricing";
import {
  Badge,
  Button,
  CakeImage,
  Confirm,
  EmptyState,
  Field,
  Form,
  IconButton,
  Menu,
  Modal,
  PageHeader,
  SearchInput,
  Select,
  Tabs,
} from "../components/ui";
import { Cake2D } from "../studio/Cake2D";
import { QuoteForm } from "./Quotations";

export default function Catalog() {
  const d = useData();
  const command = useStore((s) => s.command);
  const [params, setParams] = useSearchParams();
  const [tab, setTab] = useState(
    params.get("tab") === "quotes" ? "Quotations" : "Cake catalog",
  );
  const [collection, setCollection] = useState("My designs");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All cakes");
  const [edit, setEdit] = useState<Product | null | undefined>(
    params.has("new") ? null : undefined,
  );
  const [quote, setQuote] = useState<Design | null>(null);
  const [archive, setArchive] = useState<{
    type: "design" | "product";
    id: string;
  } | null>(null);
  const [detail, setDetail] = useState<Product | null>(null);
  const productRows = d.products.filter(
    (p) =>
      !p.archived &&
      p.name.toLowerCase().includes(query.toLowerCase()) &&
      (category === "All cakes" || p.category === category),
  );
  const designs = d.designs.filter(
    (x) =>
      x.name.toLowerCase().includes(query.toLowerCase()) &&
      (category === "All cakes" || x.category === category) &&
      (collection === "Archived"
        ? x.state === "Archived"
        : x.state !== "Archived" &&
          (collection === "Templates"
            ? x.template
            : collection === "Favorites"
              ? x.favorite
              : collection === "Drafts"
                ? x.state === "Draft"
                : !x.template)),
  );
  const duplicate = async (design: Design) => {
    const copy = {
      ...structuredClone(design),
      id: uid(),
      name: `${design.name} copy`,
      template: false,
      state: "Draft" as const,
      updatedAt: new Date().toISOString(),
    };
    await command({ type: "design.save", value: copy }, "Design duplicated");
  };
  return (
    <>
      <PageHeader
        eyebrow="A COLLECTION OF LITTLE CELEBRATIONS"
        title="Made with a little magic"
        description="Your signature cakes, favorite designs, and ideas waiting to happen."
      >
        <Link className="button secondary" to="/studio">
          <WandSparkles size={16} />
          Cake Studio
        </Link>
        <Button onClick={() => setEdit(null)}>
          <Plus size={16} />
          New cake
        </Button>
      </PageHeader>
      <div className="catalog-tabs">
        <Tabs
          options={[
            {
              value: "Cake catalog",
              label: "Cake catalog",
              count: d.products.filter((p) => !p.archived).length,
            },
            {
              value: "Design library",
              label: "Design library",
              count: d.designs.filter(
                (x) => !x.template && x.state !== "Archived",
              ).length,
            },
            {
              value: "Quotations",
              label: "Quotations",
              count: d.quotes.length,
            },
          ]}
          value={tab}
          onChange={(v) => {
            setTab(v);
            setParams(v === "Quotations" ? { tab: "quotes" } : {});
          }}
        />
      </div>
      {tab === "Quotations" ? (
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Celebration</th>
                <th>Customer</th>
                <th>Valid until</th>
                <th>Total</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {d.quotes.map((q) => (
                <tr key={q.id}>
                  <td>
                    <Link
                      className="stack-cell"
                      to={`/q/${q.token}`}
                      target="_blank"
                    >
                      <strong>{q.name}</strong>
                      <small>
                        Created {format(new Date(q.date), "d MMM yyyy")}
                      </small>
                    </Link>
                  </td>
                  <td>
                    {d.customers.find((c) => c.id === q.customerId)?.name}
                  </td>
                  <td>
                    {format(new Date(q.validUntil + "T12:00:00"), "d MMM yyyy")}
                  </td>
                  <td className="number">{inr(q.total)}</td>
                  <td>
                    <Badge>{q.status}</Badge>
                    {q.request && <p className="quote-request">{q.request}</p>}
                  </td>
                  <td>
                    <div className="button-row">
                      {q.orderId ? (
                        <Link
                          className="button secondary"
                          to={`/orders/${q.orderId}`}
                        >
                          View order
                          <ArrowRight size={14} />
                        </Link>
                      ) : q.status === "Approved" ? (
                        <Link
                          className="button primary"
                          to={`/orders/new?quote=${q.id}`}
                        >
                          <Plus size={14} />
                          Create order
                        </Link>
                      ) : (
                        <Link
                          className="button secondary"
                          to={`/q/${q.token}`}
                          target="_blank"
                        >
                          View quote
                          <ArrowUpRight size={14} />
                        </Link>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!d.quotes.length && (
            <EmptyState
              title="A lovely idea, ready to share"
              description="Create a quotation from a saved cake design."
              action={
                <Link className="button primary" to="/studio">
                  Open Cake Studio
                </Link>
              }
            />
          )}
        </div>
      ) : (
        <>
          {tab === "Design library" && (
            <Tabs
              className="collection-tabs"
              options={[
                "My designs",
                "Favorites",
                "Templates",
                "Drafts",
                "Archived",
              ]}
              value={collection}
              onChange={setCollection}
            />
          )}
          <div className="list-toolbar">
            <SearchInput
              value={query}
              onChange={setQuery}
              placeholder={
                tab === "Cake catalog"
                  ? "Find a little inspiration..."
                  : "Search your designs..."
              }
            />
            <div className="category-chips">
              {[
                "All cakes",
                "Birthday",
                "Wedding",
                "Anniversary",
                "Custom",
              ].map((c) => (
                <button
                  key={c}
                  className={category === c ? "active" : ""}
                  onClick={() => setCategory(c)}
                >
                  {c}
                </button>
              ))}
            </div>
            <Select
              label="Cake category"
              value={category}
              onChange={setCategory}
              options={["All cakes", ...categories]}
              className="catalog-category-select"
            />
          </div>
          <div className="catalog-grid">
            {tab === "Cake catalog"
              ? productRows.map((p, i) => {
                  const design = d.designs.find((x) => x.id === p.designId)!;
                  const count = d.orders.filter(
                    (o) => o.designId === design.id,
                  ).length;
                  return (
                    <article className="product-card" key={p.id}>
                      <Link
                        className="product-image-link"
                        to={`/studio/${design.id}`}
                      >
                        {design.template ? (
                          <CakeImage index={design.image} label={p.name} />
                        ) : (
                          <div className="design-svg-thumb">
                            <Cake2D config={design.config} />
                          </div>
                        )}
                        {count >= 3 && (
                          <span className="bestseller-tag">
                            <Star size={11} />
                            Baker’s favorite
                          </span>
                        )}
                      </Link>
                      <div className="product-card-info">
                        <div className="product-eyebrow">
                          <span>{p.category}</span>
                          <IconButton
                            label={
                              design.favorite
                                ? "Remove from favorites"
                                : "Add to favorites"
                            }
                            onClick={() =>
                              void command({
                                type: "design.save",
                                value: {
                                  ...design,
                                  favorite: !design.favorite,
                                },
                              }).catch(() => {})
                            }
                          >
                            <Heart
                              size={16}
                              fill={design.favorite ? "currentColor" : "none"}
                            />
                          </IconButton>
                        </div>
                        <button
                          className="product-name"
                          onClick={() => setDetail(p)}
                        >
                          {p.name}
                        </button>
                        <div className="product-price">
                          <span>
                            From <strong>{inr(p.price)}</strong>
                          </span>
                          <span>{count} celebrations</span>
                        </div>
                        <div className="product-card-actions">
                          <Link to={`/studio/${design.id}`}>
                            <WandSparkles size={14} />
                            Make it yours
                            <ArrowUpRight size={13} />
                          </Link>
                          <Menu label={`Actions for ${p.name}`}>
                            <button onClick={() => setDetail(p)}>
                              View cake
                            </button>
                            <button onClick={() => setEdit(p)}>
                              <Pencil size={14} />
                              Edit cake
                            </button>
                            <button
                              onClick={() =>
                                void command(
                                  {
                                    type: "product.save",
                                    value: {
                                      ...p,
                                      id: uid(),
                                      name: `${p.name} copy`,
                                    },
                                  },
                                  "Cake duplicated",
                                ).catch(() => {})
                              }
                            >
                              <Copy size={14} />
                              Duplicate
                            </button>
                            <button
                              onClick={() =>
                                setArchive({ type: "product", id: p.id })
                              }
                            >
                              <Archive size={14} />
                              Archive
                            </button>
                          </Menu>
                        </div>
                      </div>
                    </article>
                  );
                })
              : designs.map((design) => (
                  <article className="product-card" key={design.id}>
                    <Link
                      className="product-image-link"
                      to={`/studio/${design.id}`}
                    >
                      {design.template ? (
                        <CakeImage index={design.image} label={design.name} />
                      ) : (
                        <div className="design-svg-thumb">
                          <Cake2D config={design.config} />
                        </div>
                      )}
                      <span className="design-state">
                        <Badge>{design.state}</Badge>
                      </span>
                    </Link>
                    <div className="product-card-info">
                      <div className="product-eyebrow">
                        <span>{design.category}</span>
                        <IconButton
                          label="Toggle favorite"
                          onClick={() =>
                            void command({
                              type: "design.save",
                              value: { ...design, favorite: !design.favorite },
                            }).catch(() => {})
                          }
                        >
                          <Heart
                            size={16}
                            fill={design.favorite ? "currentColor" : "none"}
                          />
                        </IconButton>
                      </div>
                      <Link
                        to={`/studio/${design.id}`}
                        className="product-name"
                      >
                        {design.name}
                      </Link>
                      <div className="product-price">
                        <strong>
                          {inr(
                            calculatePrice(
                              design.config,
                              d.business.margin,
                              d.inventory,
                            ).total,
                          )}
                        </strong>
                        <span>
                          {format(new Date(design.updatedAt), "d MMM")}
                        </span>
                      </div>
                      <div className="product-card-actions">
                        <Link to={`/studio/${design.id}`}>
                          <Pencil size={14} />
                          {design.template ? "Use template" : "Edit design"}
                          <ArrowUpRight size={13} />
                        </Link>
                        <Menu label={`Actions for ${design.name}`}>
                          <button
                            onClick={() =>
                              void duplicate(design).catch(() => {})
                            }
                          >
                            <Copy size={14} />
                            Duplicate
                          </button>
                          <Link to={`/orders/new?design=${design.id}`}>
                            <ShoppingBag size={14} />
                            Create order
                          </Link>
                          <button onClick={() => setQuote(design)}>
                            <Send size={14} />
                            Create quotation
                          </button>
                          <button
                            onClick={() =>
                              setEdit({
                                id: uid(),
                                designId: design.id,
                                name: design.name,
                                category: design.category,
                                price: calculatePrice(
                                  design.config,
                                  d.business.margin,
                                ).selling,
                                description: "",
                                archived: false,
                              })
                            }
                          >
                            <Plus size={14} />
                            Add to catalog
                          </button>
                          {design.state === "Archived" ? (
                            <button
                              onClick={() =>
                                void command(
                                  {
                                    type: "design.save",
                                    value: { ...design, state: "Saved" },
                                  },
                                  "Design restored",
                                ).catch(() => {})
                              }
                            >
                              Restore design
                            </button>
                          ) : (
                            <button
                              onClick={() =>
                                setArchive({ type: "design", id: design.id })
                              }
                            >
                              <Archive size={14} />
                              Archive
                            </button>
                          )}
                        </Menu>
                      </div>
                    </div>
                  </article>
                ))}
          </div>
          {!(tab === "Cake catalog" ? productRows : designs).length && (
            <EmptyState
              title="A little room for inspiration"
              description="No cakes in this collection yet. Create something that feels like you."
              action={
                <Link className="button primary" to="/studio">
                  <WandSparkles size={16} />
                  Create a design
                </Link>
              }
            />
          )}
        </>
      )}
      {edit !== undefined && (
        <ProductForm
          product={edit || undefined}
          onClose={() => setEdit(undefined)}
        />
      )}{" "}
      {quote && <QuoteForm design={quote} onClose={() => setQuote(null)} />}{" "}
      {detail && (
        <Modal title={detail.name} onClose={() => setDetail(null)}>
          <CakeImage
            index={d.designs.find((x) => x.id === detail.designId)?.image}
            className="product-detail-image"
            label={detail.name}
          />
          <div className="product-detail-info">
            <Badge tone="purple">{detail.category}</Badge>
            <strong>{inr(detail.price)}</strong>
          </div>
          <p className="product-description">
            {detail.description ||
              "Handmade with care for your next celebration."}
          </p>
          <div className="modal-actions">
            <Button
              variant="secondary"
              onClick={() => {
                setDetail(null);
                setEdit(detail);
              }}
            >
              <Pencil size={15} />
              Edit cake
            </Button>
            <Link className="button primary" to={`/studio/${detail.designId}`}>
              <WandSparkles size={16} />
              Open in Studio
            </Link>
          </div>
        </Modal>
      )}{" "}
      {archive && (
        <Confirm
          danger
          title="Make a little space?"
          description="This item will be archived. Existing orders and quotations keep their saved designs."
          onClose={() => setArchive(null)}
          onConfirm={async () => {
            if (archive.type === "design")
              await command(
                {
                  type: "design.save",
                  value: {
                    ...d.designs.find((x) => x.id === archive.id)!,
                    state: "Archived",
                  },
                },
                "Design archived",
              );
            else
              await command(
                {
                  type: "product.save",
                  value: {
                    ...d.products.find((x) => x.id === archive.id)!,
                    archived: true,
                  },
                },
                "Cake archived",
              );
          }}
        />
      )}
    </>
  );
}
function ProductForm({
  product,
  onClose,
}: {
  product?: Product;
  onClose: () => void;
}) {
  const d = useData();
  const command = useStore((s) => s.command);
  const [busy, setBusy] = useState(false);
  return (
    <Modal
      title={
        product && d.products.some((p) => p.id === product.id)
          ? "Refine a signature cake"
          : "A new cake for your collection"
      }
      onClose={onClose}
    >
      <Form
        onSubmit={async (e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          const value: Product = {
            id: product?.id || uid(),
            designId: String(f.get("designId")),
            name: String(f.get("name")),
            category: String(f.get("category")),
            price: Number(f.get("price")),
            description: String(f.get("description")),
            archived: false,
          };
          setBusy(true);
          try {
            await command(
              { type: "product.save", value },
              "Cake saved to catalog",
            );
            onClose();
          } catch {
          } finally {
            setBusy(false);
          }
        }}
      >
        <Field label="Cake name">
          <input
            name="name"
            required
            minLength={2}
            maxLength={100}
            autoFocus
            defaultValue={product?.name}
            placeholder="e.g. A little lavender dream"
          />
        </Field>
        <div className="form-grid">
          <Field label="Category">
            <select
              name="category"
              defaultValue={product?.category || "Birthday"}
            >
              {categories.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </Field>
          <Field label="Starting price (₹)">
            <input
              name="price"
              type="number"
              min="0"
              required
              defaultValue={product?.price || 2400}
            />
          </Field>
        </div>
        <Field label="Cake design">
          <select
            name="designId"
            defaultValue={product?.designId || d.designs[0].id}
          >
            {d.designs
              .filter((x) => x.state !== "Archived")
              .map((design) => (
                <option value={design.id} key={design.id}>
                  {design.name}
                </option>
              ))}
          </select>
        </Field>
        <Field label="Description">
          <textarea
            name="description"
            rows={3}
            defaultValue={product?.description}
            placeholder="The flavors, textures and details that make it special..."
          />
        </Field>
        <div className="modal-actions">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={busy}>
            Save cake
            <ArrowRight size={15} />
          </Button>
        </div>
      </Form>
    </Modal>
  );
}
