import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  ArrowDown,
  ArrowUpRight,
  Boxes,
  Check,
  Download,
  History,
  Package,
  Pencil,
  Plus,
  Receipt,
  Search,
  SlidersHorizontal,
  TrendingDown,
} from "lucide-react";
import { format } from "date-fns";
import { useData, useStore } from "../lib/store";
import {
  uid,
  today,
  dateOffset,
  type Expense,
  type InventoryItem,
} from "../domain/models";
import { inr } from "../domain/pricing";
import {
  Badge,
  Button,
  EmptyState,
  Field,
  Form,
  IconButton,
  Modal,
  PageHeader,
  SearchInput,
  Select,
  Tabs,
} from "../components/ui";

export function ExpenseForm({
  expense,
  onClose,
}: {
  expense?: Expense;
  onClose: () => void;
}) {
  const command = useStore((s) => s.command);
  const [busy, setBusy] = useState(false);
  return (
    <Modal
      title={expense ? "A small correction" : "A little expense, accounted for"}
      description="Keep a clear picture of what goes into your business."
      onClose={onClose}
    >
      <Form
        onSubmit={async (e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          const value: Expense = {
            id: expense?.id || uid(),
            date: String(f.get("date")),
            description: String(f.get("description")),
            category: String(f.get("category")) as Expense["category"],
            amount: Number(f.get("amount")),
            note: String(f.get("note")),
          };
          setBusy(true);
          try {
            await command(
              { type: "expense.save", value },
              expense ? "Expense updated" : "Expense recorded",
            );
            onClose();
          } catch {
          } finally {
            setBusy(false);
          }
        }}
      >
        <Field label="What was it for?">
          <input
            name="description"
            autoFocus
            required
            minLength={2}
            maxLength={200}
            placeholder="e.g. Weekly pantry restock"
            defaultValue={expense?.description}
          />
        </Field>
        <div className="form-grid">
          <Field label="Amount (₹)">
            <input
              name="amount"
              required
              type="number"
              min="1"
              max="10000000"
              step="1"
              placeholder="0"
              defaultValue={expense?.amount}
            />
          </Field>
          <Field label="Date">
            <input
              name="date"
              type="date"
              required
              defaultValue={expense?.date || today()}
            />
          </Field>
        </div>
        <Field label="Category">
          <select
            name="category"
            defaultValue={expense?.category || "Ingredients"}
          >
            {[
              "Ingredients",
              "Packaging",
              "Delivery",
              "Equipment",
              "Decorations",
              "Electricity",
              "Marketing",
              "Other",
            ].map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </Field>
        <Field label="Note (optional)">
          <textarea
            name="note"
            rows={3}
            placeholder="Supplier, receipt reference, or a little context..."
            defaultValue={expense?.note}
          />
        </Field>
        <div className="modal-actions">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={busy}>
            <Check size={16} />
            {expense ? "Save changes" : "Record expense"}
          </Button>
        </div>
      </Form>
    </Modal>
  );
}
function downloadCsv(rows: string[][], name: string) {
  const csv = rows
    .map((row) =>
      row
        .map(
          (cell) =>
            `"${(/^[=+@-]/.test(cell) ? "'" : "") + cell.replaceAll('"', '""')}"`,
        )
        .join(","),
    )
    .join("\r\n");
  const url = URL.createObjectURL(
    new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}
export default function Expenses() {
  const d = useData();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All categories");
  const [period, setPeriod] = useState("30");
  const [edit, setEdit] = useState<Expense | null | undefined>();
  const rows = d.expenses
    .filter(
      (e) =>
        e.description.toLowerCase().includes(search.toLowerCase()) &&
        (category === "All categories" || e.category === category) &&
        (period === "all" || e.date >= dateOffset(-Number(period))),
    )
    .sort((a, b) => b.date.localeCompare(a.date));
  const total = rows.reduce((n, e) => n + e.amount, 0);
  const categories = Array.from(new Set(d.expenses.map((e) => e.category)));
  const largest = categories
    .map((c) => ({
      name: c,
      amount: rows
        .filter((e) => e.category === c)
        .reduce((n, e) => n + e.amount, 0),
    }))
    .sort((a, b) => b.amount - a.amount)[0];
  return (
    <>
      <PageHeader
        eyebrow="A HEALTHY BUSINESS STARTS WITH THE DETAILS"
        title="The cost of creating"
        description="Every ingredient, every delivery, every little investment."
      >
        <Button
          variant="secondary"
          onClick={() =>
            downloadCsv(
              [
                ["Date", "Description", "Category", "Amount (INR)"],
                ...rows.map((e) => [
                  e.date,
                  e.description,
                  e.category,
                  String(e.amount),
                ]),
              ],
              "crumb-expenses.csv",
            )
          }
        >
          <Download size={16} />
          Export
        </Button>
        <Button onClick={() => setEdit(null)}>
          <Plus size={16} />
          Record expense
        </Button>
      </PageHeader>
      <div className="summary-band">
        <div>
          <span>Total expenses</span>
          <strong>{inr(total)}</strong>
        </div>
        <div>
          <span>Transactions</span>
          <strong>
            {rows.length}
            <small>recorded expenses</small>
          </strong>
        </div>
        <div>
          <span>Biggest category</span>
          <strong>
            {largest?.name || "No expenses"}
            <small>{inr(largest?.amount || 0)}</small>
          </strong>
        </div>
      </div>
      <div className="list-toolbar">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search expenses..."
        />
        <Select
          label="Expense category"
          value={category}
          onChange={setCategory}
          options={["All categories", ...categories]}
        />
        <Select
          label="Expense period"
          value={period}
          onChange={setPeriod}
          options={[
            { value: "7", label: "Last 7 days" },
            { value: "30", label: "Last 30 days" },
            { value: "90", label: "Last 3 months" },
            { value: "all", label: "All time" },
          ]}
        />
      </div>
      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Description</th>
              <th>Category</th>
              <th className="align-right">Amount</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((e) => (
              <tr key={e.id}>
                <td className="muted">
                  {format(new Date(e.date + "T12:00:00"), "d MMM yyyy")}
                </td>
                <td>
                  <button className="expense-cell" onClick={() => setEdit(e)}>
                    <span
                      className={`expense-icon category-${categories.indexOf(e.category) % 4}`}
                    >
                      <Receipt size={18} />
                    </span>
                    <span>
                      <strong>{e.description}</strong>
                      {e.note && <small>{e.note}</small>}
                    </span>
                  </button>
                </td>
                <td>
                  <span className="plain-tag">{e.category}</span>
                </td>
                <td className="number align-right">{inr(e.amount)}</td>
                <td>
                  <IconButton
                    label={`Edit ${e.description}`}
                    onClick={() => setEdit(e)}
                  >
                    <Pencil size={15} />
                  </IconButton>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length && (
          <EmptyState
            title="A clean little ledger"
            description="No expenses for these filters. Record an expense to keep track of your costs."
            action={
              <Button onClick={() => setEdit(null)}>
                <Plus size={16} />
                Record expense
              </Button>
            }
          />
        )}
        <div className="table-footer">
          <span>{rows.length} expenses</span>
          <strong>Total {inr(total)}</strong>
        </div>
      </div>
      {edit !== undefined && (
        <ExpenseForm
          expense={edit || undefined}
          onClose={() => setEdit(undefined)}
        />
      )}
    </>
  );
}
export function Inventory() {
  const d = useData();
  const [params] = useSearchParams();
  const [search, setSearch] = useState(params.get("search") || "");
  const [category, setCategory] = useState("All items");
  const [stock, setStock] = useState(
    params.has("low") ? "Needs attention" : "All stock",
  );
  const [edit, setEdit] = useState<InventoryItem | null | undefined>();
  const [adjust, setAdjust] = useState<InventoryItem | null>(null);
  const [history, setHistory] = useState<string | null>(null);
  const rows = d.inventory.filter(
    (i) =>
      i.name.toLowerCase().includes(search.toLowerCase()) &&
      (category === "All items" || i.category === category) &&
      (stock === "All stock" ||
        (stock === "Needs attention" && i.stock <= i.minimum) ||
        (stock === "Out of stock" && i.stock === 0)),
  );
  const low = d.inventory.filter((i) => i.stock <= i.minimum).length;
  const value = d.inventory.reduce((n, i) => n + i.stock * i.cost, 0);
  return (
    <>
      <PageHeader
        eyebrow="GOOD CAKES START HERE"
        title="A well-loved pantry"
        description="All the ingredients and little extras behind your next creation."
      >
        <Button onClick={() => setEdit(null)}>
          <Plus size={16} />
          Add item
        </Button>
      </PageHeader>
      <div className="summary-band">
        <div>
          <span>Pantry essentials</span>
          <strong>
            {d.inventory.length}
            <small>items on your shelves</small>
          </strong>
        </div>
        <div>
          <span>Stock value</span>
          <strong>{inr(value)}</strong>
        </div>
        <div>
          <span>A little top-up needed</span>
          <strong className={low ? "amber-text" : ""}>
            {low}
            <small>items running low</small>
          </strong>
        </div>
        <div>
          <span>Ready for the kitchen</span>
          <strong>
            {d.inventory.length - low}
            <small>well-stocked items</small>
          </strong>
        </div>
      </div>
      <Tabs
        options={["All items", "Ingredients", "Packaging", "Decorations"]}
        value={category}
        onChange={setCategory}
      />
      <div className="list-toolbar">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Find something in your pantry..."
        />
        <Select
          label="Stock filter"
          value={stock}
          onChange={setStock}
          options={["All stock", "Needs attention", "Out of stock"]}
        />
        <span className="muted results-count">{rows.length} items</span>
      </div>
      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Item</th>
              <th>In stock</th>
              <th>Unit cost</th>
              <th>Minimum level</th>
              <th>Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((i) => (
              <tr key={i.id}>
                <td>
                  <button className="expense-cell" onClick={() => setEdit(i)}>
                    <span
                      className={`inventory-icon ${i.category.toLowerCase()}`}
                    >
                      <Package size={19} />
                    </span>
                    <span>
                      <strong>{i.name}</strong>
                      <small>{i.category}</small>
                    </span>
                  </button>
                </td>
                <td>
                  <div className="stock-cell">
                    <strong>
                      {i.stock} <span>{i.unit}</span>
                    </strong>
                    <div className="stock-track">
                      <i
                        style={{
                          width: `${Math.min(100, (i.stock / Math.max(1, i.minimum * 3)) * 100)}%`,
                          background:
                            i.stock <= i.minimum ? "#cc9f62" : "#8aaa95",
                        }}
                      />
                    </div>
                  </div>
                </td>
                <td>
                  {inr(i.cost)}
                  <small className="muted"> / {i.unit}</small>
                </td>
                <td className="muted">
                  {i.minimum} {i.unit}
                </td>
                <td>
                  <Badge>
                    {i.stock === 0
                      ? "Out of Stock"
                      : i.stock <= i.minimum
                        ? "Low Stock"
                        : "In Stock"}
                  </Badge>
                </td>
                <td>
                  <div className="button-row">
                    <Button variant="secondary" onClick={() => setAdjust(i)}>
                      <Plus size={14} />
                      Stock
                    </Button>
                    <IconButton
                      label={`History for ${i.name}`}
                      onClick={() => setHistory(i.id)}
                    >
                      <History size={16} />
                    </IconButton>
                    <IconButton
                      label={`Edit ${i.name}`}
                      onClick={() => setEdit(i)}
                    >
                      <Pencil size={15} />
                    </IconButton>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length && (
          <EmptyState
            title="A little space on the shelf"
            description="No pantry items match your search."
            action={
              <Button onClick={() => setEdit(null)}>
                <Plus size={16} />
                Add item
              </Button>
            }
          />
        )}
      </div>
      {edit !== undefined && (
        <InventoryForm
          item={edit || undefined}
          onClose={() => setEdit(undefined)}
        />
      )}{" "}
      {adjust && <StockForm item={adjust} onClose={() => setAdjust(null)} />}{" "}
      {history && (
        <Modal
          title={
            d.inventory.find((i) => i.id === history)?.name || "Stock history"
          }
          description="Every little addition and adjustment."
          onClose={() => setHistory(null)}
        >
          <div className="history-list">
            {d.inventory
              .find((i) => i.id === history)
              ?.history.map((h, i) => (
                <div key={i}>
                  <span>
                    <strong>{h.reason}</strong>
                    <small>
                      {format(new Date(h.date), "d MMM yyyy, h:mm a")}
                    </small>
                  </span>
                  <strong
                    className={h.quantity > 0 ? "green-text" : "red-text"}
                  >
                    {h.quantity > 0 ? "+" : ""}
                    {h.quantity}{" "}
                    {d.inventory.find((i) => i.id === history)?.unit}
                  </strong>
                </div>
              ))}
          </div>
        </Modal>
      )}
    </>
  );
}
function InventoryForm({
  item,
  onClose,
}: {
  item?: InventoryItem;
  onClose: () => void;
}) {
  const command = useStore((s) => s.command);
  const [busy, setBusy] = useState(false);
  return (
    <Modal
      title={item ? "A little pantry update" : "A new pantry essential"}
      onClose={onClose}
    >
      <Form
        onSubmit={async (e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          const value: InventoryItem = {
            id: item?.id || uid(),
            name: String(f.get("name")),
            category: String(f.get("category")) as InventoryItem["category"],
            stock: item?.stock ?? Number(f.get("stock")),
            unit: String(f.get("unit")),
            cost: Number(f.get("cost")),
            minimum: Number(f.get("minimum")),
            history: item?.history || [
              {
                date: new Date().toISOString(),
                quantity: Number(f.get("stock")),
                reason: "Opening balance",
              },
            ],
          };
          setBusy(true);
          try {
            await command(
              { type: "inventory.save", value },
              item ? "Pantry item updated" : "Pantry item added",
            );
            onClose();
          } catch {
          } finally {
            setBusy(false);
          }
        }}
      >
        <Field label="Item name">
          <input
            name="name"
            autoFocus
            required
            minLength={2}
            defaultValue={item?.name}
            placeholder="e.g. Belgian dark chocolate"
          />
        </Field>
        <div className="form-grid">
          <Field label="Category">
            <select
              name="category"
              defaultValue={item?.category || "Ingredients"}
            >
              {["Ingredients", "Packaging", "Decorations"].map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </Field>
          <Field label="Unit">
            <select name="unit" defaultValue={item?.unit || "kg"}>
              {["kg", "g", "L", "ml", "pcs", "m", "packs"].map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </Field>
          {!item && (
            <Field label="Opening stock">
              <input
                name="stock"
                type="number"
                required
                min="0"
                step="0.001"
                defaultValue="0"
              />
            </Field>
          )}
          <Field label="Cost per unit (₹)">
            <input
              name="cost"
              type="number"
              required
              min="0"
              step="0.01"
              defaultValue={item?.cost || 0}
            />
          </Field>
          <Field label="Low stock alert at">
            <input
              name="minimum"
              type="number"
              required
              min="0"
              step="0.001"
              defaultValue={item?.minimum || 1}
            />
          </Field>
        </div>
        <div className="modal-actions">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={busy}>
            <Check size={15} />
            Save item
          </Button>
        </div>
      </Form>
    </Modal>
  );
}
function StockForm({
  item,
  onClose,
}: {
  item: InventoryItem;
  onClose: () => void;
}) {
  const command = useStore((s) => s.command);
  const [mode, setMode] = useState("Add stock");
  const [busy, setBusy] = useState(false);
  return (
    <Modal
      title={`A little top-up: ${item.name}`}
      description={`${item.stock} ${item.unit} currently in your pantry`}
      onClose={onClose}
    >
      <Form
        onSubmit={async (e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          const quantity =
            Number(f.get("quantity")) * (mode === "Remove stock" ? -1 : 1);
          setBusy(true);
          try {
            await command(
              {
                type: "inventory.adjust",
                id: item.id,
                quantity,
                reason: String(f.get("reason")),
              },
              "Inventory updated",
            );
            onClose();
          } catch {
          } finally {
            setBusy(false);
          }
        }}
      >
        <Tabs
          className="segmented"
          options={["Add stock", "Remove stock"]}
          value={mode}
          onChange={setMode}
        />
        <Field label={`Quantity (${item.unit})`}>
          <input
            name="quantity"
            type="number"
            autoFocus
            min="0.001"
            max={mode === "Remove stock" ? item.stock : 100000}
            step="0.001"
            required
            placeholder="0"
          />
        </Field>
        <Field label="Reason">
          <input
            name="reason"
            required
            minLength={2}
            placeholder={
              mode === "Add stock"
                ? "Weekly restock, supplier name..."
                : "Usage, spoilage, or correction..."
            }
          />
        </Field>
        <div className="modal-actions">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={busy}>
            <Check size={16} />
            Update stock
          </Button>
        </div>
      </Form>
    </Modal>
  );
}
