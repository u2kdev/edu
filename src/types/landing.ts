export type LandingLocale = "uz" | "ru";

export interface PricingPlan {
  id: string;
  name: string;
  priceMonthly: number;
  period: string;
  description: string;
  isPopular?: boolean;
  badge?: string;
  features: string[];
  ctaText: string;
}

export interface FeatureItem {
  id: string;
  title: string;
  description: string;
  icon: string;
  badge?: string;
}

export interface StepItem {
  step: number;
  title: string;
  description: string;
  highlight: string;
}

export interface TestimonialItem {
  id: string;
  author: string;
  role: string;
  centerName: string;
  city: string;
  quote: string;
  metric: string;
}

export interface FAQItem {
  id: string;
  question: string;
  answer: string;
}

export interface StatItem {
  id: string;
  value: number;
  suffix: string;
  label: string;
}

export interface ContactFormData {
  fullName: string;
  phone: string;
  organizationName: string;
  notes?: string;
}
