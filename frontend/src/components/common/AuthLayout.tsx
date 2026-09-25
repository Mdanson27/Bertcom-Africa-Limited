import React from "react";
import { Appearance } from "@/components/common/Appearance";
import { Logo } from "@/components/common/Logo";

interface AuthLayoutProps {
  children: React.ReactNode;
}

const AccentChip: React.FC<{ label: string }> = ({ label }) => (
  <span className="rounded-full border border-white/14 bg-white/[0.08] px-4 py-2 text-[11px] font-medium tracking-[0.08em] text-white/80 backdrop-blur-sm">
    {label}
  </span>
);

export const AuthLayout: React.FC<AuthLayoutProps> = ({ children }) => {
  const year = new Date().getFullYear();

  return (
    <main className="min-h-screen bg-[#f4f7fb] text-foreground dark:bg-[#06111c]">
      <div className="grid min-h-screen lg:grid-cols-[1.06fr_0.94fr]">
        <section className="relative hidden overflow-hidden bg-[#022E55] px-12 py-10 text-white lg:flex lg:flex-col lg:justify-between xl:px-16 xl:py-12">
          <div className="pointer-events-none absolute inset-0 opacity-[0.055] [background-image:linear-gradient(rgba(255,255,255,.34)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.34)_1px,transparent_1px)] [background-size:52px_52px]" />
          <div className="pointer-events-none absolute -left-28 top-24 h-80 w-80 rounded-full bg-[#DC1D2D]/20 blur-3xl" />
          <div className="pointer-events-none absolute right-[-120px] top-[18%] h-96 w-96 rounded-full bg-[#3e8bc5]/20 blur-3xl" />
          <div className="pointer-events-none absolute bottom-[-120px] left-[20%] h-80 w-80 rounded-full bg-white/[0.07] blur-3xl" />
          <div className="pointer-events-none absolute right-[-80px] top-[31%] h-[360px] w-[360px] rounded-full border border-white/10" />
          <div className="pointer-events-none absolute right-[-25px] top-[36%] h-[240px] w-[240px] rounded-full border border-white/[0.08]" />

          <div className="relative z-10">
            <div className="inline-flex rounded-[26px] bg-white px-7 py-4 shadow-[0_22px_70px_rgba(0,0,0,0.18)]">
              <Logo variant="full" className="h-14 w-52" />
            </div>
          </div>

          <div className="relative z-10 max-w-3xl">
            <div className="mb-7 flex items-center gap-3">
              <span className="h-2 w-2 rounded-full bg-[#DC1D2D] shadow-[0_0_0_5px_rgba(220,29,45,0.15)]" />
              <p className="text-[11px] font-semibold uppercase tracking-[0.23em] text-white/62">
                Bertcom Africa Business OS
              </p>
            </div>

            <div className="relative mb-5 inline-block">
              <span className="bertcom-brand-word relative z-10 block text-[clamp(72px,8.5vw,132px)] font-semibold leading-[0.82] tracking-[-0.075em] text-white">
                BERTCOM
              </span>
              <span className="bertcom-brand-ribbon absolute -inset-x-4 bottom-[4%] z-0 h-[34%] rounded-full blur-[10px]" />
            </div>

            <h1 className="max-w-3xl text-[clamp(48px,5.5vw,84px)] font-semibold leading-[0.96] tracking-[-0.055em] text-white">
              Opportunity to delivery.
              <span className="block text-white/92">One workspace.</span>
            </h1>

            <p className="mt-6 max-w-2xl text-[19px] leading-8 text-white/72">
              Bids, projects and operations — connected for faster execution.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <AccentChip label="Bid intelligence" />
              <AccentChip label="Project control" />
              <AccentChip label="Operational visibility" />
            </div>
          </div>

          <div className="relative z-10 flex items-center justify-between border-t border-white/10 pt-6 text-[11px] text-white/45">
            <span>© {year} Bertcom Africa Ltd</span>
            <span>Technology by AutoMinds Africa</span>
          </div>
        </section>

        <section className="relative flex min-h-screen flex-col overflow-hidden bg-[#f8fafc] dark:bg-[#091725]">
          <div className="pointer-events-none absolute right-[-70px] top-[10%] h-64 w-64 rounded-full bg-[#DC1D2D]/[0.055] blur-3xl" />
          <div className="pointer-events-none absolute bottom-[4%] left-[-60px] h-64 w-64 rounded-full bg-[#022E55]/[0.065] blur-3xl" />

          <div className="absolute right-6 top-6 z-20 md:right-10 md:top-8">
            <Appearance />
          </div>

          <div className="relative z-10 flex flex-1 items-center justify-center px-5 py-16 sm:px-8 md:px-12">
            <div className="w-full max-w-[510px] rounded-[34px] border border-[#d9e3ed] bg-white/94 p-7 shadow-[0_24px_90px_rgba(2,46,85,0.10)] backdrop-blur-xl sm:p-9 dark:border-white/10 dark:bg-white/[0.04]">
              {children}
            </div>
          </div>

          <div className="relative z-10 px-6 pb-7 text-center text-[11px] text-muted-foreground lg:hidden">
            © {year} Bertcom Africa Ltd · AutoMinds Africa
          </div>
        </section>
      </div>
    </main>
  );
};

export default AuthLayout;
