import Link from "next/link";
import { ProductGrid } from "@/components/shop/ProductCard";
import { SiteImage } from "@/components/SiteImage";
import { Banners } from "@/components/site/Banners";
import { InstagramFeed } from "@/components/site/InstagramFeed";
import { Poll } from "@/components/site/Poll";
import { getFeaturedProducts } from "@/lib/catalog";
import { getSettings } from "@/lib/settings";
import styles from "./home.module.css";

export default async function HomePage() {
  const [settings, featured] = await Promise.all([getSettings(), getFeaturedProducts(8)]);
  const heroImage = settings.heroImageUrl || featured[0]?.image?.url || null;

  return (
    <>
      <section className={styles.hero}>
        <div className={`container ${styles.heroInner}`}>
          <div className={styles.heroText}>
            <p className="eyebrow">{settings.tagline}</p>
            <h1>{settings.heroTitle}</h1>
            <p className="lede">{settings.heroSubtitle}</p>
            <div className="cluster">
              <Link href="/shop" className="btn">
                Shop the collection
              </Link>
              <Link href="/gallery" className="btn btn-outline">
                View the gallery
              </Link>
            </div>
          </div>
          {heroImage && (
            <div className={styles.heroMedia}>
              <SiteImage src={heroImage} alt="" fill priority sizes="(max-width: 860px) 100vw, 50vw" />
            </div>
          )}
        </div>
      </section>

      <div className="container">
        <Banners placement="home" className="mt-6" />
      </div>

      {featured.length > 0 && (
        <section className="section" aria-labelledby="new-heading">
          <div className="container stack stack-lg">
            <header className="spread">
              <div className="stack stack-sm">
                <p className="eyebrow">Available now</p>
                <h2 id="new-heading">Brand new in the shop</h2>
              </div>
              <Link href="/shop" className="btn btn-outline btn-sm">
                View all
              </Link>
            </header>
            <ProductGrid products={featured} priorityCount={4} />
          </div>
        </section>
      )}

      <section className={`section ${styles.intro}`}>
        <div className="container-narrow stack text-center" style={{ justifyItems: "center" }}>
          <p className="eyebrow">The artist</p>
          <h2>Made by hand in {settings.location.split(",")[0]}</h2>
          <p className="lede">{settings.introText}</p>
          <div className="cluster" style={{ justifyContent: "center" }}>
            <Link href="/contact?type=custom_order" className="btn btn-accent">
              Ask about a custom piece
            </Link>
          </div>
        </div>
      </section>

      <Poll placement="home" />
      <InstagramFeed />
    </>
  );
}
