"use client";

import React, { useState } from "react";
import { LandingLocale } from "../../types/landing";
import { ThemeProvider } from "./ThemeProvider";
import { Header } from "./Header";
import { Hero } from "./Hero";
import { Features } from "./Features";
import { AppsSection } from "./AppsSection";
import { Pricing } from "./Pricing";
import { Steps } from "./Steps";
import { FAQ } from "./FAQ";
import { CTA } from "./CTA";
import { Footer } from "./Footer";
import { LeadModal } from "./LeadModal";

interface LandingViewProps {
  locale: LandingLocale;
}

export const LandingView: React.FC<LandingViewProps> = ({ locale }) => {
  const [isLeadModalOpen, setIsLeadModalOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<string | undefined>(undefined);

  const handleOpenLead = (planId?: string) => {
    setSelectedPlan(planId);
    setIsLeadModalOpen(true);
  };

  return (
    <ThemeProvider>
      <div className="min-h-screen bg-slate-50 text-slate-900 selection:bg-blue-600 selection:text-white transition-colors duration-300 font-strict particles-bg relative overflow-x-hidden">
        {/* Ambient Top Mesh Glows */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[550px] bg-gradient-to-b from-blue-400/15 via-indigo-300/10 to-transparent blur-[140px] pointer-events-none -z-10" />
        <div className="absolute top-[800px] -right-32 w-[600px] h-[600px] bg-gradient-to-bl from-teal-400/10 via-blue-400/10 to-transparent blur-[140px] pointer-events-none -z-10" />
        <div className="absolute top-[2200px] -left-32 w-[600px] h-[600px] bg-gradient-to-tr from-indigo-400/10 via-purple-300/10 to-transparent blur-[140px] pointer-events-none -z-10" />

        <Header
          locale={locale}
          onOpenLeadModal={() => handleOpenLead()}
        />

        <main id="imkoniyatlar">
          <Hero
            locale={locale}
            onOpenLeadModal={() => handleOpenLead()}
          />

          <Features locale={locale} />

          <AppsSection locale={locale} />

          <Pricing
            locale={locale}
            onSelectPlan={(planId) => handleOpenLead(planId)}
          />

          <Steps
            locale={locale}
            onOpenLeadModal={() => handleOpenLead()}
          />

          <FAQ locale={locale} />

          <CTA locale={locale} />
        </main>

        <Footer locale={locale} />

        <LeadModal
          isOpen={isLeadModalOpen}
          onClose={() => setIsLeadModalOpen(false)}
          locale={locale}
          selectedPlan={selectedPlan}
        />
      </div>
    </ThemeProvider>
  );
};
