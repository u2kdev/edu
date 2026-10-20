import "./globals.css";
import type { Metadata } from "next";

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
    <html lang="ru">
      <head>
        {/* Applies the saved public-surface theme before the first paint, so a
            dark-theme visitor never sees a white flash. Dashboards are untouched:
            the dark palette is scoped to `.public-shell` in globals.css. */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              '(function(){try{var q=new URLSearchParams(location.search).get("theme");var s=localStorage.getItem("edarschi-theme");var d=q==="dark"||(q!=="light"&&(s==="dark"||(s!=="light"&&window.matchMedia&&window.matchMedia("(prefers-color-scheme: dark)").matches)));document.documentElement.setAttribute("data-theme",d?"dark":"light");}catch(e){}})();',
          }}
        />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=Wix+Madefor+Display:wght@400;500;600;700;800&family=Wix+Madefor+Text:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="bg-slate-50 text-slate-900 font-sans antialiased selection:bg-blue-600 selection:text-white min-h-screen">
        {children}
      </body>
    </html>
  );
}
