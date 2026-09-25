import React from "react";

export const Footer: React.FC = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-t border-border py-4 px-6">
      <div className="flex flex-col items-center justify-between gap-3 sm:flex-row text-xs text-muted-foreground">
        <p>© {currentYear} Bertcom Africa Ltd</p>
        <p className="text-[11px]">Business OS · Technology by AutoMinds Africa</p>
      </div>
    </footer>
  );
};

export default Footer;
