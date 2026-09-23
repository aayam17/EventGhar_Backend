const express = require("express");
const router = express.Router();
const FeaturedEvent = require("../models/FeaturedEvent");
const Event = require("../models/Event");
const User = require("../models/User");
const Notification = require("../models/Notification");
const upload = require("../middleware/upload");
const adminAuth = require("../middleware/adminAuth");
const jwt = require("jsonwebtoken");
const sendNewsletterEmail = require("../utils/sendNewsletterEmail");

function isAdminRequest(req) {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) return false;
    return jwt.verify(token, process.env.JWT_SECRET).role === "admin";
  } catch {
    return false;
  }
}

function dateParts(iso) {
  const dt = new Date(iso);
  if (isNaN(dt)) return { formattedDate: "", time: "" };
  return {
    formattedDate: dt.toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
    }),
    time: dt.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    }),
  };
}

function ticketsFromBody(body) {
  const tickets = [
    body.generalPrice !== undefined && body.generalPrice !== "" && {
      type: "GENERAL",
      price: Number(body.generalPrice),
    },
    body.vipPrice !== undefined && body.vipPrice !== "" && {
      type: "VIP",
      price: Number(body.vipPrice),
    },
    body.vvipPrice !== undefined && body.vvipPrice !== "" && {
      type: "VVIP",
      price: Number(body.vvipPrice),
    },
  ].filter(Boolean);

  if (!tickets.length && body.price) {
    tickets.push({ type: "GENERAL", price: Number(body.price) });
  }
  return tickets;
}

function startingPrice(tickets, fallback) {
  const prices = tickets.map((t) => Number(t.price)).filter((n) => n > 0);
  if (prices.length) return Math.min(...prices);
  return Number(fallback) || 0;
}

async function notifyUsers(event) {
  const users = await User.find({ role: "user" }).select("_id");
  if (!users.length) return;
  await Notification.insertMany(
    users.map((u) => ({
      userId: u._id,
      type: "NEW_EVENT",
      title: "📢 New Event Published",
      message: event.title,
      link: `/events/${event._id}`,
    }))
  );
}

async function linkOrCreateEvent(featuredData, body) {
  if (body.eventId) {
    const existing = await Event.findById(body.eventId);
    if (!existing) throw new Error("Selected event not found");

    existing.isFeatured = true;
    existing.featuredExpiry = featuredData.expiryDate || existing.featuredExpiry;
    if (featuredData.eventDateTime) existing.eventDateTime = featuredData.eventDateTime;
    if (featuredData.imageSrc) existing.imageSrc = featuredData.imageSrc;
    await existing.save();
    return existing;
  }

  const { formattedDate, time } = dateParts(featuredData.eventDateTime);
  const tickets = ticketsFromBody(body);
  const price = startingPrice(tickets, body.price);

  const event = await Event.create({
    title: featuredData.title,
    formattedDate: formattedDate || body.formattedDate || "TBA",
    price,
    formattedPrice: body.formattedPrice || (price ? `From Rs ${price}` : ""),
    packages: body.packages || tickets.map((t) => t.type).join(", "),
    imageSrc: featuredData.imageSrc,
    description: body.description || featuredData.subtitle || "",
    time,
    organizer: { name: body.organizerName || "EventGhar" },
    venue: {
      name: featuredData.venue || body.venueName || "",
      address: body.venueAddress || "",
    },
    tickets,
    eventDateTime: featuredData.eventDateTime,
    isFeatured: true,
    featuredExpiry: featuredData.expiryDate,
  });

  await notifyUsers(event);
  sendNewsletterEmail(event); // fire-and-forget, same as the regular event-creation route
  return event;
}

async function ensureLinkedEvents(featuredList) {
  const out = [];
  for (const featured of featuredList) {
    if (featured.eventId) {
      out.push(featured);
      continue;
    }

    let event = await Event.findOne({ title: featured.title });
    if (!event && featured.imageSrc) {
      event = await Event.create({
        title: featured.title,
        formattedDate: dateParts(featured.eventDateTime).formattedDate || "TBA",
        price: featured.price || 0,
        formattedPrice: featured.price ? `From Rs ${featured.price}` : "",
        imageSrc: featured.imageSrc,
        description: featured.subtitle || "",
        time: dateParts(featured.eventDateTime).time,
        venue: { name: featured.venue || "" },
        tickets: featured.price
          ? [{ type: "GENERAL", price: featured.price }]
          : [],
        eventDateTime: featured.eventDateTime,
        isFeatured: true,
        featuredExpiry: featured.expiryDate,
      });
    }

    if (event) {
      featured.eventId = event._id;
      featured.price = featured.price || event.price || 0;
      if (!event.isFeatured) {
        event.isFeatured = true;
        await event.save();
      }
      await featured.save();
    }
    out.push(featured);
  }
  return out;
}

/* CREATE / UPDATE FEATURED EVENT (+ linked trending event) */
router.post("/", adminAuth, upload.single("image"), async (req, res) => {
  try {
    const data = {
      title: req.body.title,
      subtitle: req.body.subtitle,
      venue: req.body.venue,
      eventDateTime: req.body.eventDateTime,
      expiryDate: req.body.expiryDate,
      isActive: req.body.isActive !== "false",
      price: Number(req.body.price) || 0,
    };

    if (req.file) data.imageSrc = req.file.path;

    if (req.body.eventId && !data.imageSrc) {
      const source = await Event.findById(req.body.eventId);
      if (source?.imageSrc) data.imageSrc = source.imageSrc;
      if (!data.title) data.title = source.title;
      if (!data.venue) data.venue = source.venue?.name || "";
      if (!data.price) data.price = source.price || 0;
    }

    if (!data.imageSrc && !req.body.id) {
      return res.status(400).json({ error: "Image is required" });
    }

    const linked = await linkOrCreateEvent(data, req.body);
    data.eventId = linked._id;
    data.price = data.price || linked.price || 0;

    const event = req.body.id
      ? await FeaturedEvent.findByIdAndUpdate(req.body.id, data, { new: true })
      : await FeaturedEvent.create(data);

    res.json(event);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* GET ACTIVE FEATURED EVENTS (AUTO HIDE EXPIRED) */
router.get("/", async (req, res) => {
  const now = new Date();

  // The admin manager needs disabled and expired slides too, otherwise a
  // disabled slide disappears and can never be switched back on.
  const showAll = req.query.all === "true" && isAdminRequest(req);

  const events = await FeaturedEvent.find(
    showAll
      ? {}
      : {
          isActive: true,
          $or: [{ expiryDate: null }, { expiryDate: { $gt: now } }],
        }
  ).sort({ order: 1 });

  const linked = await ensureLinkedEvents(events);
  const populated = await FeaturedEvent.populate(linked, { path: "eventId" });

  res.json(
    populated
      // A featured slide whose underlying event just got marked
      // cancelled (isRefundable=true) shouldn't keep showing on the
      // public dashboard hero — same rule as the trending list.
      .filter((item) => {
        const linkedEvent = item.eventId;
        const isCancelled =
          linkedEvent && typeof linkedEvent === "object" && linkedEvent.isRefundable === true;
        return !isCancelled;
      })
      .map((item) => {
        const doc = item.toObject ? item.toObject() : item;
        const linkedEvent = doc.eventId && typeof doc.eventId === "object" ? doc.eventId : null;
        return {
          ...doc,
          eventId: linkedEvent?._id || doc.eventId,
          price: doc.price || linkedEvent?.price || 0,
          imageSrc: doc.imageSrc || linkedEvent?.imageSrc,
          // Live song lives on the linked Event document, not on
          // FeaturedEvent itself — carry it through so the Hero
          // (which reads from this endpoint) can render the player.
          songUrl: linkedEvent?.songUrl || "",
          songTitle: linkedEvent?.songTitle || "",
        };
      })
  );
});

/* ENABLE / DISABLE FEATURED */
router.patch("/:id/toggle", adminAuth, async (req, res) => {
  const event = await FeaturedEvent.findById(req.params.id);
  if (!event) {
    return res.status(404).json({ error: "Featured event not found" });
  }
  event.isActive = !event.isActive;
  await event.save();
  res.json(event);
});

/* DRAG & DROP REORDER */
router.post("/reorder", adminAuth, async (req, res) => {
  const updates = req.body; // [{id, order}]

  const bulk = updates.map((e) => ({
    updateOne: {
      filter: { _id: e.id },
      update: { order: e.order },
    },
  }));

  await FeaturedEvent.bulkWrite(bulk);
  res.json({ success: true });
});

/* DELETE */
router.delete("/:id", adminAuth, async (req, res) => {
  await FeaturedEvent.findByIdAndDelete(req.params.id);
  res.json({ success: true });
});

module.exports = router;
