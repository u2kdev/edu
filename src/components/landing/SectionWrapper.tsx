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
      initial={shouldReduceMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 28 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{
        duration: shouldReduceMotion ? 0.1 : 0.65,
        delay,
        ease: [0.16, 1, 0.3, 1],
      }}
      className={`relative scroll-mt-24 ${className}`}
    >
      {children}
    </motion.section>
  );
};
