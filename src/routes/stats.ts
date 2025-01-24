import express from "express";
import {
  allCategories,
  allProducts,
  deleteProduct,
  latestProduct,
  newProduct,
  productInfo,
  searchProducts,
  updateProduct,
} from "../controllers/product.js";
import { adminOnly } from "../middlewares/auth.js";
import { singleUpload } from "../middlewares/multer.js";
import {
  dashboardStats,
  getBarCharts,
  getLineCharts,
  getpieCharts,
} from "../controllers/stats.js";

const app = express.Router();

app.get("/stats", adminOnly, dashboardStats);
app.get("/bar", adminOnly, getBarCharts);
app.get("/line", adminOnly, getLineCharts);
app.get("/pie", adminOnly, getpieCharts);

export default app;
