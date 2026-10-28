import type { ReactNode } from "react";
import { type MarqueeItem, PhotoMarquee } from "./PhotoMarquee";

type Props = {
  id: string;
  eyebrow: string;
  title: string;
  profileUrl: string;
  profileLabel: ReactNode;
  emptyLabel: string;
  items: MarqueeItem[];
};

/** Home page social section: a scrolling photo strip, or a link to the profile when the feed isn't connected. */
export function SocialFeedSection({ id, eyebrow, title, profileUrl, profileLabel, emptyLabel, items }: Props) {
  return (
    <section className="section" aria-labelledby={id}>
      <div className="stack stack-lg">
        <header className="container page-header centered" style={{ paddingBlock: 0 }}>
          <p className="eyebrow">{eyebrow}</p>
          <h2 id={id}>{title}</h2>
          <a href={profileUrl} target="_blank" rel="noopener noreferrer" className="cluster" style={{ textDecoration: "none" }}>
            {profileLabel}
          </a>
        </header>
        {items.length > 0 ? (
          <PhotoMarquee items={items} />
        ) : (
          <p className="text-center">
            <a href={profileUrl} target="_blank" rel="noopener noreferrer" className="btn btn-outline">
              {emptyLabel}
            </a>
          </p>
        )}
      </div>
    </section>
  );
}
