"use client";

import React from "react";
import { motion, useReducedMotion } from "framer-motion";
import Link from "next/link";

interface AnimatedButtonProps {
  children: React.ReactNode;
  href?: string;
  onClick?: () => void;
  variant?: "primary" | "secondary" | "outline" | "gradient";
  size?: "sm" | "md" | "lg";
  className?: string;
  glow?: boolean;
  type?: "button" | "submit" | "reset";
  disabled?: boolean;
}

export const AnimatedButton: React.FC<AnimatedButtonProps> = ({
  children,
  href,
  onClick,
  variant = "primary",
  size = "md",
  className = "",
  glow = false,
  type = "button",
  disabled = false,
}) => {
  const shouldReduceMotion = useReducedMotion();

  const sizeClasses = {
    sm: "px-3.5 py-2 text-xs rounded-xl",
    md: "px-5 py-2.5 text-sm rounded-xl",
    lg: "px-7 py-3.5 text-sm sm:text-base rounded-2xl font-semibold",
  }[size];

  const variantClasses = {
    primary:
      "bg-[color:var(--brand-solid)] text-white shadow-[0_10px_26px_-12px_rgba(29,78,216,0.65)] hover:bg-[color:var(--brand-strong)]",
    gradient:
      "bg-gradient-to-br from-blue-700 to-[#172554] text-white shadow-[0_14px_34px_-14px_rgba(29,78,216,0.75)] hover:from-blue-600 hover:to-[#1e3a8a]",
    secondary:
      "bg-[color:var(--paper-2)] text-ink border border-[color:var(--line-strong)] hover:border-[color:var(--brand-a40)] hover:bg-[color:var(--surface)]",
    outline:
      "bg-transparent text-ink-soft border border-[color:var(--line-strong)] hover:border-[color:var(--brand-a50)] hover:text-ink hover:bg-[color:var(--surface)]",
  }[variant];

  const glowEffect = glow && !shouldReduceMotion ? "shadow-glow-blue" : "";

  const motionProps = shouldReduceMotion
    ? {}
    : {
        whileHover: { scale: 1.025 },
        whileTap: { scale: 0.97 },
        transition: { type: "spring" as const, stiffness: 420, damping: 26 },
      };

  const combinedClasses = `group relative inline-flex select-none items-center justify-center overflow-hidden font-semibold transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-a50)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--surface)] ${sizeClasses} ${variantClasses} ${glowEffect} ${className} ${
    disabled ? "pointer-events-none opacity-60" : "cursor-pointer"
  }`;

  const content = (
    <>
      <span className="relative z-10 flex items-center justify-center gap-2">{children}</span>
      {!disabled && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 -left-1/3 z-0 w-1/3 -translate-x-full skew-x-12 bg-white/20 transition-transform duration-700 ease-out group-hover:translate-x-[420%]"
        />
      )}
    </>
  );

  if (href) {
    return (
      <motion.div {...motionProps} className="inline-block">
        <Link href={href} onClick={onClick} className={combinedClasses}>
          {content}
        </Link>
      </motion.div>
    );
  }

  return (
    <motion.button
      {...motionProps}
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={combinedClasses}
    >
      {content}
    </motion.button>
  );
};
