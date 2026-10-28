import { getFacebookFeed } from "@/lib/facebook";
import { getSettings } from "@/lib/settings";
import { FacebookIcon } from "./icons";
import { SocialFeedSection } from "./SocialFeedSection";

export async function FacebookFeed({ limit = 12 }: { limit?: number }) {
  const [settings, posts] = await Promise.all([getSettings(), getFacebookFeed(limit)]);
  if (!settings.facebookUrl && posts.length === 0) return null;
  const profileUrl = settings.facebookUrl || "https://www.facebook.com/";

  return (
    <SocialFeedSection
      id="facebook-heading"
      eyebrow="Studio news"
      title="Follow along on Facebook"
      profileUrl={profileUrl}
      profileLabel={
        <>
          <FacebookIcon width={18} height={18} /> {settings.storeName} on Facebook
        </>
      }
      emptyLabel="See the latest on Facebook"
      items={posts.map((post) => ({
        id: post.id,
        imageUrl: post.imageUrl,
        href: post.permalink,
        alt: post.message?.slice(0, 120) || "Facebook post",
        caption: post.message?.slice(0, 140),
      }))}
    />
  );
}
