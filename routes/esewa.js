const express = require("express");
const router = express.Router();
const {
  initiatePayment,
  handlePaymentSuccess,
  handlePaymentFailure,
} = require("../controllers/esewaController");

router.post("/initiate-payment", initiatePayment);
router.get("/payment-success", handlePaymentSuccess);
router.get("/payment-failure", handlePaymentFailure);

module.exports = router;
