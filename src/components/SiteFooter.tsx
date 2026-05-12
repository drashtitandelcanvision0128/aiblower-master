export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-emerald-900/30 bg-[#2f3733] px-4 py-12 text-emerald-100/70 sm:px-6">
      <div className="mx-auto w-full max-w-[1200px]">
        <div className="flex flex-col justify-between gap-10 pb-8 md:flex-row md:items-start">
          <div className="max-w-sm">
            <p className="text-[39px] font-semibold tracking-tight text-emerald-400">AIbowler</p>
            <p className="mt-3 text-[18px] leading-relaxed text-emerald-100/60">
              Redefining cricket training with our state of art technology.
            </p>
          </div>
          <nav className="flex flex-wrap gap-x-10 gap-y-2 pt-3 text-[14px] font-medium tracking-wide text-emerald-50/70">
            <a href="#" className="hover:text-white">
              Privacy Policy
            </a>
            <a href="#" className="hover:text-white">
              Terms of Service
            </a>
            <a href="#" className="hover:text-white">
              Partner with Us
            </a>
            <a href="#" className="hover:text-white">
              Contact
            </a>
          </nav>
        </div>
        <div className="pt-8 text-center">
          <p className="text-[14px] tracking-wide text-emerald-50/50">
            © {new Date().getFullYear()} AIbowler Technologies. Engineered for performance.
          </p>
          <div className="mt-5 flex items-center justify-center gap-5 text-emerald-400/80">
            <span className="text-xl">◍</span>
            <span className="text-xl">▤</span>
            <span className="text-xl">@</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
