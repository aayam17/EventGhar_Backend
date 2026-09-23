const nodemailer = require("nodemailer");
const escapeHtml = require("./escapeHtml");
const Subscriber = require("../models/Subscriber");

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:5000";
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";

// Poster-brand palette, matched to src/index.css design tokens.
const INK = "#171717";
const PAPER = "#ffffff";
const MARIGOLD = "#ffcc00";
const RASPBERRY = "#e8192b";
const STONE_500 = "#737373";
const STONE_200 = "#e5e5e5";

function buildEmailHtml({ event, unsubscribeUrl }) {
  const eventUrl = `${FRONTEND_URL}/events/${event._id}`;
  const title = escapeHtml(event.title);
  const date = escapeHtml(event.formattedDate || "");
  const venue = escapeHtml(event.venue?.name || "");
  const price = escapeHtml(event.formattedPrice || (event.price ? `NPR ${event.price}` : ""));

  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${title}</title>
  </head>
  <body style="margin:0; padding:0; background:${STONE_200}; font-family: Georgia, 'Times New Roman', serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${STONE_200}; padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px; background:${PAPER}; border:3px solid ${INK};">

            <!-- Header band -->
            <tr>
              <td style="background:${INK}; padding:20px 28px;">
                <span style="font-family: Arial Black, Arial, sans-serif; font-weight:900; font-size:20px; letter-spacing:0.02em; color:${MARIGOLD};">
                  EVENTGHAR
                </span>
                <div style="font-family: Arial, sans-serif; font-size:11px; letter-spacing:0.12em; text-transform:uppercase; color:${PAPER}; opacity:0.7; margin-top:2px;">
                  Nepal's Ticket Home
                </div>
              </td>
            </tr>

            <!-- Eyebrow -->
            <tr>
              <td style="padding:28px 28px 0;">
                <span style="display:inline-block; font-family: Arial, sans-serif; font-size:11px; font-weight:700; letter-spacing:0.14em; text-transform:uppercase; color:${PAPER}; background:${RASPBERRY}; padding:4px 10px;">
                  New Event Just Dropped
                </span>
              </td>
            </tr>

            <!-- Event title -->
            <tr>
              <td style="padding:14px 28px 4px;">
                <h1 style="margin:0; font-family: Arial Black, Arial, sans-serif; font-weight:900; font-size:26px; line-height:1.15; color:${INK};">
                  ${title}
                </h1>
              </td>
            </tr>

            <!-- Details -->
            <tr>
              <td style="padding:10px 28px 0; font-family: Arial, sans-serif; font-size:14px; color:${INK};">
                ${date ? `<div style="margin-bottom:4px;"><strong>📅 ${date}</strong></div>` : ""}
                ${venue ? `<div style="margin-bottom:4px;">📍 ${venue}</div>` : ""}
                ${price ? `<div style="margin-bottom:4px;">🎟️ From ${price}</div>` : ""}
              </td>
            </tr>

            <!-- Ticket-stub divider -->
            <tr>
              <td style="padding:22px 28px 0;">
                <div style="border-top:2px dashed ${STONE_200};"></div>
              </td>
            </tr>

            <!-- CTA button -->
            <tr>
              <td style="padding:22px 28px 30px;" align="center">
                <a href="${eventUrl}"
                   style="display:inline-block; width:100%; box-sizing:border-box; text-align:center;
                          background:${RASPBERRY}; color:${PAPER}; text-decoration:none;
                          font-family: Arial, sans-serif; font-weight:700; font-size:15px;
                          letter-spacing:0.02em; padding:14px 20px; border:2px solid ${INK};">
                  VIEW EVENT &amp; BOOK TICKETS →
                </a>
              </td>
            </tr>

            <!-- Footer -->
            <tr>
              <td style="background:${STONE_200}; padding:18px 28px; font-family: Arial, sans-serif; font-size:11px; color:${STONE_500}; text-align:center;">
                You're getting this because you subscribed to EventGhar updates.<br/>
                <a href="${unsubscribeUrl}" style="color:${STONE_500}; text-decoration:underline;">Unsubscribe</a>
                &nbsp;·&nbsp;
                <a href="${FRONTEND_URL}" style="color:${STONE_500}; text-decoration:underline;">eventghar.com</a>
              </td>
            </tr>

          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

// Sends a "new event" email to every current subscriber, one at a time so
// each person gets a unique, working unsubscribe link. Never throws —
// a mailer hiccup should never block event creation.
module.exports = async function sendNewsletterEmail(event) {
  try {
    const subscribers = await Subscriber.find().select("email unsubscribeToken").lean();
    if (!subscribers.length) return;

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    for (const sub of subscribers) {
      const unsubscribeUrl = `${BACKEND_URL}/api/newsletter/unsubscribe?email=${encodeURIComponent(
        sub.email
      )}&token=${sub.unsubscribeToken}`;

      try {
        await transporter.sendMail({
          from: "EventGhar <no-reply@eventghar.com>",
          to: sub.email,
          subject: `New event: ${event.title}`,
          html: buildEmailHtml({ event, unsubscribeUrl }),
        });
      } catch (sendErr) {
        // One bad address shouldn't stop the rest of the list from getting the email.
        console.error(`NEWSLETTER SEND FAILED for ${sub.email}:`, sendErr.message);
      }
    }
  } catch (err) {
    console.error("NEWSLETTER SEND ERROR:", err);
  }
};
