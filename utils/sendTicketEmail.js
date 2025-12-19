// utils/sendTicketEmail.js
const nodemailer = require("nodemailer");

module.exports = async (order) => {
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  await transporter.sendMail({
    from: "Event Ghar <no-reply@eventghar.com>",
    to: order.user.email,
    subject: "🎫 Your Event Ticket",
    html: `
      <h2>${order.eventTitle}</h2>
      <p>Name: ${order.user.name}</p>
      <p>Total Paid: NPR ${order.total}</p>
      <p>Ticket ID: ${order._id}</p>
      <p>Show QR at entry</p>
    `,
  });
};
