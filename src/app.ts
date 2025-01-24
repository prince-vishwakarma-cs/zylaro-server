import express from "express";
import userRoute from "./routes/user.js";
import { connectDB, connectRedis } from "./utils/features.js";
import { errorMiddleware } from "./middlewares/error.js";
import productRoute from "./routes/product.js";
import orderRoute from "./routes/order.js";
import paymentRoute from "./routes/payment.js";
import { config } from "dotenv";
import morgan from "morgan";
import dashboardRoute from "./routes/stats.js";
import Stripe from "stripe";
import cors from "cors";

config({
  path: "./.env",
});

const port = process.env.PORT;
const mongourl = process.env.MONGO_URL || "";
const stripekey = process.env.STRIPE_KEY || "";
const redisURI = process.env.REDIS_URI || "";
export const redisTTL = process.env.REDIS_TTL || 60 * 60 *4;

const app = express();
connectDB(mongourl);
export const redis = connectRedis(redisURI);

export const stripe = new Stripe(stripekey);
app.use(express.json());
app.use(morgan("dev"));
app.use(cors({
  origin: "*",  // Allow all origins
  methods: ["GET", "POST", "PUT", "DELETE"],
  credentials: true, // Allow cookies to be sent with cross-origin requests
}));


app.get("/", (req, res) => {
  res.send("it is working");
});

app.use("/api/v1/user", userRoute);
app.use("/api/v1/product", productRoute);
app.use("/api/v1/order", orderRoute);
app.use("/api/v1/payment", paymentRoute);
app.use("/api/v1/dashboard", dashboardRoute);

app.use("/uploads", express.static("uploads"));

app.use(errorMiddleware);

app.listen(port, () => {
  console.log(`server is running on localhost ${port}`);
});
