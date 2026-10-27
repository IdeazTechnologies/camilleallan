import { SiteTopBanner } from "@/components/site/Banners";
import { Footer } from "@/components/site/Footer";
import { Header } from "@/components/site/Header";

export default function SiteLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <a href="#main" className="sr-only">
        Skip to content
      </a>
      <SiteTopBanner />
      <Header />
      <main id="main">{children}</main>
      <Footer />
    </>
  );
}
