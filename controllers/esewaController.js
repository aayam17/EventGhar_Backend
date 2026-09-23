const crypto = require("crypto");
const Order = require("../models/Order");
const sendPurchaseEmail = require("../utils/sendPurchaseEmail");
const Notification = require("../models/Notification");

const frontendUrl = () => process.env.FRONTEND_URL || "http://localhost:5173";
const backendUrl = () => process.env.BACKEND_URL || "http://localhost:5001";
const productCode = () => process.env.ESEWA_PRODUCT_CODE || "EPAYTEST";

function paidAmount(decoded) {
  const raw = decoded.total_amount ?? decoded.amount;
  return Math.round(Number(raw));
}

exports.initiatePayment = async (req, res) => {
  try {
    const { orderId } = req.body;
    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }
    if (String(order.user?.id) !== String(req.userId)) {
      return res.status(403).json({ message: "Not your order" });
    }
    if (order.payment?.status === "PAID") {
      return res.status(400).json({ message: "This order is already paid" });
    }
    if (!order.total || order.total <= 0) {
      return res.status(400).json({ message: "This order does not need eSewa" });
    }

    const amount = String(Math.round(order.total));
    const transaction_uuid = String(order._id);
    const product_code = productCode();

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
      success_url: `${backendUrl()}/api/esewa/payment-success`,
      failure_url: `${backendUrl()}/api/esewa/payment-failure`,
      signed_field_names,
      signature,
      form_url:
        process.env.ESEWA_FORM_URL ||
        "https://rc-epay.esewa.com.np/api/epay/main/v2/form",
    });
  } catch (err) {
    console.error("eSewa init error:", err);
    res.status(500).json({ message: "eSewa init failed" });
  }
};

exports.handlePaymentSuccess = async (req, res) => {
  const fail = `${frontendUrl()}/payment-failed`;
  try {
    const { data } = req.query;
    if (!data) return res.redirect(fail);

    const decoded = JSON.parse(Buffer.from(data, "base64").toString("utf-8"));

    const message = decoded.signed_field_names
      .split(",")
      .map((field) => `${field}=${decoded[field]}`)
      .join(",");

    const calculatedSignature = crypto
      .createHmac("sha256", process.env.ESEWA_SECRET_KEY)
      .update(message)
      .digest("base64");

    if (calculatedSignature !== decoded.signature) {
      console.error("eSewa signature mismatch");
      return res.redirect(fail);
    }

    if (decoded.status !== "COMPLETE") return res.redirect(fail);

    const order = await Order.findById(decoded.transaction_uuid);
    if (!order) return res.redirect(fail);

    if (paidAmount(decoded) !== Math.round(Number(order.total))) {
      console.error("eSewa amount mismatch", decoded.total_amount, order.total);
      return res.redirect(fail);
    }

    if (order.payment?.status === "PAID") {
      return res.redirect(`${frontendUrl()}/ticket/${order._id}`);
    }

    order.payment = {
      method: "ESEWA",
      status: "PAID",
      transactionId: decoded.transaction_code,
    };

    if (!order.purchaser?.id) {
      order.purchaser = {
        id: order.user.id,
        name: order.user.name,
        email: order.user.email,
      };
    }

    await order.save();

    await Notification.create({
      userId: order.user.id,
      type: "TICKET_PURCHASE",
      title: "🎟 Ticket Confirmed",
      message: `Your ticket for ${order.eventTitle} has been confirmed.`,
      link: `/ticket/${order._id}`,
    });

    try {
      await sendPurchaseEmail(order);
    } catch (emailErr) {
      console.error("Purchase email failed:", emailErr);
    }

    return res.redirect(`${frontendUrl()}/ticket/${order._id}`);
  } catch (err) {
    console.error("eSewa success error:", err);
    return res.redirect(fail);
  }
};

exports.handlePaymentFailure = (req, res) => {
  console.log("eSewa payment failed:", req.query);
  res.redirect(`${frontendUrl()}/payment-failed`);
};
