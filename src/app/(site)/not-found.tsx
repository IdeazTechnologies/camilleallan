import Link from "next/link";

export default function NotFound() {
  return (
    <div className="container empty-state">
      <p className="eyebrow">404</p>
      <h1>We couldn&apos;t find that page</h1>
      <p className="lede">It may have moved, or the piece may have found its forever home.</p>
      <div className="cluster" style={{ justifyContent: "center" }}>
        <Link href="/shop" className="btn">
          Visit the shop
        </Link>
        <Link href="/" className="btn btn-outline">
          Home
        </Link>
      </div>
    </div>
  );
}
