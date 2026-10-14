"use client";

import React from "react";
import { motion, useReducedMotion } from "framer-motion";

interface SectionWrapperProps {
  children: React.ReactNode;
  id?: string;
  className?: string;
  delay?: number;
}

export const SectionWrapper: React.FC<SectionWrapperProps> = ({
  children,
  id,
  className = "",
  delay = 0,
}) => {
  const shouldReduceMotion = useReducedMotion();

  return (
    <motion.section
      id={id}
      initial={shouldReduceMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 32 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{
        duration: shouldReduceMotion ? 0.1 : 0.85,
        delay,
        ease: [0.22, 1, 0.36, 1], // easeOut
      }}
      className={`relative scroll-mt-24 ${className}`}
    >
      {children}
    </motion.section>
  );
};
