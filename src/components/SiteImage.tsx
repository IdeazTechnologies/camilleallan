import Image, { type ImageProps } from "next/image";

/** next/image wrapper: images served from our own /media route skip the optimizer. */
export function SiteImage(props: ImageProps) {
  const src = typeof props.src === "string" ? props.src : "";
  const unoptimized = props.unoptimized ?? src.startsWith("/media/");
  return <Image {...props} unoptimized={unoptimized} alt={props.alt ?? ""} />;
}

export function ImagePlaceholder({ label }: { label?: string }) {
  return (
    <div
      aria-hidden={!label}
      style={{
        position: "absolute",
        inset: 0,
        display: "grid",
        placeItems: "center",
        background: "var(--color-surface-strong)",
        color: "var(--color-muted)",
        fontFamily: "var(--font-serif)",
        fontSize: "var(--step-1)",
      }}
    >
      {label ?? "Camille Allen"}
    </div>
  );
}
