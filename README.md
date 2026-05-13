# AIbowler

Web platform for **AIbowler** batting practice with a bowling machine: marketing site, paid slot booking (Razorpay), and an admin area for bookings.

## Stack

- [Next.js](https://nextjs.org/) (App Router) + TypeScript
- [PostgreSQL](https://www.postgresql.org/) (direct access via `pg`)
- [Razorpay](https://razorpay.com/) (Orders + Checkout + webhooks)
- [Twilio](https://www.twilio.com/) (admin WhatsApp + optional customer SMS)

## Setup

1. **Clone and install**

   ```bash
   npm install
   ```

2. **PostgreSQL**

   - Install Postgres locally or use a managed instance.
   - Run SQL migrations **in order** from [`db/migrations`](db/migrations) (e.g. `psql` with your connection string, or any SQL client).

3. **Environment**

   Copy [`.env.example`](.env.example) to `.env` or `.env.local` and set:

   For **Coolify / VPS production**, see also [`.env.production.example`](.env.production.example) (same variables, deployment-focused comments). If production logs mention env vars for a database layer you do not use, the server is usually still running a **stale `.next` folder** — see **Hosting** below and run `npm run clean && npm run build` before `npm run start`.

   - Database: `DATABASE_URL` **or** `DB_HOST`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`, etc.
   - `ADMIN_SESSION_SECRET` — long random string (used to sign the admin session cookie).
   - Razorpay: `RAZORPAY_KEY_SECRET`, webhook secret, and **`RAZORPAY_KEY_ID`** (or `NEXT_PUBLIC_RAZORPAY_KEY_ID`) — same Key ID from the Razorpay dashboard. Prefer **`RAZORPAY_KEY_ID`** in Docker or any host where env is injected only at container start (so checkout still gets a key if `NEXT_PUBLIC_*` was not present during `npm run build`).

4. **Booking notifications (after successful payment)**

   When Razorpay sends `payment.captured`, the app confirms the booking and can notify the admin on WhatsApp and the customer by SMS.

   - **Admin WhatsApp:** `ADMIN_NOTIFY_WHATSAPP_E164` (E.164, e.g. `+919876543210`). Twilio WhatsApp [sandbox](https://www.twilio.com/docs/whatsapp/sandbox): set `TWILIO_WHATSAPP_FROM` to the sandbox sender (e.g. `whatsapp:+14155238886`). **You must join the sandbox** from the phone that owns that E.164 (send Twilio’s join code to the sandbox WhatsApp number) or admin WhatsApp notifications will not arrive.
   - **Customer SMS confirmation:** set `TWILIO_SMS_FROM` (your Twilio SMS number or Messaging Service SID) to send a short SMS to the booking mobile.

   Apply the migration that adds `notifications_sent_at` tracking to `bookings` (see `db/migrations`).

5. **Razorpay webhook**

   - URL: `https://<your-domain>/api/webhooks/razorpay`
   - Events: at minimum `payment.captured` (and/or `order.paid` as configured in code).
   - Use the same webhook secret as `RAZORPAY_WEBHOOK_SECRET`.

   **Webhook vs checkout verification:** After Checkout succeeds, the browser calls `POST /api/bookings/verify-payment` (HMAC using **`RAZORPAY_KEY_SECRET`**) so bookings confirm even if the webhook is delayed or misconfigured (e.g. local dev without a public URL). Webhooks remain a backup path. **`RAZORPAY_WEBHOOK_SECRET`** is only for verifying the webhook HTTP body signature; it is **not** the same value as **`RAZORPAY_KEY_SECRET`** (Razorpay API key secret from API keys).

6. **Admin user**

   Create the first admin in the `admin_users` table (bcrypt password hash):

   ```bash
   npm run create-admin -- you@example.com 'your-secure-password'
   ```

   Sign in at `/admin/login`. To change email or password later, use the **Admin account** section on `/admin` (current password required).

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

   - Build with **`npm run build`**, then run **`npm run start`**. This project uses standard Next.js production mode, so `npm run start` runs `next start`.
   - Deploy as a **Node** app running `npm run build` then `npm run start`, or use **[Vercel](https://vercel.com/)** (recommended for Next.js): import the GitHub repo, framework preset Next.js, Node **20+**.
   - In the host’s **Environment Variables** UI, copy every variable from your local `.env.local` (same names as [`.env.example`](.env.example)). The database is PostgreSQL via `DATABASE_URL` / `DB_*`. Use **production** Razorpay keys and webhook secret when you go live.
   - After pulling code changes, run **`npm run clean && npm run build`** (or delete `.next` manually) before **`npm run start`**. This removes old compiled chunks from previous deploys.

3. **URLs**

   - Set `NEXT_PUBLIC_APP_URL` to your public URL (e.g. `https://yourdomain.com`).
   - In Razorpay Dashboard → Webhooks, set the endpoint to `https://yourdomain.com/api/webhooks/razorpay` and the secret to match `RAZORPAY_WEBHOOK_SECRET`.

4. **Smoke test**

   - Open `/book`, complete a **test** payment, confirm the booking is **confirmed** in admin and notifications behave as expected.

## Project layout

- `src/app` – routes (home, book, admin)
- `src/app/api` – booking initiation, Razorpay webhook, admin APIs
- `db/migrations` – SQL schema and seed (Postgres)

## Scripts

| Command   | Description        |
| --------- | ------------------ |
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm run clean` | Delete `.next` (clears stale compiled output; stop `npm run dev` first on Windows if this errors with EBUSY) |
| `npm run rebuild` | `clean` then `build` |
| `npm run lint` | ESLint             |
| `npm run migrate` | Apply SQL migrations in `db/migrations` (tracked in `schema_migrations`; safe to re-run) |
