import { Metadata } from "next";
import { LandingView } from "../../components/landing/LandingView";
import { getLandingMessages } from "../../lib/landing-i18n";

export async function generateMetadata(): Promise<Metadata> {
  const t = getLandingMessages("ru");

  return {
    title: t.meta.title,
    description: t.meta.description,
    keywords: t.meta.keywords,
    alternates: {
      canonical: "https://e-darschi.uz/ru",
      languages: {
        "uz-UZ": "https://e-darschi.uz/",
        "ru-RU": "https://e-darschi.uz/ru",
      },
    },
    openGraph: {
      title: t.meta.title,
      description: t.meta.description,
      url: "https://e-darschi.uz/ru",
      siteName: "e-darschi",
      locale: "ru_RU",
      type: "website",
      images: [
        {
          url: "https://e-darschi.uz/og-image-ru.png",
          width: 1200,
          height: 630,
          alt: "e-darschi LMS платформа",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: t.meta.title,
      description: t.meta.description,
    },
  };
}

export default function RussianHomePage() {
  return <LandingView locale="ru" />;
}
