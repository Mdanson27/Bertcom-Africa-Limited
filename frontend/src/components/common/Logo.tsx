import React from "react";
import { cn } from "@/lib/utils";

interface LogoProps {
  variant?: "full" | "icon" | "responsive";
  className?: string;
  imageClassName?: string;
  asLink?: boolean;
}

export const Logo: React.FC<LogoProps> = ({
  variant = "full",
  className,
  imageClassName,
  asLink = false,
}) => {
  const logoSrc = `${import.meta.env.BASE_URL}assets/images/bertcom-logo.png`;

  const sizeClass =
    variant === "icon"
      ? "h-12 w-12"
      : variant === "responsive"
        ? "h-14 w-14 sm:h-16 sm:w-16"
        : "h-16 w-16";

  const content = (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center",
        sizeClass,
        className,
      )}
      aria-label="Bertcom Africa"
    >
      <img
        src={logoSrc}
        alt="Bertcom Africa"
        className={cn("block h-full w-full object-contain object-center", imageClassName)}
        draggable={false}
      />
    </span>
  );

  if (!asLink) return content;

  return (
    <a
      href={import.meta.env.BASE_URL}
      className="inline-flex items-center justify-center"
      aria-label="Bertcom Africa home"
    >
      {content}
    </a>
  );
};

export default Logo;
