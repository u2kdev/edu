"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Play } from "lucide-react";
import { LandingLocale } from "../../types/landing";

interface VideoModalProps {
  isOpen: boolean;
  onClose: () => void;
  locale: LandingLocale;
}

export const VideoModal: React.FC<VideoModalProps> = ({ isOpen, onClose, locale }) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-slate-950/80 backdrop-blur-md"
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="relative w-full max-w-4xl rounded-3xl bg-[#0A1128] border border-blue-500/30 p-4 md:p-6 shadow-2xl z-10 overflow-hidden"
          >
            <div className="flex items-center justify-between pb-4 border-b border-white/10">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-blue-600/20 text-blue-400 flex items-center justify-center">
                  <Play className="w-4 h-4 fill-current" />
                </div>
                <h3 className="text-base font-semibold text-white">
                  {locale === "uz"
                    ? "e-darschi platformasi bo'yicha 2 daqiqalik video sharh"
                    : "Видеообзор возможностей платформы e-darschi"}
                </h3>
              </div>
              <button
                onClick={onClose}
                aria-label="Yopish"
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="relative mt-4 aspect-video rounded-2xl overflow-hidden bg-slate-900 border border-white/5 flex items-center justify-center">
              {/* Fallback video player or interactive demo canvas */}
              <video
                controls
                autoPlay
                className="w-full h-full object-cover"
                poster="/images/hero-poster.webp"
              >
                <source src="/videos/hero.mp4" type="video/mp4" />
                Your browser does not support video playback.
              </video>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
