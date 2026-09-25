import React from "react";
import { Appearance } from "@/components/common/Appearance";
import { Logo } from "@/components/common/Logo";

interface AuthLayoutProps {
  children: React.ReactNode;
}

const BertcomMascot: React.FC = () => (
  <div
    className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/15 bg-white/10 backdrop-blur"
    aria-label="Bertcom assistant mark"
    title="Bertcom OS"
  >
    <svg viewBox="0 0 40 40" className="h-6 w-6" aria-hidden="true">
      <rect x="7" y="9" width="26" height="22" rx="8" fill="#ffffff" opacity="0.98" />
      <rect x="10" y="5" width="12" height="5" rx="2.5" fill="#DC1D2D" />
      <circle cx="15.5" cy="20" r="2" fill="#022E55" />
      <circle cx="24.5" cy="20" r="2" fill="#022E55" />
      <path d="M15 25c2.8 2 7.2 2 10 0" fill="none" stroke="#022E55" strokeWidth="2" strokeLinecap="round" />
    </svg>
  </div>
);

export const AuthLayout: React.FC<AuthLayoutProps> = ({ children }) => {
  const year = new Date().getFullYear();

  return (
    <main className="min-h-screen bg-[#f5f7fa] text-foreground dark:bg-[#06111c]">
      <div className="grid min-h-screen lg:grid-cols-[1.02fr_0.98fr]">
        <section className="relative hidden overflow-hidden bg-[#022E55] px-12 py-10 text-white lg:flex lg:flex-col lg:justify-between xl:px-16 xl:py-12">
          <div className="pointer-events-none absolute -left-40 top-28 h-96 w-96 rounded-full bg-[#DC1D2D]/16 blur-3xl" />
          <div className="pointer-events-none absolute inset-0 opacity-[0.055] [background-image:linear-gradient(rgba(255,255,255,.28)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.28)_1px,transparent_1px)] [background-size:48px_48px]" />

          <div className="relative z-10">
            <div className="inline-flex rounded-2xl bg-white px-5 py-2.5 shadow-2xl shadow-black/10">
              <Logo variant="full" className="h-14 w-52" />
            </div>
          </div>

          <div className="relative z-10 max-w-xl">
            <div className="mb-6 flex items-center gap-3">
              <BertcomMascot />
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/60">Bertcom OS</p>
                <p className="mt-0.5 text-sm font-medium text-white/90">Business operations workspace</p>
              </div>
            </div>

            <h1 className="max-w-lg text-4xl font-semibold leading-[1.08] tracking-[-0.035em] xl:text-5xl">
              Opportunity to delivery.
              <span className="block text-white/72">One workspace.</span>
            </h1>

            <p className="mt-5 max-w-lg text-base leading-7 text-white/68">
              Bids, projects and operations — connected for faster execution.
            </p>
          </div>

          <div className="relative z-10 flex items-center justify-between border-t border-white/10 pt-6 text-[11px] text-white/45">
            <span>© {year} Bertcom Africa Ltd</span>
            <span>Technology by AutoMinds Africa</span>
          </div>
        </section>

        <section className="relative flex min-h-screen flex-col bg-white dark:bg-[#091725]">
          <div className="absolute right-6 top-6 z-20 md:right-10 md:top-8">
            <Appearance />
          </div>

          <div className="flex flex-1 items-center justify-center px-5 py-16 sm:px-8 md:px-12">
            <div className="w-full max-w-[440px]">{children}</div>
          </div>

          <div className="px-6 pb-7 text-center text-[11px] text-muted-foreground lg:hidden">
            © {year} Bertcom Africa Ltd · AutoMinds Africa
          </div>
        </section>
      </div>
    </main>
  );
};

export default AuthLayout;
