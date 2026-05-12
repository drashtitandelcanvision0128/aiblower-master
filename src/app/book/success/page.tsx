"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { formatInrFromPaise, formatSlotRange } from "@/lib/format";

type BookingPayload = {
  id: string;
  status: string;
  customerName: string;
  customerPhone: string;
  amountPaise: number;
  currency: string;
  slotStart: string | null;
  slotEnd: string | null;
};

function SuccessContent() {
  const searchParams = useSearchParams();
  const bookingId = searchParams.get("booking");
  const [data, setData] = useState<BookingPayload | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!bookingId) return;

    let cancelled = false;
    const tick = async () => {
      try {
        const res = await fetch(`/api/bookings/${bookingId}`);
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "Not found");
        if (!cancelled) setData(json as BookingPayload);
      } catch (e) {
        if (!cancelled) setErr(e instanceof Error ? e.message : "Error");
      }
    };

    void tick();
    const id = window.setInterval(() => void tick(), 4000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [bookingId]);

  if (!bookingId) {
    return <p className="text-sm text-red-200">Missing booking reference.</p>;
  }

  if (err && !data) {
    return <p className="text-sm text-red-200">{err}</p>;
  }

  if (!data) {
    return <p className="text-sm text-emerald-200/80">Checking your booking…</p>;
  }

  const slotLabel =
    data.slotStart && data.slotEnd ? formatSlotRange(data.slotStart, data.slotEnd) : "—";

  return (
    <div className="space-y-4">
      <p className="text-sm text-emerald-100/80">
        Status:{" "}
        <span className="font-semibold capitalize text-white">
          {data.status.replace("_", " ")}
        </span>
      </p>
      {data.status === "pending_payment" ? (
        <p className="text-sm text-amber-200/90">
          Payment is still processing. This page refreshes every few seconds. If it stays pending,
          contact the venue with your mobile number.
        </p>
      ) : null}
      {data.status === "confirmed" ? (
        <p className="rounded-lg border border-emerald-500/40 bg-emerald-950/40 px-4 py-3 text-sm text-emerald-50">
          You&apos;re confirmed for <span className="font-medium">{slotLabel}</span>. We have{" "}
          <span className="font-medium">{data.customerName}</span> on{" "}
          <span className="font-medium">{data.customerPhone}</span>. Amount{" "}
          {formatInrFromPaise(data.amountPaise)}.
        </p>
      ) : null}
      <div className="flex flex-wrap gap-3 pt-2">
        <Link href="/book" className="text-sm font-medium text-emerald-300 underline">
          Book another slot
        </Link>
        <Link href="/" className="text-sm font-medium text-emerald-300/80 underline">
          Back home
        </Link>
      </div>
    </div>
  );
}

export default function BookSuccessPage() {
  return (
    <main className="mx-auto max-w-lg px-4 py-12 sm:px-6">
      <h1 className="text-2xl font-semibold text-white">Booking status</h1>
      <p className="mt-2 text-sm text-emerald-100/75">
        Keep this tab open until you see a confirmed status after payment.
      </p>
      <div className="mt-8 rounded-2xl border border-emerald-800/50 bg-[#042f1f]/60 p-6">
        <Suspense fallback={<p className="text-sm text-emerald-200/80">Loading…</p>}>
          <SuccessContent />
        </Suspense>
      </div>
    </main>
  );
}
