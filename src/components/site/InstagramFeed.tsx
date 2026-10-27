import { getInstagramFeed } from "@/lib/instagram";
import { getSettings } from "@/lib/settings";
import { InstagramIcon } from "./icons";
import styles from "./InstagramFeed.module.css";

export async function InstagramFeed({ limit = 8 }: { limit?: number }) {
  const [settings, posts] = await Promise.all([getSettings(), getInstagramFeed(12)]);
  const handle = settings.instagramHandle;
  if (!handle && posts.length === 0) return null;
  const profileUrl = handle ? `https://www.instagram.com/${handle}/` : "https://www.instagram.com/";

  return (
    <section className="section" aria-labelledby="instagram-heading">
      <div className="container stack stack-lg">
        <header className="page-header centered" style={{ paddingBlock: 0 }}>
          <p className="eyebrow">From the studio</p>
          <h2 id="instagram-heading">Follow along on Instagram</h2>
          {handle && (
            <a href={profileUrl} target="_blank" rel="noopener noreferrer" className="cluster" style={{ textDecoration: "none" }}>
              <InstagramIcon width={18} height={18} /> @{handle}
            </a>
          )}
        </header>
        {posts.length > 0 ? (
          <ul className={styles.grid}>
            {posts.slice(0, limit).map((post) => (
              <li key={post.id}>
                <a href={post.permalink} target="_blank" rel="noopener noreferrer" className={styles.tile}>
                  {/* Instagram CDN URLs are signed and expire, so they bypass the image optimizer. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={post.imageUrl} alt={post.caption?.slice(0, 120) || "Instagram post"} loading="lazy" />
                  {post.caption && <span className={styles.caption}>{post.caption.slice(0, 140)}</span>}
                </a>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-center">
            <a href={profileUrl} target="_blank" rel="noopener noreferrer" className="btn btn-outline">
              See the latest on Instagram
            </a>
          </p>
        )}
      </div>
    </section>
  );
}
