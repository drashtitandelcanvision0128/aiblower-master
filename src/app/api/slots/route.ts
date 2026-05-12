import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const admin = createAdminClient();
    const nowIso = new Date().toISOString();

    const { data: slots, error: slotsError } = await admin
      .from("slots")
      .select("id, start_at, end_at, price_paise, capacity")
      .eq("is_active", true)
      .gt("start_at", nowIso)
      .order("start_at", { ascending: true })
      .limit(500);

    if (slotsError) {
      console.error(slotsError);
      return NextResponse.json({ error: "Failed to load slots" }, { status: 500 });
    }

    const { data: confirmed, error: bookError } = await admin
      .from("bookings")
      .select("slot_id")
      .eq("status", "confirmed");

    if (bookError) {
      console.error(bookError);
      return NextResponse.json({ error: "Failed to load availability" }, { status: 500 });
    }

    const counts = new Map<string, number>();
    for (const row of confirmed ?? []) {
      counts.set(row.slot_id, (counts.get(row.slot_id) ?? 0) + 1);
    }

    const enriched = (slots ?? []).map((s) => {
      const confirmedCount = counts.get(s.id) ?? 0;
      const isBooked = confirmedCount >= s.capacity;
      return {
        ...s,
        booked_count: confirmedCount,
        is_booked: isBooked,
        status: isBooked ? "booked" : "available",
      };
    });

    return NextResponse.json({ slots: enriched });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Server misconfiguration" }, { status: 500 });
  }
}
