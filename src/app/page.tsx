import Image from "next/image";
import Link from "next/link";

export default function Home() {
  return (
    <main className="relative overflow-hidden bg-[#041911]">
      <section className="relative mx-auto min-h-[730px] w-full max-w-[1200px] px-4 pb-14 pt-20 sm:px-6">
        <Image
          src="/hero-bg.png"
          alt="AIbowler hero"
          fill
          priority
          className="rounded-b-sm object-cover object-center opacity-70"
        />
        <div
          className="pointer-events-none absolute inset-0 rounded-b-sm"
          aria-hidden
          style={{
            background:
              "radial-gradient(circle at 82% 14%, rgba(220, 255, 248, 0.5), rgba(220, 255, 248, 0) 24%), linear-gradient(90deg, rgba(2, 12, 9, 0.9) 18%, rgba(2, 12, 9, 0.55) 45%, rgba(2, 12, 9, 0.2) 72%), linear-gradient(0deg, rgba(1, 8, 6, 0.45) 0%, rgba(1, 8, 6, 0.1) 40%, rgba(1, 8, 6, 0.22) 100%)",
          }}
        />
        <div className="pointer-events-none absolute inset-0 rounded-b-sm border border-emerald-100/10" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-[#03150f] to-transparent" />

        <div className="relative z-10 max-w-[640px] pt-14">
          <p className="inline-flex rounded-full border border-emerald-400/30 bg-emerald-500/10 px-4 py-1 text-[11px] font-semibold tracking-[0.2em] text-emerald-300">
            PREMIUM AI PERFORMANCE
          </p>
          <h1 className="mt-8 text-[58px] font-medium leading-[1.02] tracking-tight text-white sm:text-[64px]">
            Level Up Your Game
            <br />
            <span className="text-emerald-400">with AI</span>
          </h1>
          <p className="mt-6 max-w-[640px] text-[17px] leading-[1.6] text-emerald-100/75">
            Engineered with precision robotics and real-time biometric analysis to transform every session into a data-driven
            masterclass.
          </p>
          <div className="mt-12 flex flex-wrap gap-4">
            <Link
              href="/book"
              className="inline-flex min-w-[310px] items-center justify-center rounded-2xl bg-emerald-400 px-8 py-4 text-[16px] font-semibold text-emerald-950 transition hover:bg-emerald-300"
            >
              Book Your Session
            </Link>
            <button
              type="button"
              className="inline-flex min-w-[260px] items-center justify-center gap-3 rounded-2xl border border-emerald-100/45 bg-emerald-950/35 px-8 py-4 text-[16px] font-semibold text-emerald-50 backdrop-blur-sm transition hover:bg-emerald-950/55"
            >
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-emerald-100/50 text-xs">
                ▶
              </span>
              See it in Action
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}
