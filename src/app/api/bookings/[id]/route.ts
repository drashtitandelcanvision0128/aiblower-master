import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("bookings")
      .select(
        `
        id,
        status,
        customer_name,
        customer_phone,
        amount_paise,
        currency,
        slots ( start_at, end_at )
      `,
      )
      .eq("id", id)
      .maybeSingle();

    if (error || !data) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const slot = data.slots;
    const s =
      slot && Array.isArray(slot)
        ? slot[0]
        : (slot as { start_at?: string; end_at?: string } | null);

    return NextResponse.json({
      id: data.id,
      status: data.status,
      customerName: data.customer_name,
      customerPhone: data.customer_phone,
      amountPaise: data.amount_paise,
      currency: data.currency,
      slotStart: s?.start_at ?? null,
      slotEnd: s?.end_at ?? null,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
