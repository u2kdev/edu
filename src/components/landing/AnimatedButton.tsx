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
    sm: "px-3.5 py-1.5 text-xs rounded-xl",
    md: "px-5 py-2.5 text-sm rounded-xl",
    lg: "px-7 py-3.5 text-base rounded-2xl font-semibold",
  }[size];

  const variantClasses = {
    primary:
      "bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-500/20 dark:bg-blue-600 dark:hover:bg-blue-500",
    gradient:
      "bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 hover:from-blue-500 hover:to-indigo-600 text-white shadow-lg shadow-blue-600/30",
    secondary:
      "bg-[#F4F8FF] hover:bg-blue-100/70 text-blue-900 dark:bg-[#13224D] dark:hover:bg-[#1C326E] dark:text-blue-200 border border-blue-200/50 dark:border-white/10",
    outline:
      "bg-transparent border border-blue-600/40 hover:border-blue-600 text-blue-600 dark:text-blue-400 dark:border-blue-400/40 dark:hover:border-blue-400 hover:bg-blue-50/50 dark:hover:bg-blue-950/30",
  }[variant];

  const glowEffect = glow && !shouldReduceMotion ? "animate-pulse-slow shadow-glow-blue" : "";

  const motionProps = shouldReduceMotion
    ? {}
    : {
        whileHover: { scale: 1.04 },
        whileTap: { scale: 0.97 },
        transition: { type: "spring", stiffness: 400, damping: 25 },
      };

  const content = (
    <span className="relative z-10 flex items-center justify-center gap-2">
      {children}
    </span>
  );

  const combinedClasses = `relative overflow-hidden inline-flex items-center justify-center font-medium transition-colors select-none focus:outline-none focus:ring-2 focus:ring-blue-500/50 ${sizeClasses} ${variantClasses} ${glowEffect} ${className} ${
    disabled ? "opacity-60 cursor-not-allowed pointer-events-none" : "cursor-pointer"
  }`;

  if (href) {
    return (
      <motion.div {...motionProps} className="inline-block">
        <Link href={href} onClick={onClick} className={combinedClasses}>
          {content}
          {/* Shine beam on hover */}
          <span
            className="absolute inset-0 w-1/2 h-full bg-white/20 skew-x-12 -translate-x-full group-hover:translate-x-[300%] transition-transform duration-1000 pointer-events-none"
            aria-hidden="true"
          />
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
      <span
        className="absolute inset-0 w-1/2 h-full bg-white/20 skew-x-12 -translate-x-full hover:translate-x-[300%] transition-transform duration-1000 pointer-events-none"
        aria-hidden="true"
      />
    </motion.button>
  );
};
