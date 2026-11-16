import "./globals.css";
import type { Metadata } from "next";
import { Inter, JetBrains_Mono, Wix_Madefor_Display, Wix_Madefor_Text } from "next/font/google";

const wixText = Wix_Madefor_Text({
  subsets: ["latin", "latin-ext", "cyrillic", "cyrillic-ext"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-wix-text",
  display: "swap",
});

const wixDisplay = Wix_Madefor_Display({
  subsets: ["latin", "latin-ext", "cyrillic", "cyrillic-ext"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-wix-display",
  display: "swap",
});

/**
 * Self-hosted Inter fallback supplies Uzbek Latin modifier apostrophes (U+02BB, U+02BC)
 * and Uzbek Cyrillic extended letters (Қ, Ғ, Ҳ) omitted from Wix Madefor glyph tables.
 */
const interFallback = Inter({
  subsets: ["latin", "latin-ext", "cyrillic", "cyrillic-ext"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-inter",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin", "latin-ext", "cyrillic"],
  weight: ["400", "500", "600"],
  variable: "--font-jetbrains-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "e-darischi — Multi-tenant платформа для учебных центров",
  description: "Закрытая образовательная экосистема: управление курсами, филиалами, учениками, оплатами и расписанием",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="ru"
      suppressHydrationWarning
      className={`${wixText.variable} ${wixDisplay.variable} ${interFallback.variable} ${jetbrainsMono.variable}`}
    >
      <head>
        {/* Applies the saved public-surface and panel-surface theme before first paint
            to eliminate any dark/light flash for both `.public-shell` and `.panel-shell`. */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              '(function(){try{var p=location.pathname||"";var isPanel=/^\\/(center|platform-admin|developer|account)(\\/|$)/.test(p);if(isPanel){var m=document.cookie.match(/(?:^|; )edarschi_panel_theme=([^;]+)/);var pt=m?decodeURIComponent(m[1]):"light";var pd=pt==="dark"||(pt==="system"&&window.matchMedia&&window.matchMedia("(prefers-color-scheme: dark)").matches);if(pd){document.documentElement.classList.add("dark");}else{document.documentElement.classList.remove("dark");}return;}var q=new URLSearchParams(location.search).get("theme");var s=localStorage.getItem("edarschi-theme");var d=q==="dark"||(q!=="light"&&(s==="dark"||(s!=="light"&&window.matchMedia&&window.matchMedia("(prefers-color-scheme: dark)").matches)));document.documentElement.setAttribute("data-theme",d?"dark":"light");}catch(e){}})();',
          }}
        />
      </head>
      <body className="bg-slate-50 text-slate-900 font-sans antialiased selection:bg-primary/20 selection:text-foreground min-h-screen">
        {children}
      </body>
    </html>
  );
}
