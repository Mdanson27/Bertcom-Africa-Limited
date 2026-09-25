import React from "react";
import { ShieldCheck } from "lucide-react";

export type MascotMode = "idle" | "email" | "password";

interface LoginMascotProps {
  mode: MascotMode;
  email: string;
}

function getMessage(mode: MascotMode, email: string): string {
  if (mode === "password") return "Password privacy on.";

  if (mode === "email") {
    if (!email.trim()) return "Use your Bertcom work email.";
    if (!email.includes("@")) return "Keep going — add the full address.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return "Almost there.";
    return "Email looks good.";
  }

  return "Secure workspace access.";
}

export const LoginMascot: React.FC<LoginMascotProps> = ({ mode, email }) => {
  const eyesClosed = mode === "password";
  const emailMode = mode === "email";

  return (
    <div className="mb-7 flex items-center gap-4 rounded-3xl border border-[#dbe4ee] bg-white/92 p-4 shadow-[0_20px_70px_rgba(2,46,85,0.08)] backdrop-blur dark:border-white/10 dark:bg-white/[0.04]">
      <div className="relative shrink-0">
        <div className="bertcom-mascot-float relative flex h-[86px] w-[86px] items-center justify-center rounded-[28px] bg-[linear-gradient(145deg,#022E55_0%,#0c4f83_58%,#DC1D2D_100%)] shadow-[0_20px_45px_rgba(2,46,85,0.25)]">
          <div className="relative flex h-[58px] w-[58px] items-center justify-center rounded-[20px] border border-white/65 bg-white shadow-inner">
            <div className="absolute -top-2 h-3 w-8 rounded-full bg-[#DC1D2D] shadow-sm" />

            <div className="absolute top-[20px] flex items-center gap-[11px]">
              {eyesClosed ? (
                <>
                  <span className="h-[2px] w-[11px] rounded-full bg-[#022E55]" />
                  <span className="h-[2px] w-[11px] rounded-full bg-[#022E55]" />
                </>
              ) : (
                <>
                  <span
                    className={`relative h-[11px] w-[11px] rounded-full bg-[#022E55] transition-transform duration-300 ${emailMode ? "translate-x-[2px]" : ""}`}
                  >
                    <span className="absolute right-[2px] top-[2px] h-[3px] w-[3px] rounded-full bg-white" />
                  </span>
                  <span
                    className={`relative h-[11px] w-[11px] rounded-full bg-[#022E55] transition-transform duration-300 ${emailMode ? "translate-x-[2px]" : ""}`}
                  >
                    <span className="absolute right-[2px] top-[2px] h-[3px] w-[3px] rounded-full bg-white" />
                  </span>
                </>
              )}
            </div>

            <div className="absolute bottom-[13px] h-[6px] w-[22px] rounded-b-full border-b-2 border-[#DC1D2D]" />
          </div>

          <div className="absolute -right-1 -top-1 flex h-7 w-7 items-center justify-center rounded-full border-2 border-white bg-[#DC1D2D] text-white shadow-lg">
            <ShieldCheck className="h-3.5 w-3.5" />
          </div>
        </div>

        <div className="absolute -bottom-2 left-1/2 h-3 w-14 -translate-x-1/2 rounded-full bg-[#022E55]/15 blur-md" />
      </div>

      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#DC1D2D]">
          Bertcom Assistant
        </p>
        <p className="mt-1 text-sm font-semibold text-[#0b2c49] dark:text-white">
          {getMessage(mode, email)}
        </p>
        <p className="mt-1 text-[11px] leading-5 text-muted-foreground">
          {mode === "password"
            ? "I’ll look away while you type."
            : mode === "email"
              ? "Your workspace details stay private."
              : "Ready when you are."}
        </p>
      </div>
    </div>
  );
};

export default LoginMascot;
