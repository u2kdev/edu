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
import { Testimonials } from "./Testimonials";
import { FAQ } from "./FAQ";
import { CTA } from "./CTA";
import { Footer } from "./Footer";
import { LeadModal } from "./LeadModal";
import { VideoModal } from "./VideoModal";

interface LandingViewProps {
  locale: LandingLocale;
}

export const LandingView: React.FC<LandingViewProps> = ({ locale }) => {
  const [isLeadModalOpen, setIsLeadModalOpen] = useState(false);
  const [isVideoModalOpen, setIsVideoModalOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<string | undefined>(undefined);

  const handleOpenLead = (planId?: string) => {
    setSelectedPlan(planId);
    setIsLeadModalOpen(true);
  };

  return (
    <ThemeProvider>
      <div className="min-h-screen bg-white dark:bg-[#0A1128] text-slate-900 dark:text-slate-100 selection:bg-blue-600 selection:text-white transition-colors duration-400">
        <Header
          locale={locale}
          onOpenLeadModal={() => handleOpenLead()}
        />

        <main id="imkoniyatlar">
          <Hero
            locale={locale}
            onOpenLeadModal={() => handleOpenLead()}
            onOpenVideoModal={() => setIsVideoModalOpen(true)}
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

          <Testimonials locale={locale} />

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

        <VideoModal
          isOpen={isVideoModalOpen}
          onClose={() => setIsVideoModalOpen(false)}
          locale={locale}
        />
      </div>
    </ThemeProvider>
  );
};
