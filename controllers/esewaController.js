const crypto = require("crypto");
const Order = require("../models/Order");
const sendPurchaseEmail = require("../utils/sendPurchaseEmail");
const Notification = require("../models/Notification"); // ✅ ADDED

/* ===============================
   INITIATE PAYMENT (eSewa v2)
================================ */
exports.initiatePayment = async (req, res) => {
  try {
    const { orderId } = req.body;

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    const amount = String(Math.round(order.total));
    const transaction_uuid = orderId;
    const product_code = "EPAYTEST";

    const signed_field_names =
      "amount,tax_amount,total_amount,transaction_uuid,product_code";

    const signatureString =
      `amount=${amount},` +
      `tax_amount=0,` +
      `total_amount=${amount},` +
      `transaction_uuid=${transaction_uuid},` +
      `product_code=${product_code}`;

    const signature = crypto
      .createHmac("sha256", process.env.ESEWA_SECRET_KEY)
      .update(signatureString)
      .digest("base64");

    res.json({
      amount,
      tax_amount: "0",
      total_amount: amount,
      transaction_uuid,
      product_code,
      product_service_charge: "0",
      product_delivery_charge: "0",
      success_url: "http://localhost:5001/api/esewa/payment-success",
      failure_url: "http://localhost:5001/api/esewa/payment-failure",
      signed_field_names,
      signature,
    });
  } catch (err) {
    console.error("❌ eSewa init error:", err);
    res.status(500).json({ message: "eSewa init failed" });
  }
};

/* ===============================
   SUCCESS CALLBACK
================================ */
exports.handlePaymentSuccess = async (req, res) => {
  try {
    const { data } = req.query;
    if (!data) {
      return res.redirect("http://localhost:5173/payment-failed");
    }

    const decoded = JSON.parse(
      Buffer.from(data, "base64").toString("utf-8")
    );

    /* ================= VERIFY SIGNATURE ================= */
    const message = decoded.signed_field_names
      .split(",")
      .map((field) => `${field}=${decoded[field]}`)
      .join(",");

    const calculatedSignature = crypto
      .createHmac("sha256", process.env.ESEWA_SECRET_KEY)
      .update(message)
      .digest("base64");

    if (calculatedSignature !== decoded.signature) {
      console.error("❌ Signature mismatch");
      return res.redirect("http://localhost:5173/payment-failed");
    }

    /* ================= PAYMENT COMPLETE ================= */
    if (decoded.status === "COMPLETE") {
      const order = await Order.findById(decoded.transaction_uuid);
      if (!order) {
        return res.redirect("http://localhost:5173/payment-failed");
      }

      /* ✅ PREVENT DOUBLE PROCESSING */
      if (order.payment?.status === "PAID") {
        return res.redirect(
          `http://localhost:5173/ticket/${order._id}`
        );
      }

      /* ✅ SET PAYMENT */
      order.payment = {
        method: "ESEWA",
        status: "PAID",
        transactionId: decoded.transaction_code,
      };

      /* ✅ SET PURCHASER (CRITICAL) */
      if (!order.purchaser?.id) {
        order.purchaser = {
          id: order.user.id,
          name: order.user.name,
          email: order.user.email,
        };
      }

      await order.save();

      /* ================= 🔔 NOTIFICATION (STEP 3) ================= */
      await Notification.create({
        userId: order.user.id,
        type: "TICKET_PURCHASE",
        title: "🎟 Ticket Confirmed",
        message: `Your ticket for ${order.eventTitle} has been confirmed.`,
        link: `/ticket/${order._id}`,
      });

      /* ✅ SEND PURCHASE EMAIL (ONLY ONCE) */
      try {
        await sendPurchaseEmail(order);
      } catch (emailErr) {
        console.error("❌ Purchase email failed:", emailErr);
      }

      /* ✅ REDIRECT USER */
      return res.redirect(
        `http://localhost:5173/ticket/${order._id}`
      );
    }

    return res.redirect("http://localhost:5173/payment-failed");
  } catch (err) {
    console.error("❌ eSewa success error:", err);
    return res.redirect("http://localhost:5173/payment-failed");
  }
};

/* ===============================
   FAILURE CALLBACK
================================ */
exports.handlePaymentFailure = (req, res) => {
  console.log("❌ eSewa payment failed:", req.query);
  res.redirect("http://localhost:5173/payment-failed");
};
