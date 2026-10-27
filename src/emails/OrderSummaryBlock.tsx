import { Column, Row, Section, Text } from "@react-email/components";
import type { Address } from "@/db/schema";
import { formatMoney } from "@/lib/utils";
import { colors, styles } from "./EmailLayout";

export type EmailOrder = {
  number: number;
  currency: string;
  items: { title: string; quantity: number; unitPriceCents: number }[];
  subtotalCents: number;
  shippingCents: number;
  taxCents: number;
  totalCents: number;
  taxLabel: string;
  shippingMethod: string | null;
  shippingAddress: Address | null;
  email: string;
  customerNote?: string | null;
};

const cell = { fontSize: "14px", padding: "6px 0", color: colors.text, margin: 0 };

export function OrderSummaryBlock({ order }: { order: EmailOrder }) {
  const money = (c: number) => formatMoney(c, order.currency);
  const a = order.shippingAddress;
  return (
    <>
      <Section style={{ borderTop: `1px solid ${colors.border}`, borderBottom: `1px solid ${colors.border}`, margin: "16px 0" }}>
        {order.items.map((item, i) => (
          <Row key={i}>
            <Column>
              <Text style={cell}>
                {item.title} {item.quantity > 1 ? `× ${item.quantity}` : ""}
              </Text>
            </Column>
            <Column align="right">
              <Text style={cell}>{money(item.unitPriceCents * item.quantity)}</Text>
            </Column>
          </Row>
        ))}
      </Section>
      <Section>
        {[
          ["Subtotal", order.subtotalCents],
          [`Shipping${order.shippingMethod ? ` (${order.shippingMethod})` : ""}`, order.shippingCents],
          ...(order.taxCents > 0 ? [[order.taxLabel, order.taxCents] as const] : []),
        ].map(([label, cents]) => (
          <Row key={String(label)}>
            <Column>
              <Text style={{ ...cell, color: colors.muted }}>{label}</Text>
            </Column>
            <Column align="right">
              <Text style={cell}>{money(Number(cents))}</Text>
            </Column>
          </Row>
        ))}
        <Row>
          <Column>
            <Text style={{ ...cell, fontWeight: 600, fontSize: "16px" }}>Total</Text>
          </Column>
          <Column align="right">
            <Text style={{ ...cell, fontWeight: 600, fontSize: "16px" }}>{money(order.totalCents)}</Text>
          </Column>
        </Row>
      </Section>
      {a && (
        <Section style={{ marginTop: "16px" }}>
          <Text style={{ ...styles.muted, textTransform: "uppercase", letterSpacing: "0.1em", margin: "0 0 4px" }}>
            Shipping to
          </Text>
          <Text style={{ ...styles.p, margin: 0 }}>
            {a.name}
            <br />
            {a.line1}
            {a.line2 ? (
              <>
                <br />
                {a.line2}
              </>
            ) : null}
            <br />
            {a.city}, {a.region} {a.postalCode}
            <br />
            {a.country}
          </Text>
        </Section>
      )}
      {order.customerNote && (
        <Section style={{ marginTop: "16px" }}>
          <Text style={{ ...styles.muted, textTransform: "uppercase", letterSpacing: "0.1em", margin: "0 0 4px" }}>
            Note
          </Text>
          <Text style={styles.p}>{order.customerNote}</Text>
        </Section>
      )}
    </>
  );
}
