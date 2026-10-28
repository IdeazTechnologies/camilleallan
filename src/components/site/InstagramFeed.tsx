import { getInstagramFeed } from "@/lib/instagram";
import { getSettings } from "@/lib/settings";
import { InstagramIcon } from "./icons";
import { SocialFeedSection } from "./SocialFeedSection";

export async function InstagramFeed({ limit = 12 }: { limit?: number }) {
  const [settings, posts] = await Promise.all([getSettings(), getInstagramFeed(limit)]);
  const handle = settings.instagramHandle;
  if (!handle && posts.length === 0) return null;
  const profileUrl = handle ? `https://www.instagram.com/${handle}/` : "https://www.instagram.com/";

  return (
    <SocialFeedSection
      id="instagram-heading"
      eyebrow="From the studio"
      title="Follow along on Instagram"
      profileUrl={profileUrl}
      profileLabel={
        <>
          <InstagramIcon width={18} height={18} /> {handle ? `@${handle}` : "Instagram"}
        </>
      }
      emptyLabel="See the latest on Instagram"
      items={posts.map((post) => ({
        id: post.id,
        imageUrl: post.imageUrl,
        href: post.permalink,
        alt: post.caption?.slice(0, 120) || "Instagram post",
        caption: post.caption?.slice(0, 140),
      }))}
    />
  );
}
