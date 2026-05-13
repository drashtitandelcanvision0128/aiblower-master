import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/auth/session";
import { getPool } from "@/lib/db/pool";
import { adminBookingPatchSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: Params) {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = adminBookingPatchSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const patch = parsed.data;
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  try {
    const pool = getPool();

    const { rows: existing } = await pool.query<{ slot_id: string; amount_paise: string }>(
      `SELECT slot_id, amount_paise::text AS amount_paise FROM bookings WHERE id = $1 LIMIT 1`,
      [id],
    );
    if (existing.length === 0) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    let amountPaise = Number(existing[0].amount_paise);
    let slotId = existing[0].slot_id;

    if (patch.slotId !== undefined) {
      slotId = patch.slotId;
      const { rows: slotRows } = await pool.query<{ price_paise: string }>(
        `SELECT price_paise::text AS price_paise FROM slots WHERE id = $1 AND is_active = true LIMIT 1`,
        [slotId],
      );
      if (slotRows.length === 0) {
        return NextResponse.json({ error: "Invalid slot" }, { status: 400 });
      }
      amountPaise = Number(slotRows[0].price_paise);
    }

    const sets: string[] = [];
    const values: unknown[] = [];
    let i = 1;

    if (patch.customerName !== undefined) {
      sets.push(`customer_name = $${i++}`);
      values.push(patch.customerName);
    }
    if (patch.customerPhone !== undefined) {
      sets.push(`customer_phone = $${i++}`);
      values.push(patch.customerPhone);
    }
    if (patch.status !== undefined) {
      sets.push(`status = $${i++}::booking_status`);
      values.push(patch.status);
    }
    if (patch.slotId !== undefined) {
      sets.push(`slot_id = $${i++}`);
      values.push(slotId);
      sets.push(`amount_paise = $${i++}`);
      values.push(amountPaise);
    }

    values.push(id);
    await pool.query(
      `UPDATE bookings SET ${sets.join(", ")}, updated_at = now() WHERE id = $${i}`,
      values,
    );

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
