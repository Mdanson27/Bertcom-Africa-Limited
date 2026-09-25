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
        "relative inline-block h-12 w-[166px] overflow-hidden rounded-md bg-white",
        className
      )}
      aria-label="Bertcom Africa"
    >
      <img
        src={logoSrc}
        alt="Bertcom Africa"
        className="pointer-events-none absolute max-w-none select-none"
        style={{ width: 250, left: -38, top: -102 }}
      />
    </span>
  );

  const iconLogo = (
    <span
      className={cn(
        "relative inline-block h-10 w-10 overflow-hidden rounded-md bg-white",
        className
      )}
      aria-label="Bertcom Africa"
    >
      <img
        src={logoSrc}
        alt="Bertcom Africa"
        className="pointer-events-none absolute max-w-none select-none"
        style={{ width: 250, left: -38, top: -109 }}
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
    <a href={import.meta.env.BASE_URL} className="inline-flex items-center" aria-label="Bertcom Africa home">
      {content}
    </a>
  );
};

export default Logo;
