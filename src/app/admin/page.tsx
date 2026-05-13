"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { formatInrFromPaise, formatSlotRange } from "@/lib/format";
import { adminBookingPatchSchema } from "@/lib/validation";

type SlotRow = {
  id: string;
  start_at: string;
  end_at: string;
  price_paise: number;
  capacity: number;
  is_active: boolean;
};

type BookingRow = {
  id: string;
  customer_name: string;
  customer_phone: string;
  status: string;
  amount_paise: number;
  currency: string;
  created_at: string;
  razorpay_order_id: string | null;
  razorpay_payment_id: string | null;
  slot_id: string;
  slots: SlotRow | SlotRow[] | null;
};

const STATUSES = ["pending_payment", "confirmed", "cancelled", "expired"] as const;

export default function AdminDashboardPage() {
  const router = useRouter();
  const [rows, setRows] = useState<BookingRow[]>([]);
  const [slots, setSlots] = useState<SlotRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<BookingRow | null>(null);
  const [saving, setSaving] = useState(false);
  const [profileName, setProfileName] = useState("");
  const [profileEmail, setProfileEmail] = useState("");
  const [loadedEmail, setLoadedEmail] = useState("");
  const [profileCurrentPassword, setProfileCurrentPassword] = useState("");
  const [profilePassword, setProfilePassword] = useState("");
  const [profilePassword2, setProfilePassword2] = useState("");
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMessage, setProfileMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [bRes, sRes] = await Promise.all([
        fetch("/api/admin/bookings", { credentials: "include" }),
        fetch("/api/admin/slots", { credentials: "include" }),
      ]);

      if (bRes.status === 401 || sRes.status === 401) {
        router.replace("/admin/login");
        router.refresh();
        return;
      }

      if (!bRes.ok) {
        const j = (await bRes.json()) as { error?: string };
        setError(j.error ?? "Could not load bookings");
        setRows([]);
      } else {
        const j = (await bRes.json()) as { bookings?: BookingRow[] };
        setRows(j.bookings ?? []);
      }

      if (sRes.ok) {
        const j = (await sRes.json()) as { slots?: SlotRow[] };
        setSlots(j.slots ?? []);
      }
    } catch {
      setError("Network error");
      setRows([]);
    }
    setLoading(false);
  }, [router]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void (async () => {
      const res = await fetch("/api/admin/me", { credentials: "include" });
      if (!res.ok) return;
      const d = (await res.json()) as { email?: string; displayName?: string };
      const em = d.email ?? "";
      setProfileEmail(em);
      setLoadedEmail(em);
      setProfileName(d.displayName ?? "");
    })();
  }, []);

  const saveProfile = async () => {
    setProfileMessage(null);
    if (profilePassword && profilePassword !== profilePassword2) {
      setProfileMessage("New password and confirmation do not match.");
      return;
    }
    if (profilePassword && profilePassword.length < 6) {
      setProfileMessage("Password must be at least 6 characters.");
      return;
    }

    const emailChanged = profileEmail.trim() !== loadedEmail.trim();
    const settingPw = profilePassword.trim() !== "";
    if ((emailChanged || settingPw) && !profileCurrentPassword.trim()) {
      setProfileMessage("Enter your current password to change email or set a new password.");
      return;
    }

    setProfileSaving(true);
    try {
      const res = await fetch("/api/admin/profile", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName: profileName.trim(),
          email: profileEmail.trim(),
          currentPassword: profileCurrentPassword || undefined,
          newPassword: profilePassword || undefined,
          newPasswordConfirm: profilePassword2 || undefined,
        }),
      });
      const data = (await res.json()) as { error?: unknown; email?: string };
      if (!res.ok) {
        const msg =
          typeof data.error === "string"
            ? data.error
            : "Could not save profile. Check your password and try again.";
        setProfileMessage(msg);
        setProfileSaving(false);
        return;
      }

      setProfilePassword("");
      setProfilePassword2("");
      setProfileCurrentPassword("");
      if (typeof data.email === "string") {
        setLoadedEmail(data.email);
        setProfileEmail(data.email);
      }
      setProfileMessage("Saved.");
    } catch {
      setProfileMessage("Network error");
    }
    setProfileSaving(false);
  };

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (statusFilter && r.status !== statusFilter) return false;
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        if (
          !r.customer_name.toLowerCase().includes(q) &&
          !r.customer_phone.includes(q)
        ) {
          return false;
        }
      }
      return true;
    });
  }, [rows, statusFilter, search]);

  const signOut = async () => {
    await fetch("/api/admin/logout", { method: "POST", credentials: "include" });
    router.replace("/admin/login");
    router.refresh();
  };

  const slotLabel = (b: BookingRow) => {
    const s = b.slots;
    const slot = Array.isArray(s) ? s[0] : s;
    if (!slot) return "—";
    return formatSlotRange(slot.start_at, slot.end_at);
  };

  const openEdit = (b: BookingRow) => {
    setEditing({ ...b });
    setError(null);
  };

  const saveEdit = async () => {
    if (!editing) return;
    const slot = Array.isArray(editing.slots) ? editing.slots[0] : editing.slots;
    const parsed = adminBookingPatchSchema.safeParse({
      customerName: editing.customer_name,
      customerPhone: editing.customer_phone,
      slotId: editing.slot_id,
      status: editing.status,
    });
    if (!parsed.success) {
      setError("Check the form values (10-digit mobile, valid status).");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/bookings/${editing.id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName: parsed.data.customerName ?? editing.customer_name,
          customerPhone: parsed.data.customerPhone ?? editing.customer_phone,
          slotId: parsed.data.slotId ?? editing.slot_id,
          status: parsed.data.status ?? editing.status,
        }),
      });

      if (!res.ok) {
        const j = (await res.json()) as { error?: unknown };
        const msg = typeof j.error === "string" ? j.error : "Update failed";
        setError(msg);
        setSaving(false);
        return;
      }

      setEditing(null);
      await load();
    } catch {
      setError("Network error");
    }
    setSaving(false);
  };

  const slotOptionsForEdit = useMemo(() => {
    if (!editing) return slots;
    const currentId = editing.slot_id;
    const currentSlot = slots.find((s) => s.id === currentId);
    if (currentSlot) return slots;
    const embedded = Array.isArray(editing.slots) ? editing.slots[0] : editing.slots;
    if (embedded) return [embedded, ...slots.filter((s) => s.id !== embedded.id)];
    return slots;
  }, [editing, slots]);

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-white">Bookings</h1>
          <p className="mt-1 text-sm text-emerald-100/70">
            View and edit reservations. Refunds are still handled in Razorpay if you cancel a paid
            booking.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void signOut()}
          className="self-start rounded-full border border-emerald-700/60 px-4 py-2 text-sm text-emerald-100 hover:bg-emerald-950/60"
        >
          Sign out
        </button>
      </div>

      <section className="mt-10 rounded-2xl border border-emerald-800/50 bg-[#042f1f]/40 p-6">
        <h2 className="text-lg font-semibold text-white">Admin account</h2>
        <p className="mt-1 text-sm text-emerald-100/70">
          Display name, email, and a bcrypt password hash live in{" "}
          <code className="text-emerald-200/90">admin_users</code> in Postgres. Use “Current password”
          when you change email or password.
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label htmlFor="profile-name" className="block text-xs text-emerald-200/80">
              Display name
            </label>
            <input
              id="profile-name"
              value={profileName}
              onChange={(e) => setProfileName(e.target.value)}
              className="mt-1 w-full rounded-lg border border-emerald-800/60 bg-[#021910] px-3 py-2 text-sm text-white"
              autoComplete="name"
            />
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="profile-email" className="block text-xs text-emerald-200/80">
              Email
            </label>
            <input
              id="profile-email"
              type="email"
              value={profileEmail}
              onChange={(e) => setProfileEmail(e.target.value)}
              className="mt-1 w-full rounded-lg border border-emerald-800/60 bg-[#021910] px-3 py-2 text-sm text-white"
              autoComplete="email"
            />
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="profile-current-pw" className="block text-xs text-emerald-200/80">
              Current password (required to change email or password)
            </label>
            <input
              id="profile-current-pw"
              type="password"
              value={profileCurrentPassword}
              onChange={(e) => setProfileCurrentPassword(e.target.value)}
              className="mt-1 w-full rounded-lg border border-emerald-800/60 bg-[#021910] px-3 py-2 text-sm text-white"
              autoComplete="current-password"
            />
          </div>
          <div>
            <label htmlFor="profile-pw" className="block text-xs text-emerald-200/80">
              New password (optional)
            </label>
            <input
              id="profile-pw"
              type="password"
              value={profilePassword}
              onChange={(e) => setProfilePassword(e.target.value)}
              className="mt-1 w-full rounded-lg border border-emerald-800/60 bg-[#021910] px-3 py-2 text-sm text-white"
              autoComplete="new-password"
            />
          </div>
          <div>
            <label htmlFor="profile-pw2" className="block text-xs text-emerald-200/80">
              Confirm new password
            </label>
            <input
              id="profile-pw2"
              type="password"
              value={profilePassword2}
              onChange={(e) => setProfilePassword2(e.target.value)}
              className="mt-1 w-full rounded-lg border border-emerald-800/60 bg-[#021910] px-3 py-2 text-sm text-white"
              autoComplete="new-password"
            />
          </div>
        </div>
        {profileMessage ? (
          <p className="mt-4 text-sm text-emerald-200/90" role="status">
            {profileMessage}
          </p>
        ) : null}
        <div className="mt-4">
          <button
            type="button"
            disabled={profileSaving}
            onClick={() => void saveProfile()}
            className="rounded-full bg-emerald-400 px-5 py-2 text-sm font-semibold text-emerald-950 hover:bg-emerald-300 disabled:opacity-50"
          >
            {profileSaving ? "Saving…" : "Save account"}
          </button>
        </div>
      </section>

      <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-end">
        <div>
          <label htmlFor="status" className="block text-xs text-emerald-200/80">
            Status
          </label>
          <select
            id="status"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="mt-1 rounded-lg border border-emerald-800/60 bg-[#021910] px-3 py-2 text-sm text-white"
          >
            <option value="">All</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s.replace("_", " ")}
              </option>
            ))}
          </select>
        </div>
        <div className="sm:flex-1">
          <label htmlFor="search" className="block text-xs text-emerald-200/80">
            Search name or phone
          </label>
          <input
            id="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="mt-1 w-full max-w-md rounded-lg border border-emerald-800/60 bg-[#021910] px-3 py-2 text-sm text-white"
            placeholder="Type to filter"
          />
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="rounded-full bg-emerald-400 px-4 py-2 text-sm font-semibold text-emerald-950 hover:bg-emerald-300"
        >
          Refresh
        </button>
      </div>

      {error ? (
        <p className="mt-6 text-sm text-red-300" role="alert">
          {error}
        </p>
      ) : null}

      {loading ? (
        <p className="mt-8 text-sm text-emerald-200/80">Loading…</p>
      ) : (
        <div className="mt-8 overflow-x-auto rounded-xl border border-emerald-800/50">
          <table className="min-w-full divide-y divide-emerald-900/60 text-left text-sm">
            <thead className="bg-[#042f1f]/80 text-xs uppercase tracking-wide text-emerald-300/90">
              <tr>
                <th className="px-4 py-3">When</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Phone</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Amount</th>
                <th className="px-4 py-3">Payment</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-emerald-900/40 bg-[#021910]/80">
              {filtered.map((b) => (
                <tr key={b.id} className="text-emerald-50/95">
                  <td className="whitespace-nowrap px-4 py-3">{slotLabel(b)}</td>
                  <td className="px-4 py-3">{b.customer_name}</td>
                  <td className="whitespace-nowrap px-4 py-3">{b.customer_phone}</td>
                  <td className="px-4 py-3 capitalize">{b.status.replace("_", " ")}</td>
                  <td className="whitespace-nowrap px-4 py-3">
                    {formatInrFromPaise(b.amount_paise)}
                  </td>
                  <td className="max-w-[140px] truncate px-4 py-3 text-xs text-emerald-200/70">
                    {b.razorpay_payment_id ?? "—"}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => openEdit(b)}
                      className="text-emerald-300 underline hover:text-white"
                    >
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 ? (
            <p className="px-4 py-6 text-center text-sm text-emerald-200/70">No rows match.</p>
          ) : null}
        </div>
      )}

      {editing ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-lg rounded-2xl border border-emerald-800/60 bg-[#042f1f] p-6 shadow-xl">
            <h2 className="text-lg font-semibold text-white">Edit booking</h2>
            <div className="mt-4 space-y-3">
              <div>
                <label className="block text-xs text-emerald-200/80">Name</label>
                <input
                  value={editing.customer_name}
                  onChange={(e) => setEditing({ ...editing, customer_name: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-emerald-800/60 bg-[#021910] px-3 py-2 text-sm text-white"
                />
              </div>
              <div>
                <label className="block text-xs text-emerald-200/80">Mobile</label>
                <input
                  value={editing.customer_phone}
                  onChange={(e) =>
                    setEditing({ ...editing, customer_phone: e.target.value.replace(/\D/g, "") })
                  }
                  maxLength={10}
                  className="mt-1 w-full rounded-lg border border-emerald-800/60 bg-[#021910] px-3 py-2 text-sm text-white"
                />
              </div>
              <div>
                <label className="block text-xs text-emerald-200/80">Status</label>
                <select
                  value={editing.status}
                  onChange={(e) => setEditing({ ...editing, status: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-emerald-800/60 bg-[#021910] px-3 py-2 text-sm text-white"
                >
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s.replace("_", " ")}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-emerald-200/80">Slot</label>
                <select
                  value={editing.slot_id}
                  onChange={(e) => {
                    const id = e.target.value;
                    const s = slotOptionsForEdit.find((x) => x.id === id) ?? null;
                    setEditing({
                      ...editing,
                      slot_id: id,
                      slots: s,
                      amount_paise: s?.price_paise ?? editing.amount_paise,
                    });
                  }}
                  className="mt-1 max-h-40 w-full rounded-lg border border-emerald-800/60 bg-[#021910] px-3 py-2 text-sm text-white"
                >
                  {slotOptionsForEdit.map((s) => (
                    <option key={s.id} value={s.id}>
                      {formatSlotRange(s.start_at, s.end_at)}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="rounded-full px-4 py-2 text-sm text-emerald-200 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => void saveEdit()}
                className="rounded-full bg-emerald-400 px-5 py-2 text-sm font-semibold text-emerald-950 hover:bg-emerald-300 disabled:opacity-50"
              >
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
