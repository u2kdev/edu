import { notFound } from "next/navigation";
import { PanelThemeProvider } from "@/components/theme/PanelThemeProvider";
import { DevUiKitShowcase } from "@/components/dev/DevUiKitShowcase";

export const dynamic = "force-dynamic";

export default function DevUiKitPage(props: {
  searchParams?: { theme?: string };
}) {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  const initialTheme = props?.searchParams?.theme === "dark" ? "dark" : "light";

  return (
    <PanelThemeProvider initialTheme={initialTheme} initialResolvedTheme={initialTheme}>
      <DevUiKitShowcase initialTheme={initialTheme} />
    </PanelThemeProvider>
  );
}
