const nodemailer = require("nodemailer");
const escapeHtml = require("./escapeHtml");

module.exports = async (order) => {
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  const ticketUrl = `${process.env.FRONTEND_URL || "http://localhost:5173"}/ticket/${order._id}`;

  await transporter.sendMail({
    from: "Event Ghar <no-reply@eventghar.com>",
    to: order.user.email,
    subject: "Your Event Ticket",
    html: `
      <h2>${escapeHtml(order.eventTitle)}</h2>
      <p>Name: ${escapeHtml(order.user.name)}</p>
      <p>Total Paid: NPR ${escapeHtml(order.total)}</p>
      <p><a href="${ticketUrl}">View your ticket</a></p>
      <p>Show QR at entry</p>
    `,
  });
};
