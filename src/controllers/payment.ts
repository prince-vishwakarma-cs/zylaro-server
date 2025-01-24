import { redis, stripe } from "../app.js";
import { TryCatch } from "../middlewares/error.js";
import { Coupon } from "../models/coupon.js";
import ErrorHandler from "../utils/utility-class.js";


export const createPaymentIntent = TryCatch(async (req, res, next) => {
  const { amount } = req.body;

  if (!amount) return next(new ErrorHandler("Please enter amount", 400));

  const paymentIntent = await stripe.paymentIntents.create({
    amount: Number(amount) * 100,
    currency: "inr",
  });

  return res.status(201).json({
    success: true,
    clientSecret: paymentIntent.client_secret,
  });
});3

export const newCoupon = TryCatch(async (req, res, next) => {
  const { code, amount } = req.body;

  console.log(req.body)
  if (!code || !amount)
    return next(new ErrorHandler("Please enter all fields", 400));
  await Coupon.create({ code, amount });

  return res.status(201).json({
    success: true,
    message: `Coupon ${code} Created Successfully`,
  });
});

export const getAllCoupons = TryCatch(async (req, res, next) => {
  const coupons = await Coupon.find({});

  return res.status(201).json({
    success: true,
    coupons,
  });
});

export const applyCoupon = TryCatch(async (req, res, next) => {
  const { code } = req.query;

  const validCoupon = await Coupon.findOne({ code });

  if (!validCoupon) return next(new ErrorHandler("Invalid Coupon Code", 400));

  return res.status(200).json({
    success: true,
    message: "Coupon Applied Successfully",
    discount: validCoupon.amount,
  });
});

export const deleteCoupon = TryCatch(async (req, res, next) => {
  const { id } = req.params;

  const coupon = await Coupon.findByIdAndDelete(id);

  if (!coupon) return next(new ErrorHandler("Invalid Coupon Id", 400));

  return res.status(200).json({
    success: true,
    message: "Coupon Deleted Successfully",
  });
});


export const updateCoupon = TryCatch(async (req, res, next) => {
  const { code, amount } = req.body;
  const { id } = req.params;

  const coupon = await Coupon.findById(id);

  console.log(`code : ${code} amount : ${amount}`);

  if (!coupon) return next(new ErrorHandler("Invalid Coupon Id", 400));

  coupon.code = code || coupon.code; // Use existing value if code is not provided
  coupon.amount = amount || coupon.amount;

  await coupon.save();

  return res.status(200).json({
    success: true,
    message: `Coupon Updated Successfully with code : ${code} and amount : ${amount} `,
  });
});


export const couponInfo = TryCatch(async (req, res, next) => {
  let coupon
  const { id } = req.params;

  coupon = await redis.get(`coupon-${id}`);
  if(coupon) coupon = JSON.parse(coupon);
  else {
    coupon = await Coupon.findById(id);
    if(!coupon) return next(new ErrorHandler("Coupon not found", 400));
    await redis.set(`coupon-${id}`, JSON.stringify(coupon));
  }

  return res.status(201).json({
    success: true,
    coupon,
  });
})