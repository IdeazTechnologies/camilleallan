import { Button, Link, Section, Text } from "@react-email/components";
import { EmailLayout, styles } from "./EmailLayout";
import { OrderSummaryBlock, type EmailOrder } from "./OrderSummaryBlock";

export function OrderConfirmationEmail({ order, orderUrl }: { order: EmailOrder; orderUrl: string }) {
  return (
    <EmailLayout preview={`Thank you! Order #${order.number} is confirmed.`}>
      <Text style={styles.h1}>Thank you for your order</Text>
      <Text style={styles.p}>
        Your payment was received and order <strong>#{order.number}</strong> is confirmed. Each piece is
        carefully wrapped by hand; you&apos;ll get another email with tracking as soon as it ships.
      </Text>
      <OrderSummaryBlock order={order} />
      <Section style={{ textAlign: "center", marginTop: "24px" }}>
        <Button href={orderUrl} style={styles.button}>
          View your order
        </Button>
      </Section>
    </EmailLayout>
  );
}

export function AdminNewOrderEmail({ order, adminUrl }: { order: EmailOrder; adminUrl: string }) {
  return (
    <EmailLayout preview={`New order #${order.number} from ${order.email}`}>
      <Text style={styles.h1}>New order #{order.number}</Text>
      <Text style={styles.p}>
        A paid order was placed by <Link href={`mailto:${order.email}`}>{order.email}</Link>.
      </Text>
      <OrderSummaryBlock order={order} />
      <Section style={{ textAlign: "center", marginTop: "24px" }}>
        <Button href={adminUrl} style={styles.button}>
          Open in admin
        </Button>
      </Section>
    </EmailLayout>
  );
}

export function OrderShippedEmail({
  order,
  orderUrl,
  carrier,
  trackingNumber,
  trackingUrl,
}: {
  order: EmailOrder;
  orderUrl: string;
  carrier?: string | null;
  trackingNumber?: string | null;
  trackingUrl?: string | null;
}) {
  return (
    <EmailLayout preview={`Order #${order.number} is on its way`}>
      <Text style={styles.h1}>Your order is on its way</Text>
      <Text style={styles.p}>
        Good news! Order <strong>#{order.number}</strong> has shipped
        {carrier ? ` with ${carrier}` : ""}.
      </Text>
      {trackingNumber && (
        <Text style={styles.p}>
          Tracking number:{" "}
          {trackingUrl ? <Link href={trackingUrl}>{trackingNumber}</Link> : <strong>{trackingNumber}</strong>}
        </Text>
      )}
      <OrderSummaryBlock order={order} />
      <Section style={{ textAlign: "center", marginTop: "24px" }}>
        <Button href={trackingUrl ?? orderUrl} style={styles.button}>
          {trackingUrl ? "Track package" : "View your order"}
        </Button>
      </Section>
    </EmailLayout>
  );
}

export function OrderStatusEmail({
  order,
  orderUrl,
  headline,
  message,
}: {
  order: EmailOrder;
  orderUrl: string;
  headline: string;
  message: string;
}) {
  return (
    <EmailLayout preview={`${headline} (order #${order.number})`}>
      <Text style={styles.h1}>{headline}</Text>
      <Text style={styles.p}>{message}</Text>
      <OrderSummaryBlock order={order} />
      <Section style={{ textAlign: "center", marginTop: "24px" }}>
        <Button href={orderUrl} style={styles.button}>
          View your order
        </Button>
      </Section>
    </EmailLayout>
  );
}
