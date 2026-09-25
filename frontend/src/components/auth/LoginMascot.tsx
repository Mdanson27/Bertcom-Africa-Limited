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

  return "Ready when you are.";
}

function getSupportText(mode: MascotMode): string {
  if (mode === "password") return "I’ll look away while you type.";
  if (mode === "email") return "Your workspace details stay private.";
  return "Secure access to your Bertcom workspace.";
}

export const LoginMascot: React.FC<LoginMascotProps> = ({ mode, email }) => {
  const eyesClosed = mode === "password";
  const emailMode = mode === "email";

  return (
    <div className="mb-7 flex flex-col items-center text-center">
      <div className="relative">
        <div className="bertcom-mascot-float relative flex h-[108px] w-[108px] items-center justify-center rounded-full border border-[#dce5ee] bg-white shadow-[0_20px_55px_rgba(2,46,85,0.13)] dark:border-white/10 dark:bg-[#0b1f31]">
          <div className="absolute inset-[8px] rounded-full bg-[radial-gradient(circle_at_35%_25%,#ffffff_0%,#f7fbff_46%,#edf4fb_100%)] dark:bg-[radial-gradient(circle_at_35%_25%,#16334d_0%,#0c2134_55%,#081725_100%)]" />

          <div className="relative flex h-[72px] w-[72px] items-center justify-center rounded-full bg-[#022E55] shadow-[inset_0_0_0_2px_rgba(255,255,255,0.08)]">
            <div className="relative flex h-[56px] w-[56px] items-center justify-center rounded-full bg-white dark:bg-[#f6f9fc]">
              <div className="absolute -top-[4px] h-[10px] w-[28px] rounded-full bg-[#DC1D2D]" />

              <div className="absolute top-[18px] flex items-center gap-[10px]">
                {eyesClosed ? (
                  <>
                    <span className="h-[2px] w-[12px] rounded-full bg-[#022E55]" />
                    <span className="h-[2px] w-[12px] rounded-full bg-[#022E55]" />
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

              <div className="absolute bottom-[11px] h-[9px] w-[25px] rounded-b-full border-b-[3px] border-[#DC1D2D]" />
            </div>
          </div>

          <div className="absolute right-[4px] top-[7px] flex h-8 w-8 items-center justify-center rounded-full border-[3px] border-white bg-[#DC1D2D] text-white shadow-lg dark:border-[#0b1f31]">
            <ShieldCheck className="h-4 w-4" />
          </div>
        </div>

        <div className="absolute -bottom-3 left-1/2 h-3 w-16 -translate-x-1/2 rounded-full bg-[#022E55]/15 blur-md" />
      </div>

      <p className="mt-5 text-sm font-semibold text-[#0b2c49] dark:text-white">
        {getMessage(mode, email)}
      </p>
      <p className="mt-1 max-w-[280px] text-[11px] leading-5 text-muted-foreground">
        {getSupportText(mode)}
      </p>
    </div>
  );
};

export default LoginMascot;
