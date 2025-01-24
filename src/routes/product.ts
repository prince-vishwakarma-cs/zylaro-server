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
  newReview,
  deleteReview,
  allReviews
} from "../controllers/product.js";
import { adminOnly } from "../middlewares/auth.js";
import { multipleUpload, singleUpload } from "../middlewares/multer.js";

const app = express.Router();

app.post("/new", multipleUpload, newProduct);
app.get("/latest", latestProduct);
app.get("/categories", allCategories);
app.get("/admin/products", adminOnly, allProducts);
app.get("/all", searchProducts);
app
  .route("/:id")
  .get(productInfo)
  .put(adminOnly, multipleUpload, updateProduct)
  .delete(adminOnly, deleteProduct);

app.get("/reviews/:id",allReviews)
app.post("/review/new/:id",newReview)
app.delete("/review/:id",adminOnly,deleteReview)

export default app;
