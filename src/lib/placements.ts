import type { BannerPlacement, PollPlacement } from "@/db/schema";

export const BANNER_PLACEMENTS: Array<[BannerPlacement, string]> = [
  ["site_top", "Top of every page"],
  ["home", "Home page"],
  ["shop", "Shop pages"],
  ["product", "Product pages"],
  ["cart", "Cart"],
  ["checkout", "Checkout"],
  ["thank_you", "Order confirmation"],
  ["account", "Customer account"],
];

export const POLL_PLACEMENTS: Array<[PollPlacement, string]> = [
  ["home", "Home page"],
  ["shop", "Shop page"],
  ["gallery", "Gallery page"],
];
