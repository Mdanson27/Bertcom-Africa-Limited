import React, { useState } from "react";
import { Lock, Mail } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { Alert, AlertDescription } from "@/components/ui/Alert";
import { Logo } from "@/components/common/Logo";
import { useAuth } from "@/hooks/useAuth";
import { useCustomToast } from "@/hooks/useCustomToast";
import { ApiError } from "@/lib/api";

const GoogleMark = () => (
  <svg viewBox="0 0 24 24" className="h-4.5 w-4.5" aria-hidden="true">
    <path fill="#4285F4" d="M21.6 12.227c0-.709-.064-1.391-.182-2.045H12v3.868h5.382a4.6 4.6 0 0 1-1.995 3.018v2.509h3.227c1.89-1.741 2.986-4.305 2.986-7.35Z" />
    <path fill="#34A853" d="M12 22c2.7 0 4.964-.895 6.614-2.423l-3.227-2.509c-.895.6-2.041.955-3.387.955-2.605 0-4.809-1.759-5.595-4.123H3.07v2.591A9.997 9.997 0 0 0 12 22Z" />
    <path fill="#FBBC05" d="M6.405 13.9A6.017 6.017 0 0 1 6.09 12c0-.659.114-1.3.315-1.9V7.509H3.07A9.997 9.997 0 0 0 2 12c0 1.614.386 3.141 1.07 4.491L6.405 13.9Z" />
    <path fill="#EA4335" d="M12 5.977c1.468 0 2.786.504 3.823 1.491l2.864-2.864C16.959 2.995 14.695 2 12 2a9.997 9.997 0 0 0-8.93 5.509L6.405 10.1C7.191 7.736 9.395 5.977 12 5.977Z" />
  </svg>
);

export const LoginForm: React.FC = () => {
  const { login } = useAuth();
  const { showErrorToast, showWarningToast } = useCustomToast();

  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [isRateLimited, setIsRateLimited] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const validateEmail = (val: string): boolean => {
    if (!val.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val.trim())) {
      setEmailError("Enter a valid email address");
      return false;
    }
    setEmailError(null);
    return true;
  };

  const validatePassword = (val: string): boolean => {
    if (!val) {
      setPasswordError("Password is required");
      return false;
    }
    if (val.length < 8) {
      setPasswordError("Password must be at least 8 characters");
      return false;
    }
    setPasswordError(null);
    return true;
  };

  const clearServerError = () => {
    if (serverError) setServerError(null);
    setIsRateLimited(false);
  };

  const handleGoogleSignIn = () => {
    setServerError("Google sign-in will activate when the Bertcom Neon Auth project is connected.");
    setIsRateLimited(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError(null);
    setIsRateLimited(false);

    if (!validateEmail(email) || !validatePassword(password)) return;

    setIsLoading(true);
    try {
      await login(email.trim(), password);
    } catch (err: unknown) {
      let errorMsg = "Unable to sign in. Please try again.";
      let is429 = false;

      if (err instanceof ApiError) {
        errorMsg = err.message;
        is429 = err.status === 429;
      } else if (err instanceof Error && err.message) {
        errorMsg = err.message;
      } else if (typeof err === "string") {
        errorMsg = err;
      }

      setServerError(errorMsg);
      setIsRateLimited(is429);

      if (is429) showWarningToast(errorMsg, "Rate Limited");
      else showErrorToast(errorMsg, "Authentication Error");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full">
      <div className="mb-7 lg:hidden">
        <Logo variant="full" className="h-14 w-48" />
      </div>

      <div className="mb-7">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#DC1D2D]">
          Bertcom Africa
        </p>
        <h2 className="mt-2 text-3xl font-semibold tracking-[-0.035em] text-[#07233c] dark:text-white">
          Welcome back.
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Sign in to your workspace.
        </p>
      </div>

      {serverError && (
        <Alert variant={isRateLimited ? "warning" : "destructive"} className="mb-5">
          <AlertDescription>{serverError}</AlertDescription>
        </Alert>
      )}

      <Button
        type="button"
        variant="outline"
        onClick={handleGoogleSignIn}
        className="h-11 w-full gap-3 rounded-xl border-[#d8e0ea] bg-white text-[#17324a] shadow-sm hover:bg-[#f8fafc] dark:border-white/10 dark:bg-white/[0.04] dark:text-white dark:hover:bg-white/[0.08]"
      >
        <GoogleMark />
        Continue with Google
      </Button>

      <div className="my-6 flex items-center gap-3">
        <div className="h-px flex-1 bg-border" />
        <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
          or
        </span>
        <div className="h-px flex-1 bg-border" />
      </div>

      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <Input
          id="email"
          name="email"
          type="email"
          label="Email"
          placeholder="name@bertcomafrica.com"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            if (emailError) setEmailError(null);
            clearServerError();
          }}
          onBlur={() => email && validateEmail(email)}
          error={emailError ?? undefined}
          icon={<Mail className="h-4 w-4" />}
          autoComplete="username"
          required
        />

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label
              htmlFor="password"
              className={`block text-xs font-medium tracking-tight ${
                passwordError ? "text-destructive" : "text-foreground"
              }`}
            >
              Password
            </label>
            <button
              type="button"
              className="text-xs font-semibold text-[#022E55] transition hover:text-[#DC1D2D] dark:text-white/75 dark:hover:text-white"
              onClick={() => setServerError("Password reset will be enabled with Bertcom Neon Auth.")}
            >
              Forgot password?
            </button>
          </div>

          <PasswordInput
            id="password"
            name="password"
            placeholder="Enter your password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              if (passwordError) setPasswordError(null);
              clearServerError();
            }}
            onBlur={() => password && validatePassword(password)}
            error={passwordError ?? undefined}
            showLeftLock={true}
            autoComplete="current-password"
            required
          />
        </div>

        <Button
          type="submit"
          variant="primary"
          className="mt-2 h-11 w-full rounded-xl bg-[#022E55] font-semibold shadow-lg shadow-[#022E55]/10 hover:bg-[#063d6e] dark:bg-[#DC1D2D] dark:hover:bg-[#ef3040]"
          loading={isLoading}
        >
          Sign in
        </Button>
      </form>

      <div className="mt-7 flex items-center justify-center gap-2 text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
        <Lock className="h-3 w-3" />
        Secure Bertcom access
      </div>
    </div>
  );
};

export default LoginForm;
