import React from "react";
import { cn } from "@/lib/utils";

interface LogoProps {
  variant?: "full" | "icon" | "responsive";
  className?: string;
  asLink?: boolean;
}

export const Logo: React.FC<LogoProps> = ({
  variant = "full",
  className,
  asLink = false,
}) => {
  const logoSrc = `${import.meta.env.BASE_URL}assets/images/bertcom-logo.png`;

  const fullLogo = (
    <span
      className={cn(
        "relative inline-flex h-16 w-56 items-center justify-center overflow-hidden",
        className
      )}
      aria-label="Bertcom Africa"
    >
      <img
        src={logoSrc}
        alt="Bertcom Africa"
        className="h-full w-full scale-[1.9] object-contain object-center"
      />
    </span>
  );

  const iconLogo = (
    <span
      className={cn(
        "relative inline-flex h-11 w-11 items-center justify-center overflow-hidden rounded-xl bg-white shadow-sm",
        className
      )}
      aria-label="Bertcom Africa"
    >
      <img
        src={logoSrc}
        alt="Bertcom Africa"
        className="h-full w-full scale-[2.7] object-contain object-left"
      />
    </span>
  );

  const content =
    variant === "icon"
      ? iconLogo
      : variant === "responsive"
        ? (
            <>
              <span className="hidden sm:inline-flex">{fullLogo}</span>
              <span className="inline-flex sm:hidden">{iconLogo}</span>
            </>
          )
        : fullLogo;

  if (!asLink) {
    return <div className="inline-flex items-center">{content}</div>;
  }

  return (
    <a
      href={import.meta.env.BASE_URL}
      className="inline-flex items-center"
      aria-label="Bertcom Africa home"
    >
      {content}
    </a>
  );
};

export default Logo;
