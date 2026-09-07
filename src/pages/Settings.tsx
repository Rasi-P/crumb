import { useState } from "react";
import { Link } from "react-router-dom";
import {
  Bell,
  Building2,
  Check,
  CreditCard,
  Download,
  ImagePlus,
  IndianRupee,
  MapPin,
  Moon,
  Package,
  Palette,
  Percent,
  ShieldCheck,
  Sun,
  Truck,
  UserRound,
} from "lucide-react";
import { useData, useStore } from "../lib/store";
import type { Business } from "../domain/models";
import {
  Avatar,
  Button,
  Field,
  Form,
  PageHeader,
  Tabs,
} from "../components/ui";

export default function Settings() {
  const d = useData();
  const command = useStore((s) => s.command);
  const [section, setSection] = useState("Business profile");
  const [form, setForm] = useState<Business>(d.business);
  const [busy, setBusy] = useState(false);
  const update = <K extends keyof Business>(key: K, value: Business[K]) =>
    setForm((s) => ({ ...s, [key]: value }));
  const save = async () => {
    setBusy(true);
    try {
      await command(
        { type: "business.save", value: form },
        "Your business details are saved",
      );
    } catch {
    } finally {
      setBusy(false);
    }
  };
  const nav = [
    ["Business profile", Building2],
    ["Pricing", IndianRupee],
    ["Ingredients", Package],
    ["Taxes", Percent],
    ["Notifications", Bell],
    ["Delivery", Truck],
    ["Payment methods", CreditCard],
    ["Appearance", Palette],
    ["Account", UserRound],
  ] as const;
  return (
    <>
      <PageHeader
        eyebrow="YOUR BUSINESS, YOUR WAY"
        title="The little details"
        description="Make your workspace feel as personal as your cakes."
      />
      <div className="settings-layout">
        <nav className="settings-nav">
          {nav.map(([s, Icon]) => (
            <button
              key={s}
              className={section === s ? "active" : ""}
              onClick={() => setSection(s)}
            >
              <Icon size={17} />
              {s}
            </button>
          ))}
        </nav>
        <section className="settings-main">
          <Form
            onSubmit={(e) => {
              e.preventDefault();
              void save();
            }}
          >
            <div className="section-heading">
              <div>
                <h2>{section}</h2>
                <p>
                  {section === "Business profile"
                    ? "The name and the story behind every celebration."
                    : section === "Pricing"
                      ? "A fair price for your time, your ingredients, and your craft."
                      : section === "Appearance"
                        ? "A space that feels like you."
                        : "The details that keep your business running smoothly."}
                </p>
              </div>
            </div>
            {section === "Business profile" && (
              <>
                <div className="business-logo-editor">
                  <span>
                    {form.logo ? (
                      <img src={form.logo} alt="Business logo" />
                    ) : (
                      <span>L</span>
                    )}
                  </span>
                  <div>
                    <strong>Your bakery’s mark</strong>
                    <p>PNG or JPEG, up to 300 KB</p>
                    <label className="button secondary">
                      <ImagePlus size={15} />
                      Upload logo
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        hidden
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          if (file.size > 300000) {
                            useStore
                              .getState()
                              .toast(
                                "Choose an image smaller than 300 KB.",
                                "error",
                              );
                            return;
                          }
                          const reader = new FileReader();
                          reader.onload = () =>
                            update("logo", String(reader.result));
                          reader.readAsDataURL(file);
                        }}
                      />
                    </label>
                  </div>
                </div>
                <div className="form-grid">
                  <Field label="Business name">
                    <input
                      required
                      minLength={2}
                      value={form.name}
                      onChange={(e) => update("name", e.target.value)}
                    />
                  </Field>
                  <Field label="Your first name">
                    <input
                      required
                      minLength={2}
                      value={form.owner}
                      onChange={(e) => update("owner", e.target.value)}
                    />
                  </Field>
                  <Field label="Email">
                    <input
                      type="email"
                      value={form.email}
                      onChange={(e) => update("email", e.target.value)}
                    />
                  </Field>
                  <Field label="Phone">
                    <input
                      type="tel"
                      value={form.phone}
                      onChange={(e) => update("phone", e.target.value)}
                    />
                  </Field>
                </div>
                <Field label="Bakery address">
                  <textarea
                    rows={2}
                    value={form.address}
                    onChange={(e) => update("address", e.target.value)}
                  />
                </Field>
                <div className="form-grid">
                  <Field label="Instagram">
                    <input
                      value={form.instagram}
                      onChange={(e) => update("instagram", e.target.value)}
                    />
                  </Field>
                  <Field label="WhatsApp">
                    <input
                      type="tel"
                      value={form.whatsapp}
                      onChange={(e) => update("whatsapp", e.target.value)}
                    />
                  </Field>
                </div>
                <Field label="Booking terms">
                  <textarea
                    rows={4}
                    value={form.terms}
                    maxLength={2000}
                    onChange={(e) => update("terms", e.target.value)}
                  />
                </Field>
              </>
            )}
            {section === "Pricing" && (
              <>
                <Field
                  label="Target gross margin (%)"
                  hint="Used to suggest selling prices in Cake Studio."
                >
                  <input
                    type="number"
                    required
                    min="5"
                    max="80"
                    value={form.margin}
                    onChange={(e) => update("margin", Number(e.target.value))}
                  />
                </Field>
                <div className="pricing-example">
                  <span>For a cake that costs ₹2,000 to make</span>
                  <strong>
                    ₹
                    {(
                      Math.ceil(2000 / (1 - form.margin / 100) / 50) * 50
                    ).toLocaleString("en-IN")}
                  </strong>
                  <p>Suggested selling price at {form.margin}% margin</p>
                </div>
                <Field label="Currency">
                  <select value={form.currency} onChange={() => {}}>
                    <option value="INR">INR · Indian rupee (₹)</option>
                  </select>
                </Field>
              </>
            )}
            {section === "Ingredients" && (
              <>
                <div className="inline-notice">
                  <Package size={22} />
                  <span>
                    <strong>Your recipes start in the pantry</strong>
                    <p>
                      Ingredient quantities scale with cake diameter, tier
                      height, and flavor.
                    </p>
                  </span>
                </div>
                <div className="recipe-list">
                  {[
                    ["All-purpose flour", "400 g"],
                    ["Caster sugar", "300 g"],
                    ["Eggs", "5 pcs"],
                    ["Unsalted butter", "250 g"],
                    ["Whipping cream", "500 ml"],
                  ].map(([name, amount]) => (
                    <div key={name}>
                      <span>{name}</span>
                      <strong>{amount}</strong>
                    </div>
                  ))}
                </div>
                <p className="muted">
                  Base recipe for one 8-inch vanilla tier, 4 inches tall.
                </p>
                <Link className="button secondary" to="/inventory">
                  <Package size={15} />
                  Manage ingredients & costs
                </Link>
              </>
            )}
            {section === "Taxes" && (
              <>
                <Field
                  label="Default tax rate (%)"
                  hint="Applied to new orders after delivery fees and discounts."
                >
                  <input
                    type="number"
                    min="0"
                    max="40"
                    step="0.1"
                    required
                    value={form.tax}
                    onChange={(e) => update("tax", Number(e.target.value))}
                  />
                </Field>
                <div className="inline-notice">
                  <Percent size={21} />
                  <p>
                    Saved quotations and existing orders retain the tax rate
                    agreed with the customer.
                  </p>
                </div>
              </>
            )}
            {section === "Notifications" && (
              <>
                <label className="toggle-row">
                  <span>
                    <strong>Business notifications</strong>
                    <small>
                      Payments, order updates, and customer approvals.
                    </small>
                  </span>
                  <input
                    type="checkbox"
                    role="switch"
                    checked={form.notifications}
                    onChange={(e) => update("notifications", e.target.checked)}
                  />
                </label>
                <div className="notification-settings-list">
                  {[
                    "New celebrations & orders",
                    "Payment received",
                    "Design approved or changes requested",
                    "Pantry items below their minimum",
                  ].map((s) => (
                    <div key={s}>
                      <Check size={16} />
                      {s}
                    </div>
                  ))}
                </div>
              </>
            )}
            {section === "Delivery" && (
              <>
                <Field label="Business hours">
                  <input
                    value={form.hours}
                    onChange={(e) => update("hours", e.target.value)}
                  />
                </Field>
                <Field label="Delivery neighborhoods">
                  <textarea
                    rows={3}
                    value={form.zones}
                    onChange={(e) => update("zones", e.target.value)}
                  />
                </Field>
                <Field label="Default delivery fee (₹)">
                  <input
                    type="number"
                    min="0"
                    max="100000"
                    required
                    value={form.deliveryFee}
                    onChange={(e) =>
                      update("deliveryFee", Number(e.target.value))
                    }
                  />
                </Field>
                <Field label="Pickup address">
                  <textarea
                    rows={2}
                    value={form.address}
                    onChange={(e) => update("address", e.target.value)}
                  />
                </Field>
              </>
            )}
            {section === "Payment methods" && (
              <>
                <div className="payment-methods">
                  {["UPI", "Cash", "Card", "Bank Transfer", "Other"].map(
                    (m) => (
                      <div key={m}>
                        <CreditCard size={19} />
                        <span>
                          <strong>{m}</strong>
                          <small>Manual payment tracking</small>
                        </span>
                        <Check size={17} />
                      </div>
                    ),
                  )}
                </div>
                <Field label="Payment & booking instructions">
                  <textarea
                    rows={5}
                    value={form.terms}
                    onChange={(e) => update("terms", e.target.value)}
                  />
                </Field>
              </>
            )}
            {section === "Appearance" && (
              <div className="appearance-options">
                {(["Light", "Dark", "System"] as const).map((theme) => (
                  <button
                    type="button"
                    key={theme}
                    className={form.theme === theme ? "selected" : ""}
                    onClick={() => update("theme", theme)}
                  >
                    <div className={`theme-preview ${theme.toLowerCase()}`}>
                      <span />
                      <div>
                        <i />
                        <i />
                        <i />
                      </div>
                    </div>
                    <span>
                      {theme === "Light" ? (
                        <Sun size={16} />
                      ) : theme === "Dark" ? (
                        <Moon size={16} />
                      ) : (
                        <Palette size={16} />
                      )}{" "}
                      {theme}
                      {form.theme === theme && <Check size={16} />}
                    </span>
                  </button>
                ))}
              </div>
            )}
            {section === "Account" && (
              <>
                <div className="account-profile">
                  <Avatar name={`${form.owner} Mitchell`} size="large" />
                  <div>
                    <h3>{form.owner} Mitchell</h3>
                    <p>Business owner · {form.name}</p>
                  </div>
                </div>
                <Field label="Account email">
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => update("email", e.target.value)}
                  />
                </Field>
                <div className="inline-notice">
                  <ShieldCheck size={22} />
                  <span>
                    <strong>Your bakery data, kept together</strong>
                    <p>
                      Download a backup of your customers, orders, designs and
                      business records.
                    </p>
                  </span>
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    const url = URL.createObjectURL(
                      new Blob([JSON.stringify(d, null, 2)], {
                        type: "application/json",
                      }),
                    );
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = "crumb-business-backup.json";
                    a.click();
                    URL.revokeObjectURL(url);
                  }}
                >
                  <Download size={16} />
                  Download business data
                </Button>
              </>
            )}
            {section !== "Ingredients" && (
              <div className="settings-save">
                <Button type="submit" loading={busy}>
                  <Check size={16} />
                  Save changes
                </Button>
                <small>Made yours, down to the details.</small>
              </div>
            )}
          </Form>
        </section>
      </div>
    </>
  );
}
