const Promo = require("../models/PromoCode");

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function catalogTickets(event) {
  const list = (event.tickets || []).filter((t) => t && t.type);
  if (list.length) return list;
  return [{ type: "GENERAL", price: Number(event.price) || 0 }];
}

function applyPromo(promo, subtotal) {
  if (!promo) return 0;
  if (promo.discountType === "PERCENT") {
    return Math.min(
      subtotal,
      Math.round((subtotal * Number(promo.discountValue)) / 100)
    );
  }
  return Math.min(subtotal, Number(promo.discountValue) || 0);
}

async function findActivePromo(code) {
  if (!code || !String(code).trim()) return null;
  return Promo.findOne({
    code: { $regex: `^${escapeRegex(String(code).trim())}$`, $options: "i" },
    isActive: true,
  });
}

async function priceOrder({ event, requestedTickets, promoCode }) {
  const catalog = catalogTickets(event);
  const byType = new Map(
    catalog.map((t) => [String(t.type).toUpperCase(), t])
  );

  const tickets = [];
  for (const line of requestedTickets || []) {
    const qty = Number(line.qty) || 0;
    if (qty <= 0) continue;
    if (qty > 20) return { error: "Too many tickets in one order" };

    const key = String(line.type || "").toUpperCase();
    const match = byType.get(key);
    if (!match) return { error: `Unknown ticket type: ${line.type}` };

    tickets.push({
      type: match.type,
      price: Number(match.price) || 0,
      qty,
    });
  }

  if (!tickets.length) return { error: "Select at least one ticket" };

  const subtotal = tickets.reduce((sum, t) => sum + t.price * t.qty, 0);
  let discount = 0;
  let appliedCode = "";

  if (promoCode) {
    const promo = await findActivePromo(promoCode);
    if (!promo) return { error: "Invalid promo code" };
    discount = applyPromo(promo, subtotal);
    appliedCode = promo.code;
  }

  return {
    tickets,
    subtotal,
    discount,
    total: Math.max(0, subtotal - discount),
    promoCode: appliedCode,
  };
}

module.exports = { catalogTickets, findActivePromo, priceOrder, applyPromo };
