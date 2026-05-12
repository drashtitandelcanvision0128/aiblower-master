import Link from "next/link";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-emerald-700/25 bg-[#05100d]/95 backdrop-blur">
      <div className="mx-auto flex h-[58px] w-full max-w-[1200px] items-center justify-between px-4 sm:px-6">
        <Link href="/" className="text-[20px] leading-none font-semibold tracking-tight text-emerald-400">
          AIbowler
        </Link>
        <nav className="hidden items-center gap-8 text-[15px] font-medium text-emerald-100/70 md:flex">
          <Link href="/" className="border-b-2 border-emerald-400 pb-1 text-emerald-300">
            Features
          </Link>
          <Link href="/" className="hover:text-white">
            Centers
          </Link>
          <Link href="/book" className="hover:text-white">
            Bookings
          </Link>
          <Link href="/admin/login" className="hover:text-white">
            Profile
          </Link>
        </nav>
        <div className="flex items-center gap-3">
          <div className="hidden items-center gap-2 text-emerald-100/70 sm:flex">
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-emerald-700/60 text-[10px]">
              B
            </span>
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-emerald-700/60 text-[10px]">
              H
            </span>
          </div>
          <Link
            href="/book"
            className="rounded-xl bg-emerald-400 px-5 py-2 text-sm font-semibold text-emerald-950 transition hover:bg-emerald-300"
          >
            Book Now
          </Link>
          <Link
            href="/admin/login"
            className="h-8 w-8 rounded-full border border-emerald-700/60 bg-[radial-gradient(circle_at_30%_20%,_#d4d4d4,_#3b3b3b_70%)]"
            aria-label="Admin login"
          >
            <span className="sr-only">Admin login</span>
          </Link>
        </div>
      </div>
    </header>
  );
}
