# AIbowler

Web platform for **AIbowler** batting practice with a bowling machine: marketing site, paid slot booking (Razorpay), and an admin area for bookings.

## Stack

- [Next.js](https://nextjs.org/) (App Router) + TypeScript
- [Supabase](https://supabase.com/) (Postgres, Auth, RLS)
- [Razorpay](https://razorpay.com/) (Orders + Checkout + webhooks)
- [Twilio](https://www.twilio.com/) (admin WhatsApp + optional customer SMS)

## Setup

1. **Clone and install**

   ```bash
   npm install
   ```

2. **Supabase**

   - Create a project in the Supabase dashboard.
   - Run SQL migrations in order from [`supabase/migrations`](supabase/migrations) (SQL editor: paste each file, or use [Supabase CLI](https://supabase.com/docs/guides/cli) `supabase db push` if you link the project).

3. **Environment**

   Copy [`.env.example`](.env.example) to `.env.local` and fill values from Supabase (Settings → API) and Razorpay (API keys + Webhooks secret).

4. **Booking notifications (after successful payment)**

   When Razorpay sends `payment.captured`, the app confirms the booking and can notify the admin on WhatsApp and the customer by SMS.

   - **Admin WhatsApp:** `ADMIN_NOTIFY_WHATSAPP_E164` (E.164, e.g. `+919876543210`). Twilio WhatsApp [sandbox](https://www.twilio.com/docs/whatsapp/sandbox): set `TWILIO_WHATSAPP_FROM` to the sandbox sender (e.g. `whatsapp:+14155238886`). **You must join the sandbox** from the phone that owns that E.164 (send Twilio’s join code to the sandbox WhatsApp number) or admin WhatsApp notifications will not arrive.
   - **Customer SMS confirmation:** set `TWILIO_SMS_FROM` (your Twilio SMS number or Messaging Service SID) to send a short SMS to the booking mobile.

   Apply the migration that adds `notifications_sent_at` tracking to `bookings` (see `supabase/migrations`).

5. **Razorpay webhook**

   - URL: `https://<your-domain>/api/webhooks/razorpay`
   - Events: at minimum `payment.captured` (and/or `order.paid` as configured in code).
   - Use the same webhook secret as `RAZORPAY_WEBHOOK_SECRET`.

   **Webhook vs checkout verification:** After Checkout succeeds, the browser calls `POST /api/bookings/verify-payment` (HMAC using **`RAZORPAY_KEY_SECRET`**) so bookings confirm even if the webhook is delayed or misconfigured (e.g. local dev without a public URL). Webhooks remain a backup path. **`RAZORPAY_WEBHOOK_SECRET`** is only for verifying the webhook HTTP body signature; it is **not** the same value as **`RAZORPAY_KEY_SECRET`** (Razorpay API key secret from API keys).

6. **Admin user**

   - In Supabase: Authentication → add a user (email/password or magic link).
   - In SQL editor, grant admin (replace the UUID with `auth.users.id`):

     ```sql
     insert into public.admin_users (user_id) values ('YOUR-USER-UUID');
     ```

7. **Run locally**

   ```bash
   npm run dev
   ```

   - Site: [http://localhost:3000](http://localhost:3000)
   - Book: [http://localhost:3000/book](http://localhost:3000/book)
   - Admin: [http://localhost:3000/admin/login](http://localhost:3000/admin/login)

## Deploy to production (GitHub + domain)

1. **Repository**

   - Ensure `.env.local` is **not** committed (it stays ignored; only [`.env.example`](.env.example) should define keys without secrets).
   - Push the repo to GitHub.

2. **Hosting**

   - Deploy as a **Node** app running `npm run build` then `npm run start`, or use **[Vercel](https://vercel.com/)** (recommended for Next.js): import the GitHub repo, framework preset Next.js, Node **20+**.
   - In the host’s **Environment Variables** UI, copy every variable from your local `.env.local` (same names as [`.env.example`](.env.example)). Use **production** Razorpay keys and webhook secret when you go live.

3. **URLs**

   - Set `NEXT_PUBLIC_APP_URL` to your public URL (e.g. `https://yourdomain.com`).
   - In Razorpay Dashboard → Webhooks, set the endpoint to `https://yourdomain.com/api/webhooks/razorpay` and the secret to match `RAZORPAY_WEBHOOK_SECRET`.

4. **Smoke test**

   - Open `/book`, complete a **test** payment, confirm the booking is **confirmed** in admin and notifications behave as expected.

## Project layout

- `src/app` – routes (home, book, admin)
- `src/app/api` – booking initiation, Razorpay webhook, admin APIs
- `supabase/migrations` – schema, RLS, seed slots, payment confirmation RPC

## Scripts

| Command   | Description        |
| --------- | ------------------ |
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm run lint` | ESLint             |
