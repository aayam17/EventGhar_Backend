const crypto = require("crypto");
const Order = require("../models/Order");
const sendTicketEmail = require("../utils/sendTicketEmail");

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

    const message = decoded.signed_field_names
      .split(",")
      .map((field) => `${field}=${decoded[field]}`)
      .join(",");

    const calculatedSignature = crypto
      .createHmac("sha256", process.env.ESEWA_SECRET_KEY)
      .update(message)
      .digest("base64");

    if (calculatedSignature !== decoded.signature) {
      console.error("Signature mismatch");
      return res.redirect("http://localhost:5173/payment-failed");
    }

    if (decoded.status === "COMPLETE") {
      await Order.findByIdAndUpdate(decoded.transaction_uuid, {
        payment: {
          method: "ESEWA",
          status: "PAID",
          transactionId: decoded.transaction_code,
        },
      });

      // ✅ ONLY redirect — NOTHING ELSE
      return res.redirect(
        `http://localhost:5173/ticket/${decoded.transaction_uuid}`
      );
    }

    return res.redirect("http://localhost:5173/payment-failed");
  } catch (err) {
    console.error("eSewa success error:", err);
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
