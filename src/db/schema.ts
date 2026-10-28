import { relations, sql } from "drizzle-orm";
import {
  boolean,
  customType,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

const id = () =>
  text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID());
const createdAt = () => timestamp("created_at", { mode: "date" }).notNull().defaultNow();
const updatedAt = () =>
  timestamp("updated_at", { mode: "date" })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date());

const bytea = customType<{ data: Buffer; driverData: Buffer }>({
  dataType() {
    return "bytea";
  },
});

export type Role = "customer" | "admin";
export type ProductStatus = "draft" | "published" | "archived";
export type OrderStatus =
  | "pending"
  | "paid"
  | "fulfilled"
  | "shipped"
  | "cancelled"
  | "refunded"
  | "failed";
export type BannerPlacement =
  | "site_top"
  | "home"
  | "shop"
  | "product"
  | "cart"
  | "checkout"
  | "thank_you"
  | "account";
export type PollPlacement = "home" | "shop" | "gallery";
export type PageLayout = "prose" | "cards" | "faq";

export type Address = {
  name: string;
  line1: string;
  line2?: string | null;
  city: string;
  region: string;
  postalCode: string;
  country: string;
  phone?: string | null;
};

/* ----------------------------- Auth.js tables ----------------------------- */

export const users = pgTable("users", {
  id: id(),
  name: text("name"),
  email: text("email").notNull().unique(),
  emailVerified: timestamp("email_verified", { mode: "date" }),
  image: text("image"),
  role: text("role").$type<Role>().notNull().default("customer"),
  phone: text("phone"),
  passwordHash: text("password_hash"),
  createdAt: createdAt(),
});

export const accounts = pgTable(
  "accounts",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("provider_account_id").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (t) => [primaryKey({ columns: [t.provider, t.providerAccountId] })],
);

export const sessions = pgTable("sessions", {
  sessionToken: text("session_token").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { mode: "date" }).notNull(),
});

export const verificationTokens = pgTable(
  "verification_tokens",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { mode: "date" }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.identifier, t.token] })],
);

/* ----------------------- Password sign-in & devices ----------------------- */

export type AuthChallengePurpose = "login" | "signup" | "reset";

export type AuthChallengePayload = {
  name?: string;
  passwordHash?: string;
  userId?: string;
};

/** Single-use emailed codes for a new device, a new account, or a password reset. */
export const authChallenges = pgTable(
  "auth_challenges",
  {
    id: id(),
    purpose: text("purpose").$type<AuthChallengePurpose>().notNull(),
    email: text("email").notNull(),
    codeHash: text("code_hash").notNull(),
    payload: jsonb("payload").$type<AuthChallengePayload>(),
    expiresAt: timestamp("expires_at", { mode: "date" }).notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("auth_challenges_email_idx").on(t.email, t.purpose)],
);

/**
 * A browser that has already confirmed a sign-in. The cookie holds a random id;
 * only the hash is stored, so a database copy cannot impersonate the browser.
 */
export const trustedDevices = pgTable(
  "trusted_devices",
  {
    id: id(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull(),
    createdAt: createdAt(),
    lastUsedAt: timestamp("last_used_at", { mode: "date" }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("trusted_devices_user_token_idx").on(t.userId, t.tokenHash),
    index("trusted_devices_user_idx").on(t.userId),
  ],
);

/* -------------------------------- Customers ------------------------------- */

export const addresses = pgTable(
  "addresses",
  {
    id: id(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    line1: text("line1").notNull(),
    line2: text("line2"),
    city: text("city").notNull(),
    region: text("region").notNull(),
    postalCode: text("postal_code").notNull(),
    country: text("country").notNull().default("US"),
    phone: text("phone"),
    isDefault: boolean("is_default").notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => [index("addresses_user_idx").on(t.userId)],
);

export const savedCards = pgTable(
  "saved_cards",
  {
    id: id(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    // The PSiGate OrderID whose card details are reused via PreOrderID. No card data is stored.
    psigateOrderId: text("psigate_order_id").notNull(),
    cardType: text("card_type"),
    last4: text("last4"),
    expMonth: text("exp_month"),
    expYear: text("exp_year"),
    createdAt: createdAt(),
  },
  (t) => [index("saved_cards_user_idx").on(t.userId)],
);

/* --------------------------------- Catalog -------------------------------- */

export const categories = pgTable("categories", {
  id: id(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  description: text("description"),
  sortOrder: integer("sort_order").notNull().default(0),
  wooId: integer("woo_id"),
  createdAt: createdAt(),
});

export const products = pgTable(
  "products",
  {
    id: id(),
    slug: text("slug").notNull().unique(),
    title: text("title").notNull(),
    summary: text("summary"),
    description: text("description"),
    priceCents: integer("price_cents").notNull(),
    compareAtCents: integer("compare_at_cents"),
    sku: text("sku"),
    stockQty: integer("stock_qty").notNull().default(1),
    oneOfAKind: boolean("one_of_a_kind").notNull().default(true),
    status: text("status").$type<ProductStatus>().notNull().default("draft"),
    featured: boolean("featured").notNull().default(false),
    categoryId: text("category_id").references(() => categories.id, { onDelete: "set null" }),
    weightGrams: integer("weight_grams"),
    sortOrder: integer("sort_order").notNull().default(0),
    wooId: integer("woo_id"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("products_status_idx").on(t.status),
    index("products_category_idx").on(t.categoryId),
  ],
);

export const productImages = pgTable(
  "product_images",
  {
    id: id(),
    productId: text("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    url: text("url").notNull(),
    alt: text("alt"),
    width: integer("width"),
    height: integer("height"),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: createdAt(),
  },
  (t) => [index("product_images_product_idx").on(t.productId)],
);

export const galleryAlbums = pgTable("gallery_albums", {
  id: id(),
  title: text("title").notNull(),
  slug: text("slug").notNull().unique(),
  description: text("description"),
  published: boolean("published").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: createdAt(),
});

export const galleryImages = pgTable(
  "gallery_images",
  {
    id: id(),
    albumId: text("album_id")
      .notNull()
      .references(() => galleryAlbums.id, { onDelete: "cascade" }),
    url: text("url").notNull(),
    alt: text("alt"),
    caption: text("caption"),
    width: integer("width"),
    height: integer("height"),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: createdAt(),
  },
  (t) => [index("gallery_images_album_idx").on(t.albumId)],
);

// Fallback image storage when Vercel Blob is not configured.
export const media = pgTable("media", {
  id: id(),
  contentType: text("content_type").notNull(),
  size: integer("size").notNull(),
  data: bytea("data").notNull(),
  createdAt: createdAt(),
});

/* ---------------------------------- Cart ---------------------------------- */

export const carts = pgTable("carts", {
  id: id(),
  userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const cartItems = pgTable(
  "cart_items",
  {
    id: id(),
    cartId: text("cart_id")
      .notNull()
      .references(() => carts.id, { onDelete: "cascade" }),
    productId: text("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    quantity: integer("quantity").notNull().default(1),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("cart_items_cart_product_idx").on(t.cartId, t.productId)],
);

/* --------------------------------- Orders --------------------------------- */

export const orders = pgTable(
  "orders",
  {
    id: id(),
    number: serial("number").notNull().unique(),
    accessToken: text("access_token")
      .notNull()
      .$defaultFn(() => crypto.randomUUID().replaceAll("-", "")),
    userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
    cartId: text("cart_id"),
    email: text("email").notNull(),
    status: text("status").$type<OrderStatus>().notNull().default("pending"),
    currency: text("currency").notNull().default("USD"),
    subtotalCents: integer("subtotal_cents").notNull(),
    shippingCents: integer("shipping_cents").notNull().default(0),
    taxCents: integer("tax_cents").notNull().default(0),
    totalCents: integer("total_cents").notNull(),
    shippingRuleId: text("shipping_rule_id"),
    shippingMethod: text("shipping_method"),
    shippingAddress: jsonb("shipping_address").$type<Address>(),
    billingAddress: jsonb("billing_address").$type<Address>(),
    customerNote: text("customer_note"),
    adminNote: text("admin_note"),
    paymentMethod: text("payment_method").notNull().default("psigate"),
    psigateOrderId: text("psigate_order_id").unique(),
    psigateTransRef: text("psigate_trans_ref"),
    cardType: text("card_type"),
    cardLast4: text("card_last4"),
    saveCard: boolean("save_card").notNull().default(false),
    newsletterOptIn: boolean("newsletter_opt_in").notNull().default(false),
    reservedUntil: timestamp("reserved_until", { mode: "date" }),
    paidAt: timestamp("paid_at", { mode: "date" }),
    fulfilledAt: timestamp("fulfilled_at", { mode: "date" }),
    shippedAt: timestamp("shipped_at", { mode: "date" }),
    cancelledAt: timestamp("cancelled_at", { mode: "date" }),
    wooId: integer("woo_id"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("orders_user_idx").on(t.userId),
    index("orders_status_idx").on(t.status),
    index("orders_email_idx").on(t.email),
  ],
);

export const orderItems = pgTable(
  "order_items",
  {
    id: id(),
    orderId: text("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    productId: text("product_id").references(() => products.id, { onDelete: "set null" }),
    title: text("title").notNull(),
    sku: text("sku"),
    imageUrl: text("image_url"),
    unitPriceCents: integer("unit_price_cents").notNull(),
    quantity: integer("quantity").notNull(),
  },
  (t) => [index("order_items_order_idx").on(t.orderId)],
);

export const orderEvents = pgTable(
  "order_events",
  {
    id: id(),
    orderId: text("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    type: text("type").$type<"status" | "note" | "email" | "payment">().notNull(),
    message: text("message").notNull(),
    fromStatus: text("from_status"),
    toStatus: text("to_status"),
    actorUserId: text("actor_user_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: createdAt(),
  },
  (t) => [index("order_events_order_idx").on(t.orderId)],
);

export const shipments = pgTable("shipments", {
  id: id(),
  orderId: text("order_id")
    .notNull()
    .references(() => orders.id, { onDelete: "cascade" }),
  carrier: text("carrier"),
  trackingNumber: text("tracking_number"),
  trackingUrl: text("tracking_url"),
  shippedAt: timestamp("shipped_at", { mode: "date" }).notNull().defaultNow(),
  createdAt: createdAt(),
});

// Only used by PSIGATE_MODE=simulate to stand in for PSiGate's Order Verification API.
export const paymentSimulations = pgTable("payment_simulations", {
  psigateOrderId: text("psigate_order_id").primaryKey(),
  approved: boolean("approved").notNull(),
  totalCents: integer("total_cents").notNull(),
  createdAt: createdAt(),
});

export const shippingRules = pgTable("shipping_rules", {
  id: id(),
  name: text("name").notNull(),
  description: text("description"),
  // ISO 3166-1 alpha-2 codes; empty means every country not named by another active rule.
  countries: text("countries")
    .array()
    .notNull()
    .default(sql`'{}'::text[]`),
  minSubtotalCents: integer("min_subtotal_cents"),
  maxSubtotalCents: integer("max_subtotal_cents"),
  minItems: integer("min_items"),
  maxItems: integer("max_items"),
  rateCents: integer("rate_cents").notNull().default(0),
  perItemCents: integer("per_item_cents").notNull().default(0),
  active: boolean("active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: createdAt(),
});

/* ------------------------------ Site content ------------------------------ */

export const settings = pgTable("settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
  updatedAt: updatedAt(),
});

export const pages = pgTable("pages", {
  id: id(),
  slug: text("slug").notNull().unique(),
  title: text("title").notNull(),
  body: text("body").notNull().default(""),
  layout: text("layout").$type<PageLayout>().notNull().default("prose"),
  metaDescription: text("meta_description"),
  published: boolean("published").notNull().default(true),
  showInNav: boolean("show_in_nav").notNull().default(false),
  /** Shorter name for menus; falls back to the title. */
  navLabel: text("nav_label"),
  navOrder: integer("nav_order").notNull().default(0),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const banners = pgTable("banners", {
  id: id(),
  placement: text("placement").$type<BannerPlacement>().notNull(),
  title: text("title"),
  body: text("body"),
  linkUrl: text("link_url"),
  linkLabel: text("link_label"),
  tone: text("tone").$type<"info" | "promo" | "notice">().notNull().default("info"),
  active: boolean("active").notNull().default(true),
  startsAt: timestamp("starts_at", { mode: "date" }),
  endsAt: timestamp("ends_at", { mode: "date" }),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: createdAt(),
});

export const polls = pgTable("polls", {
  id: id(),
  question: text("question").notNull(),
  placement: text("placement").$type<PollPlacement>().notNull().default("home"),
  active: boolean("active").notNull().default(true),
  closesAt: timestamp("closes_at", { mode: "date" }),
  createdAt: createdAt(),
});

export const pollOptions = pgTable("poll_options", {
  id: id(),
  pollId: text("poll_id")
    .notNull()
    .references(() => polls.id, { onDelete: "cascade" }),
  label: text("label").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const pollVotes = pgTable(
  "poll_votes",
  {
    id: id(),
    pollId: text("poll_id")
      .notNull()
      .references(() => polls.id, { onDelete: "cascade" }),
    optionId: text("option_id")
      .notNull()
      .references(() => pollOptions.id, { onDelete: "cascade" }),
    voterKey: text("voter_key").notNull(),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("poll_votes_voter_idx").on(t.pollId, t.voterKey)],
);

export const contactMessages = pgTable("contact_messages", {
  id: id(),
  kind: text("kind").$type<"general" | "custom_order">().notNull().default("general"),
  name: text("name").notNull(),
  email: text("email").notNull(),
  phone: text("phone"),
  subject: text("subject"),
  message: text("message").notNull(),
  status: text("status").$type<"new" | "read" | "archived">().notNull().default("new"),
  ip: text("ip"),
  createdAt: createdAt(),
});

/* -------------------------------- Newsletter ------------------------------- */

export const newsletterSubscribers = pgTable("newsletter_subscribers", {
  id: id(),
  email: text("email").notNull().unique(),
  name: text("name"),
  status: text("status")
    .$type<"pending" | "subscribed" | "unsubscribed">()
    .notNull()
    .default("pending"),
  token: text("token")
    .notNull()
    .unique()
    .$defaultFn(() => crypto.randomUUID().replaceAll("-", "")),
  source: text("source"),
  userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
  confirmedAt: timestamp("confirmed_at", { mode: "date" }),
  unsubscribedAt: timestamp("unsubscribed_at", { mode: "date" }),
  createdAt: createdAt(),
});

export const newsletterCampaigns = pgTable("newsletter_campaigns", {
  id: id(),
  subject: text("subject").notNull(),
  body: text("body").notNull().default(""),
  status: text("status").$type<"draft" | "sending" | "sent">().notNull().default("draft"),
  sentCount: integer("sent_count").notNull().default(0),
  failedCount: integer("failed_count").notNull().default(0),
  startedAt: timestamp("started_at", { mode: "date" }),
  sentAt: timestamp("sent_at", { mode: "date" }),
  createdBy: text("created_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const campaignRecipients = pgTable(
  "campaign_recipients",
  {
    campaignId: text("campaign_id")
      .notNull()
      .references(() => newsletterCampaigns.id, { onDelete: "cascade" }),
    subscriberId: text("subscriber_id")
      .notNull()
      .references(() => newsletterSubscribers.id, { onDelete: "cascade" }),
    status: text("status").$type<"queued" | "sent" | "failed">().notNull().default("queued"),
    error: text("error"),
    sentAt: timestamp("sent_at", { mode: "date" }),
  },
  (t) => [
    primaryKey({ columns: [t.campaignId, t.subscriberId] }),
    index("campaign_recipients_status_idx").on(t.campaignId, t.status),
  ],
);

/* -------------------------------- Operations ------------------------------- */

export const emailLog = pgTable(
  "email_log",
  {
    id: id(),
    to: text("to").notNull(),
    subject: text("subject").notNull(),
    template: text("template").notNull(),
    status: text("status").$type<"sent" | "failed" | "outbox">().notNull(),
    providerId: text("provider_id"),
    error: text("error"),
    // Bodies are only kept for EMAIL_TRANSPORT=outbox (development and automated tests).
    html: text("html"),
    text: text("text"),
    createdAt: createdAt(),
  },
  (t) => [index("email_log_to_idx").on(t.to), index("email_log_created_idx").on(t.createdAt)],
);

export const rateLimits = pgTable("rate_limits", {
  key: text("key").primaryKey(),
  count: integer("count").notNull().default(0),
  resetAt: timestamp("reset_at", { mode: "date" }).notNull(),
});

export const auditLog = pgTable(
  "audit_log",
  {
    id: id(),
    actorUserId: text("actor_user_id").references(() => users.id, { onDelete: "set null" }),
    action: text("action").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id"),
    details: jsonb("details"),
    createdAt: createdAt(),
  },
  (t) => [index("audit_log_entity_idx").on(t.entityType, t.entityId)],
);

/* -------------------------------- Relations -------------------------------- */

export const usersRelations = relations(users, ({ many }) => ({
  addresses: many(addresses),
  orders: many(orders),
  savedCards: many(savedCards),
}));

export const categoriesRelations = relations(categories, ({ many }) => ({
  products: many(products),
}));

export const productsRelations = relations(products, ({ one, many }) => ({
  category: one(categories, { fields: [products.categoryId], references: [categories.id] }),
  images: many(productImages),
}));

export const productImagesRelations = relations(productImages, ({ one }) => ({
  product: one(products, { fields: [productImages.productId], references: [products.id] }),
}));

export const galleryAlbumsRelations = relations(galleryAlbums, ({ many }) => ({
  images: many(galleryImages),
}));

export const galleryImagesRelations = relations(galleryImages, ({ one }) => ({
  album: one(galleryAlbums, { fields: [galleryImages.albumId], references: [galleryAlbums.id] }),
}));

export const cartsRelations = relations(carts, ({ many }) => ({
  items: many(cartItems),
}));

export const cartItemsRelations = relations(cartItems, ({ one }) => ({
  cart: one(carts, { fields: [cartItems.cartId], references: [carts.id] }),
  product: one(products, { fields: [cartItems.productId], references: [products.id] }),
}));

export const ordersRelations = relations(orders, ({ one, many }) => ({
  user: one(users, { fields: [orders.userId], references: [users.id] }),
  items: many(orderItems),
  events: many(orderEvents),
  shipments: many(shipments),
}));

export const orderItemsRelations = relations(orderItems, ({ one }) => ({
  order: one(orders, { fields: [orderItems.orderId], references: [orders.id] }),
  product: one(products, { fields: [orderItems.productId], references: [products.id] }),
}));

export const orderEventsRelations = relations(orderEvents, ({ one }) => ({
  order: one(orders, { fields: [orderEvents.orderId], references: [orders.id] }),
  actor: one(users, { fields: [orderEvents.actorUserId], references: [users.id] }),
}));

export const shipmentsRelations = relations(shipments, ({ one }) => ({
  order: one(orders, { fields: [shipments.orderId], references: [orders.id] }),
}));

export const pollsRelations = relations(polls, ({ many }) => ({
  options: many(pollOptions),
  votes: many(pollVotes),
}));

export const pollOptionsRelations = relations(pollOptions, ({ one }) => ({
  poll: one(polls, { fields: [pollOptions.pollId], references: [polls.id] }),
}));

export const addressesRelations = relations(addresses, ({ one }) => ({
  user: one(users, { fields: [addresses.userId], references: [users.id] }),
}));

export const savedCardsRelations = relations(savedCards, ({ one }) => ({
  user: one(users, { fields: [savedCards.userId], references: [users.id] }),
}));
