function parseTickets(raw) {
  let tickets = [];
  if (!raw) return tickets;
  try {
    tickets = typeof raw === "string" ? JSON.parse(raw) : raw;
  } catch {
    return null;
  }
  if (!Array.isArray(tickets)) return null;

  return tickets
    .filter(
      (t) =>
        t &&
        t.type &&
        t.price !== "" &&
        t.price !== undefined &&
        t.price !== null
    )
    .map((t) => ({
      type: String(t.type).trim(),
      price: Number(t.price),
    }))
    .filter((t) => t.type && Number.isFinite(t.price) && t.price >= 0);
}

module.exports = parseTickets;
