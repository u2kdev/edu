"use client";

import React from "react";
import { Sun, Moon } from "lucide-react";
import { useTheme } from "./ThemeProvider";

interface ThemeToggleProps {
  className?: string;
}

export const ThemeToggle: React.FC<ThemeToggleProps> = ({ className = "" }) => {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={theme === "dark" ? "Yorug' mavzuga o'tish" : "Qorong'i mavzuga o'tish"}
      className={`relative inline-flex items-center justify-center w-9 h-9 rounded-xl transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-blue-500/50 ${
        theme === "dark"
          ? "bg-[#13224D] text-amber-300 hover:bg-[#1C326E] border border-white/10"
          : "bg-blue-50 text-amber-600 hover:bg-blue-100 border border-blue-200/60"
      } ${className}`}
    >
      <span className="sr-only">Toggle theme</span>
      {theme === "dark" ? (
        <Sun className="w-4 h-4 transition-transform duration-300 rotate-0 hover:rotate-45" />
      ) : (
        <Moon className="w-4 h-4 transition-transform duration-300 -rotate-12 hover:rotate-0" />
      )}
    </button>
  );
};
