"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import Script from "next/script";
import { formatInrFromPaise } from "@/lib/format";

type Slot = {
  id: string;
  start_at: string;
  end_at: string;
  price_paise: number;
  status: "available" | "booked";
  is_booked: boolean;
};

export default function BookPage() {
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [paying, setPaying] = useState(false);
  const [scriptReady, setScriptReady] = useState(false);
  const [selectedDateKey, setSelectedDateKey] = useState<string>("");

  const loadSlots = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/slots");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to load slots");
      setSlots(data.slots ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const t = window.setTimeout(() => {
      void loadSlots();
    }, 0);
    return () => window.clearTimeout(t);
  }, [loadSlots]);

  const dateKey = (iso: string) =>
    new Date(iso).toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });

  const formatTime = (iso: string) =>
    new Date(iso).toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
      timeZone: "Asia/Kolkata",
    });

  const formatDateLabel = (iso: string) =>
    new Date(iso).toLocaleDateString("en-IN", {
      month: "short",
      day: "2-digit",
      weekday: "short",
      timeZone: "Asia/Kolkata",
    });

  const groupedDates = slots.reduce(
    (acc, slot) => {
      const key = dateKey(slot.start_at);
      if (!acc.some((d) => d.key === key)) {
        const d = new Date(slot.start_at);
        acc.push({
          key,
          day: d.toLocaleDateString("en-IN", { day: "2-digit", timeZone: "Asia/Kolkata" }),
          month: d.toLocaleDateString("en-IN", { month: "short", timeZone: "Asia/Kolkata" }),
          weekday: d.toLocaleDateString("en-IN", { weekday: "short", timeZone: "Asia/Kolkata" }),
        });
      }
      return acc;
    },
    [] as Array<{ key: string; day: string; month: string; weekday: string }>,
  );

  useEffect(() => {
    if (!groupedDates.length) return;
    if (!selectedDateKey) {
      const t = window.setTimeout(() => setSelectedDateKey(groupedDates[0].key), 0);
      return () => window.clearTimeout(t);
    }
    if (!groupedDates.some((d) => d.key === selectedDateKey)) {
      const t = window.setTimeout(() => setSelectedDateKey(groupedDates[0].key), 0);
      return () => window.clearTimeout(t);
    }
  }, [groupedDates, selectedDateKey]);

  const daySlots = slots.filter((s) => dateKey(s.start_at) === selectedDateKey);
  const selected = daySlots.find((s) => s.id === selectedId) ?? null;
  const selectedDurationMins = selected
    ? Math.max(
        0,
        Math.round(
          (new Date(selected.end_at).getTime() - new Date(selected.start_at).getTime()) / 60000,
        ),
      )
    : 0;

  useEffect(() => {
    if (!selected) {
      const t = window.setTimeout(
        () => setSelectedId(daySlots.find((s) => !s.is_booked)?.id ?? null),
        0,
      );
      return () => window.clearTimeout(t);
    }
  }, [daySlots, selected]);

  const periodSlots = {
    Morning: daySlots.filter((s) => {
      const hour = new Date(s.start_at).toLocaleString("en-US", {
        hour: "numeric",
        hour12: false,
        timeZone: "Asia/Kolkata",
      });
      const h = Number(hour);
      return h >= 5 && h < 12;
    }),
    Afternoon: daySlots.filter((s) => {
      const hour = new Date(s.start_at).toLocaleString("en-US", {
        hour: "numeric",
        hour12: false,
        timeZone: "Asia/Kolkata",
      });
      const h = Number(hour);
      return h >= 12 && h < 17;
    }),
    Evening: daySlots.filter((s) => {
      const hour = new Date(s.start_at).toLocaleString("en-US", {
        hour: "numeric",
        hour12: false,
        timeZone: "Asia/Kolkata",
      });
      const h = Number(hour);
      return h >= 17 && h <= 23;
    }),
  };

  const openCheckout = async () => {
    if (!selected || !name.trim() || !/^[6-9]\d{9}$/.test(phone.trim())) {
      setError("Pick a slot and enter a valid 10-digit mobile number.");
      return;
    }
    if (!scriptReady || typeof window === "undefined" || !window.Razorpay) {
      setError("Payment script is still loading. Try again in a moment.");
      return;
    }

    setPaying(true);
    setError(null);
    try {
      const res = await fetch("/api/bookings/initiate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slotId: selected.id,
          customerName: name.trim(),
          customerPhone: phone.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        const msg =
          typeof data.error === "object"
            ? Object.values(data.error).flat().join(" ")
            : (data.error as string);
        throw new Error(msg || "Could not start checkout");
      }

      const rzp = new window.Razorpay({
        key: data.keyId as string,
        currency: data.currency as string,
        name: "AIbowler",
        description: "Practice slot booking",
        order_id: data.orderId as string,
        prefill: {
          name: name.trim(),
          contact: phone.trim(),
        },
        theme: { color: "#059669" },
        async handler(response) {
          try {
            const verifyRes = await fetch("/api/bookings/verify-payment", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                bookingId: data.bookingId as string,
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
              }),
            });
            const verifyBody = (await verifyRes.json()) as { error?: unknown; ok?: boolean };
            if (!verifyRes.ok) {
              const msg =
                typeof verifyBody.error === "object" && verifyBody.error !== null
                  ? Object.values(verifyBody.error as Record<string, unknown>).flat().join(" ")
                  : typeof verifyBody.error === "string"
                    ? verifyBody.error
                    : "Payment verification failed";
              setError(msg);
              setPaying(false);
              return;
            }
            window.location.href = `/book/success?booking=${encodeURIComponent(data.bookingId as string)}`;
          } catch {
            setError("Could not verify payment. If you were charged, contact support with your payment ID.");
            setPaying(false);
          }
        },
        modal: {
          ondismiss() {
            setPaying(false);
          },
        },
      });
      rzp.open();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Payment could not start");
      setPaying(false);
    }
  };

  return (
    <>
      <Script
        src="https://checkout.razorpay.com/v1/checkout.js"
        strategy="lazyOnload"
        onReady={() => setScriptReady(true)}
      />
      <main className="min-h-[calc(100vh-58px)] bg-[#02110c] px-4 py-8 sm:px-6">
        <div className="mx-auto grid w-full max-w-[1200px] gap-7 lg:grid-cols-[1fr_340px]">
          <section className="rounded-2xl border border-emerald-900/50 bg-[#03140e] p-6">
            <div className="flex flex-wrap items-start justify-between gap-6">
              <div>
                <p className="inline-flex items-center gap-2 rounded-full bg-emerald-500/15 px-3 py-1 text-[11px] font-semibold tracking-[0.16em] text-emerald-300">
                  PREMIUM CENTER <span className="text-emerald-200">★ 5.0</span>
                </p>
                <h1 className="mt-3 text-4xl font-semibold tracking-tight text-white">
                  HP 369 Box Cricket
                </h1>
                <p className="mt-2 text-sm text-emerald-100/70">
                Dabohi Road, behind Krishna Hotel, Ratanpur, Vadodara, Gujarat 390004
                </p>
              </div>
              <div className="min-w-64 rounded-xl border border-emerald-900/70 bg-[#062116] px-4 py-3">
                <p className="text-[11px] font-semibold tracking-[0.15em] text-emerald-300/85">
                  CURRENT TECH STACK
                </p>
                <p className="mt-2 text-lg font-medium text-emerald-50">MasterBowler Pro X</p>
                <p className="text-xs text-emerald-100/65">Real-time Biometrics & Ball Tracking</p>
              </div>
            </div>

            {error ? (
              <p
                className="mt-6 rounded-lg border border-red-500/40 bg-red-950/40 px-4 py-3 text-sm text-red-100"
                role="alert"
              >
                {error}
              </p>
            ) : null}

            <div className="mt-8">
              <p className="text-sm font-medium text-emerald-100">Select Date</p>
              <div className="mt-4 flex flex-wrap gap-3">
                {groupedDates.map((d) => (
                  <button
                    key={d.key}
                    type="button"
                    onClick={() => setSelectedDateKey(d.key)}
                    className={`w-[84px] rounded-xl border px-2 py-3 text-center transition ${
                      selectedDateKey === d.key
                        ? "border-emerald-400 bg-emerald-400 text-emerald-950"
                        : "border-emerald-900/60 bg-[#15211b] text-emerald-100 hover:border-emerald-700"
                    }`}
                  >
                    <p className="text-[11px] font-semibold uppercase tracking-wider">{d.month}</p>
                    <p className="text-5xl leading-none font-semibold">{d.day}</p>
                    <p className="mt-1 text-[11px] uppercase tracking-wider">{d.weekday}</p>
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-10 flex flex-wrap items-center justify-between gap-3">
              <p className="text-lg font-medium text-emerald-100">Available Slots</p>
              <div className="flex items-center gap-5 text-[11px] font-semibold uppercase tracking-wider text-emerald-100/80">
                <span className="inline-flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
                  Selected
                </span>
                <span className="inline-flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-[#2b3530]" />
                  Available
                </span>
                <span className="inline-flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-[#2f3532]" />
                  Booked
                </span>
              </div>
            </div>

            {loading ? (
              <p className="mt-6 text-sm text-emerald-200/70">Loading slots…</p>
            ) : (
              <div className="mt-5 space-y-7">
                {Object.entries(periodSlots).map(([label, list]) => (
                  <div key={label}>
                    <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-200/80">
                      {label}
                    </p>
                    <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                      {list.length === 0 ? (
                        <p className="text-xs text-emerald-100/50">No slots in this period</p>
                      ) : (
                        list.map((slot) => {
                          const isSelected = selectedId === slot.id;
                          const isDisabled = slot.is_booked;
                          return (
                            <button
                              key={slot.id}
                              type="button"
                              disabled={isDisabled}
                              onClick={() => setSelectedId(slot.id)}
                              className={`rounded-lg border px-4 py-3 text-sm font-medium transition ${
                                isDisabled
                                  ? "cursor-not-allowed border-[#3b413d] bg-[#272f2a] text-emerald-50/30"
                                  : isSelected
                                    ? "border-emerald-300 bg-emerald-400 text-emerald-950"
                                    : "border-emerald-900/50 bg-[#1d2520] text-emerald-50 hover:border-emerald-600"
                              }`}
                            >
                              {formatTime(slot.start_at)}
                            </button>
                          );
                        })
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <aside className="space-y-4">
            <div className="overflow-hidden rounded-2xl border border-emerald-900/60 bg-[#0d1f18]">
              <Image
                src="/hero-bg.png"
                alt="Bowling lane"
                width={420}
                height={180}
                className="h-32 w-full object-cover"
              />
              <div className="space-y-4 p-5">
                <p className="text-lg font-medium text-white">Booking Summary</p>
                <div className="space-y-3 text-sm text-emerald-100/80">
                  <div className="flex items-center justify-between border-b border-emerald-100/10 pb-2">
                    <span>Date</span>
                    <span>{selected ? formatDateLabel(selected.start_at) : "—"}</span>
                  </div>
                  <div className="flex items-center justify-between border-b border-emerald-100/10 pb-2">
                    <span>Selected Slot</span>
                    <span className="text-emerald-300">
                      {selected ? `${formatTime(selected.start_at)} - ${formatTime(selected.end_at)}` : "—"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between border-b border-emerald-100/10 pb-2">
                    <span>Duration</span>
                    <span>{selected ? `${selectedDurationMins} mins` : "—"}</span>
                  </div>
                  <div className="flex items-center justify-between border-b border-emerald-100/10 pb-2">
                    <span>Package</span>
                    <span>Elite Session</span>
                  </div>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.22em] text-emerald-100/60">Total Amount</p>
                  <p className="mt-1 text-4xl font-semibold text-emerald-400">
                    {selected ? formatInrFromPaise(selected.price_paise) : "—"}
                  </p>
                </div>
                <div className="space-y-3">
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Full name"
                    className="w-full rounded-lg border border-emerald-900/70 bg-[#05140e] px-3 py-2.5 text-sm text-white outline-none ring-emerald-500/40 focus:ring-2"
                  />
                  <input
                    value={phone}
                    onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
                    maxLength={10}
                    placeholder="Mobile (10 digits)"
                    className="w-full rounded-lg border border-emerald-900/70 bg-[#05140e] px-3 py-2.5 text-sm text-white outline-none ring-emerald-500/40 focus:ring-2"
                  />
                </div>
                <button
                  type="button"
                  disabled={paying || !selected}
                  onClick={() => void openCheckout()}
                  className="w-full rounded-xl bg-emerald-400 px-5 py-3.5 text-base font-semibold text-emerald-950 transition hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {paying ? "Opening checkout…" : "Proceed to Payment"}
                </button>
                <p className="text-center text-xs text-emerald-100/55">
                  Free cancellation up to 24 hours before session.
                </p>
              </div>
            </div>
          </aside>
        </div>
      </main>
    </>
  );
}
