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
      <div className="public-shell mesh-gradient-light relative min-h-screen overflow-x-hidden font-strict text-ink">
        {/* Restrained ambient light + technical grid, single deep-blue hue */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 z-0 h-[860px] public-grid opacity-60"
        />

        <div className="relative z-10">
          <Header locale={locale} onOpenLeadModal={() => handleOpenLead()} />

          <main id="imkoniyatlar">
            <Hero locale={locale} onOpenLeadModal={() => handleOpenLead()} />

            <Features locale={locale} />

            <AppsSection locale={locale} />

            <Pricing locale={locale} onSelectPlan={(planId) => handleOpenLead(planId)} />

            <Steps locale={locale} onOpenLeadModal={() => handleOpenLead()} />

            <FAQ locale={locale} />

            <CTA locale={locale} />
          </main>

          <Footer locale={locale} />
        </div>

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
