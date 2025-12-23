const nodemailer = require("nodemailer");
const QRCode = require("qrcode");

const sendPurchaseEmail = async (order) => {
  try {
    /* ================= SAFETY CHECK ================= */
    const recipientEmail =
      order?.user?.email || order?.purchaser?.email;

    if (!recipientEmail) return;

    /* ================= SMTP ================= */
    const transporter = nodemailer.createTransport({
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    await transporter.verify();

    /* ================= QR ================= */
    const qrPayload = String(order._id);
    const qrDataUrl = await QRCode.toDataURL(qrPayload, {
      width: 260,
      margin: 2,
      errorCorrectionLevel: "H",
    });

    const qrBuffer = Buffer.from(
      qrDataUrl.split(",")[1],
      "base64"
    );

    const ticketCount = order.tickets.reduce(
      (s, t) => s + t.qty,
      0
    );

    /* ================= EMAIL ================= */
    const mailOptions = {
      from: `"EventGhar Tickets" <${process.env.EMAIL_USER}>`,
      to: recipientEmail,
      subject: `🎟 Ticket Confirmed — ${order.eventTitle}`,

      html: `
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#eef2f7;font-family:Inter,Arial,sans-serif">

  <div style="max-width:680px;margin:40px auto;padding:0 16px">
    <div style="
      background:#ffffff;
      border-radius:20px;
      overflow:hidden;
      box-shadow:0 20px 50px rgba(0,0,0,.15)
    ">

      <!-- HEADER -->
      <div style="
        background:linear-gradient(135deg,#16a34a,#22c55e);
        padding:30px 32px;
        color:#ffffff
      ">
        <h1 style="margin:0;font-size:24px;font-weight:800">
          🎉 Ticket Confirmed
        </h1>
        <p style="margin:8px 0 0;font-size:14px;opacity:.95">
          Entry pass successfully issued
        </p>
      </div>

      <!-- BODY -->
      <div style="padding:32px">

        <p style="font-size:15px;color:#111827">
          Hi <strong>${order.user?.name || "Guest"}</strong>,
        </p>

        <p style="font-size:15px;color:#374151">
          Your payment was successful. This email is your official
          ticket confirmation.
        </p>

        <!-- TICKET CARD -->
        <div style="
          margin:26px 0;
          background:#f9fafb;
          border-radius:18px;
          padding:22px;
          border:1px dashed #d1d5db
        ">
          <h2 style="
            margin:0 0 14px;
            font-size:18px;
            font-weight:700;
            color:#111827
          ">
            ${order.eventTitle}
          </h2>

          <table style="width:100%;font-size:14px;color:#374151">
            <tr>
              <td style="padding:6px 0">🎟 Tickets</td>
              <td align="right">${ticketCount}</td>
            </tr>
            <tr>
              <td style="padding:6px 0">💰 Total Paid</td>
              <td align="right">NPR ${order.total}</td>
            </tr>
            <tr>
              <td style="padding:6px 0">🆔 Order ID</td>
              <td align="right" style="font-size:12px;color:#6b7280">
                ${order._id}
              </td>
            </tr>
          </table>
        </div>

        <!-- QR -->
        <div style="text-align:center;margin:32px 0">
          <p style="font-size:15px;font-weight:700;color:#111827">
            🎫 Scan at Event Entry
          </p>

          <div style="
            display:inline-block;
            padding:18px;
            border-radius:18px;
            background:#ffffff;
            border:2px dashed #d1d5db
          ">
            <img
              src="cid:ticketqr"
              alt="Ticket QR"
              style="width:240px;height:240px;display:block"
            />
          </div>

          <p style="font-size:13px;color:#6b7280;margin-top:12px">
            This QR is also attached for offline use
          </p>
        </div>

        <!-- CTA -->
        <div style="text-align:center;margin-top:34px">
          <a
            href="http://localhost:5173/ticket/${order._id}"
            style="
              display:inline-block;
              padding:14px 30px;
              background:#16a34a;
              color:#ffffff;
              text-decoration:none;
              border-radius:999px;
              font-weight:800;
              font-size:14px;
              box-shadow:0 12px 30px rgba(22,163,74,.35)
            "
          >
            View / Download Ticket
          </a>
        </div>
      </div>

      <!-- FOOTER -->
      <div style="
        background:#f3f4f6;
        padding:18px;
        text-align:center;
        font-size:12px;
        color:#6b7280
      ">
        <p style="margin:0">
          Present this ticket at entry · © ${new Date().getFullYear()} EventGhar
        </p>
      </div>

    </div>
  </div>

</body>
</html>
      `,

      attachments: [
        {
          filename: "event-ticket-qr.png",
          content: qrBuffer,
          cid: "ticketqr",
          contentType: "image/png",
        },
      ],
    };

    await transporter.sendMail(mailOptions);
    console.log("📧 Ticket email sent (premium UI)");
  } catch (err) {
    console.error("❌ Email failed:", err);
  }
};

module.exports = sendPurchaseEmail;
