import React from "react";
import { ArrowUpRight, BarChart3, BriefcaseBusiness, ShieldCheck, Sparkles } from "lucide-react";
import { Appearance } from "@/components/common/Appearance";
import { Logo } from "@/components/common/Logo";

interface AuthLayoutProps {
  children: React.ReactNode;
}

const capabilities = [
  {
    icon: BriefcaseBusiness,
    title: "Opportunity intelligence",
    text: "Move from discovered opportunities to qualified bids without losing momentum.",
  },
  {
    icon: BarChart3,
    title: "Executive visibility",
    text: "See bids, projects, delivery and performance from one operational command centre.",
  },
  {
    icon: ShieldCheck,
    title: "Controlled execution",
    text: "Role-based access, traceable decisions and structured workflows built for serious teams.",
  },
];

export const AuthLayout: React.FC<AuthLayoutProps> = ({ children }) => {
  const year = new Date().getFullYear();

  return (
    <main className="min-h-screen bg-[#f4f7fb] text-foreground dark:bg-[#06111c]">
      <div className="grid min-h-screen lg:grid-cols-[1.08fr_0.92fr]">
        <section className="relative hidden overflow-hidden bg-[#022E55] px-12 py-10 text-white lg:flex lg:flex-col lg:justify-between xl:px-16 xl:py-12">
          <div className="pointer-events-none absolute -left-32 top-24 h-80 w-80 rounded-full bg-[#DC1D2D]/20 blur-3xl" />
          <div className="pointer-events-none absolute -right-32 bottom-0 h-96 w-96 rounded-full bg-white/10 blur-3xl" />
          <div className="pointer-events-none absolute inset-0 opacity-[0.08] [background-image:linear-gradient(rgba(255,255,255,.35)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.35)_1px,transparent_1px)] [background-size:44px_44px]" />

          <div className="relative z-10">
            <div className="inline-flex rounded-2xl bg-white px-5 py-2.5 shadow-2xl shadow-black/10">
              <Logo variant="full" className="h-14 w-52" />
            </div>
          </div>

          <div className="relative z-10 max-w-2xl">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3.5 py-1.5 text-xs font-semibold tracking-[0.18em] text-white/85 uppercase backdrop-blur">
              <Sparkles className="h-3.5 w-3.5 text-[#ff6672]" />
              Bertcom Africa Business OS
            </div>

            <h1 className="max-w-xl text-4xl font-semibold leading-[1.08] tracking-[-0.035em] xl:text-5xl">
              One operating system for every opportunity, project and decision.
            </h1>
            <p className="mt-5 max-w-xl text-base leading-7 text-white/70">
              Built for Bertcom Africa to turn business development, tender intelligence and delivery
              into one fast, accountable operating flow.
            </p>

            <div className="mt-9 grid gap-3">
              {capabilities.map(({ icon: Icon, title, text }) => (
                <div
                  key={title}
                  className="group flex items-start gap-4 rounded-2xl border border-white/12 bg-white/[0.07] p-4 backdrop-blur-sm transition hover:bg-white/[0.11]"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#DC1D2D] shadow-lg shadow-black/10">
                    <Icon className="h-4.5 w-4.5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 text-sm font-semibold">
                      {title}
                      <ArrowUpRight className="h-3.5 w-3.5 opacity-0 transition group-hover:opacity-70" />
                    </div>
                    <p className="mt-1 text-sm leading-6 text-white/60">{text}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="relative z-10 flex items-center justify-between border-t border-white/10 pt-6 text-[11px] text-white/45">
            <span>© {year} Bertcom Africa Ltd</span>
            <span>Technology partner · AutoMinds Africa</span>
          </div>
        </section>

        <section className="relative flex min-h-screen flex-col bg-white dark:bg-[#091725]">
          <div className="absolute right-6 top-6 z-20 md:right-10 md:top-8">
            <Appearance />
          </div>

          <div className="flex flex-1 items-center justify-center px-5 py-16 sm:px-8 md:px-12">
            <div className="w-full max-w-[460px]">{children}</div>
          </div>

          <div className="px-6 pb-7 text-center text-[11px] text-muted-foreground lg:hidden">
            © {year} Bertcom Africa Ltd · Powered by AutoMinds Africa
          </div>
        </section>
      </div>
    </main>
  );
};

export default AuthLayout;
