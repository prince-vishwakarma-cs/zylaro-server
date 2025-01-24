import express from "express";
import {
  applyCoupon,
  couponInfo,
  createPaymentIntent,
  deleteCoupon,
  getAllCoupons,
  newCoupon,
  updateCoupon,
} from "../controllers/payment.js";
import { adminOnly } from "../middlewares/auth.js";

const app = express.Router();

app.post("/create", createPaymentIntent);
app.post("/coupon/new", adminOnly, newCoupon);
app.get("/coupon/all", adminOnly, getAllCoupons);
app.get("/discount", applyCoupon);
app
  .route("/coupon/:id")
  .get(couponInfo)
  .put(adminOnly,updateCoupon)
  .delete(adminOnly, deleteCoupon);

export default app;
