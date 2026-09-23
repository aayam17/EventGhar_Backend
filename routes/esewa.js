const express = require("express");
const router = express.Router();
const auth = require("../middleware/auth");
const {
  initiatePayment,
  handlePaymentSuccess,
  handlePaymentFailure,
} = require("../controllers/esewaController");

router.post("/initiate-payment", auth, initiatePayment);
router.get("/payment-success", handlePaymentSuccess);
router.get("/payment-failure", handlePaymentFailure);

module.exports = router;
