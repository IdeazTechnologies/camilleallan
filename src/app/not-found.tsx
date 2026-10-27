import SiteNotFound from "./(site)/not-found";
import SiteLayout from "./(site)/layout";

export default function NotFound() {
  return (
    <SiteLayout params={Promise.resolve({})}>
      <SiteNotFound />
    </SiteLayout>
  );
}
