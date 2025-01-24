import { faker } from "@faker-js/faker";
import { Request } from "express";
import { redis } from "../app.js";
import cloudinary from "../middlewares/cloudinary.js";
import { TryCatch } from "../middlewares/error.js";
import { Product } from "../models/product.js";
import { Review } from "../models/review.js";
import { User } from "../models/user.js";
import {
  BaseQuery,
  NewProductBody,
  SeachRequestQuery,
} from "../types/types.js";
import {
  deleteFromCloudinary,
  invalidateCache,
  uploadToCloudinary,
} from "../utils/features.js";
import ErrorHandler from "../utils/utility-class.js";

export const newProduct = TryCatch(
  async (req: Request<{}, {}, NewProductBody>, res, next) => {
    const { name, price, stock, category, description } = req.body;

    const photos = req.files as Express.Multer.File[] | undefined;

    if (!photos) return next(new ErrorHandler("Please upload photo", 400));
    if (photos.length < 1)
      return next(new ErrorHandler("Please upload at least one photo", 400));

    if (photos.length > 5)
      return next(new ErrorHandler("You can only upload 5 photos", 400));

    if (!name || !price || !stock || !category || !description) {
      return next(new ErrorHandler("Please enter all fields", 400));
    }

    const photourls = await uploadToCloudinary(photos);

    await Product.create({
      name,
      price,
      stock,
      description,
      category: category.toLowerCase(),
      photos: photourls,
    });

    await invalidateCache({ product: true, admin: true });

    return res.status(201).json({
      success: true,
      message: "Product created successfully",
    });
  }
);

export const latestProduct = TryCatch(async (req, res, next) => {
  let products;
  products = await redis.get("latest-products");

  if (products) {
    products = JSON.parse(products);
  } else {
    products = await Product.find({}).sort({ createdAt: -1 }).limit(5);
    await redis.set(`latest-products`, JSON.stringify(products));
  }

  return res.status(201).json({
    success: true,
    products,
  });
});

export const updateProduct = TryCatch(async (req, res, next) => {
  const id = req.params.id;
  const { name, price, stock, category, description } = req.body;

  const photos = req.files as Express.Multer.File[] | undefined;

  const product = await Product.findById(id);

  if (!product) return next(new ErrorHandler("Product not found", 400));

  if (photos && photos.length > 0) {
    const photourl = await uploadToCloudinary(photos);

    const IDs = product.photos.map((photo) => photo.public_id);

    await deleteFromCloudinary(IDs);

    product.photos = photourl;
  }

  if (name) product.name = name;
  if (price) product.price = price;
  if (stock) product.stock = stock;
  if (category) product.category = category;
  if (description) product.description = description;
  await product.save();

  await invalidateCache({
    product: true,
    productId: String(product._id),
    admin: true,
  });

  return res.status(201).json({
    success: true,
    message: "Product updates successfully",
  });
});

export const productInfo = TryCatch(async (req, res, next) => {
  let product;
  const id = req.params.id;
  product = await redis.get(`product-${id}`);
  if (product) product = JSON.parse(product);
  else {
    product = await Product.findById(id);
    if (!product) return next(new ErrorHandler("Product not found", 400));
    await redis.set(`product-${id}`, JSON.stringify(product));
  }

  return res.status(201).json({
    success: true,
    product,
  });
});

export const allCategories = TryCatch(async (req, res, next) => {
  let categories;

  categories = await redis.get("categories");
  if (categories) categories = JSON.parse(categories);
  else {
    categories = await Product.distinct("category");
    await redis.set(`categories`, JSON.stringify(categories));
  }
  return res.status(201).json({
    success: true,
    categories,
  });
});

export const allProducts = TryCatch(async (req, res, next) => {
  let products;

  products = await redis.get("all-products");
  if (products) products = JSON.parse(products);
  else {
    products = await Product.find({});
    await redis.set(`all-products`, JSON.stringify(products));
  }
  return res.status(201).json({
    success: true,
    products,
  });
});

export const deleteProduct = TryCatch(async (req, res, next) => {
  const id = req.params.id;
  const product = await Product.findById(id);
  if (!product) return next(new ErrorHandler("Product not found", 400));

  const IDs = product.photos.map((photo) => photo.public_id);

  await deleteFromCloudinary(IDs);
  await product.deleteOne();

  await invalidateCache({
    product: true,
    productId: String(product._id),
    admin: true,
  });
  return res.status(201).json({
    success: true,
    message: "Product deleted successfully",
  });
});

export const searchProducts = TryCatch(
  async (req: Request<{}, {}, SeachRequestQuery>, res, next) => {
    // console.log("gfgd");
    const { search, sort, category, price } = req.query;
    const page = Number(req.query.page) || 1;

    // const cacheKey = `search-${search}-${sort}-${category}-${price}-${page}`;

    let products;
    let totalPages;
    // const cacheddata = await redis.get(cacheKey);

    // if (cacheddata) {
    //   const data = JSON.parse(cacheddata);
    //   totalPages = data.totalPages;
    //   products = data.products;
    // } else {
      const limit = Number(process.env.PRODUCT_PER_PAGE) || 8;
      const skip = (page - 1) * limit;

      const baseQuery: BaseQuery = {};

      if (search) baseQuery.name = { $regex: String(search), $options: "i" };
      if (price) baseQuery.price = { $lte: Number(price) };
      if (category) baseQuery.category = String(category);

      const [productsFetched, filterdOnlyProducts] = await Promise.all([
        Product.find(baseQuery)
          .sort(sort && { price: sort === "asc" ? 1 : -1 })
          .skip(skip)
          .limit(limit),
        Product.find(baseQuery),
      ]);

      products = productsFetched;

      totalPages = Math.ceil(filterdOnlyProducts.length / limit);

    //   await redis.setex(cacheKey, 30, JSON.stringify({ products, totalPages }));
    // }

    return res.status(201).json({
      success: true,
      products,
      totalPages,
    });
  }
);

export const allReviews = TryCatch(async (req, res, next) => {
  let reviews;
  const product = await Product.findById(req.params.id);
  if (!product) return next(new ErrorHandler("Product not found", 404));

  const key = `product-${product._id}-reviews`;

  reviews = await redis.get(key);

  if (reviews) reviews = JSON.parse(reviews);
  else {
    reviews = await Review.find({ product: product._id })
      .populate("user", "name photo")
      .sort({ updated: -1 });

    await redis.set(key, JSON.stringify(reviews));
  }

  return res.status(200).json({
    success: true,
    reviews,
  });
});

export const newReview = TryCatch(async (req, res, next) => {
  const user = await User.findById(req.query.id);
  if (!user) return next(new ErrorHandler("Please login to review", 400));

  const product = await Product.findById(req.params.id);
  if (!product) return next(new ErrorHandler("Product not found", 400));

  const { rating, comment } = req.body;
  if (!rating) return next(new ErrorHandler("Please provide a rating", 400));

  const existingReview = await Review.findOne({
    product: req.params.id,
    user: req.query.id,
  });

  if (existingReview) {
    existingReview.rating = Number(rating) || existingReview.rating;
    existingReview.comment = comment || existingReview.comment;
    await existingReview.save();
  } else {
    const newReview = {
      rating: Number(rating),
      comment,
      user: req.query.id,
      product: req.params.id,
    };

    await Review.create(newReview);
  }

  const reviews = await Review.find({ product: req.params.id });

  if (reviews.length > 0) {
    const totalRating = reviews.reduce((sum, review) => sum + review.rating, 0);
    product.ratings = Math.floor(totalRating / reviews.length);
  } else {
    product.ratings = 0;
  }

  product.numReviews = reviews.length;

  await product.save();

  await invalidateCache({
    product:true,
    productId: req.params.id,
    admin: true,
    review:true
  });

  return res.status(201).json({
    success: true,
    message: existingReview
      ? "Review Updated Succesfully"
      : `Review added successfully`,
  });
});

export const deleteReview = TryCatch(async (req, res, next) => {
  const user = await User.findById(req.query.id);
  if (!user)
    return next(new ErrorHandler("Please log in to perform this action", 400));

  const review = await Review.findById(req.params.id);
  if (!review) return next(new ErrorHandler("Review not found", 404));

  if (review.user.toString() !== req.query.id && user.role !== "admin") {
    return next(
      new ErrorHandler("You are not authorized to delete this review", 403)
    );
  }

  await review.deleteOne();

  const product = await Product.findById(review.product);
  if (!product)
    return next(new ErrorHandler("Associated product not found", 404));

  const reviews = await Review.find({ product: review.product });

  if (reviews.length > 0) {
    const totalRating = reviews.reduce((sum, review) => sum + review.rating, 0);
    product.ratings = Math.floor(totalRating / reviews.length);
  } else {
    product.ratings = 0;
  }

  product.numReviews = reviews.length;

  await product.save();

  await invalidateCache({
    product:true,
    review:true,
    productId: String(product._id),
    admin: true,
  });

  res.status(200).json({
    success: true,
    message: "Review deleted successfully",
  });
});

export const generateRandomProducts = async (count: number = 10) => {
  const products = [];
  for (let i = 0; i < count; i++) {
    products.push({
      name: faker.commerce.productName(),
      photo: "uploads\\175d54eb-fe7a-4426-9cc2-c37117c6cd74.png",
      price: faker.commerce.price({ min: 1500, max: 80000, dec: 0 }),
      stock: faker.commerce.price({ min: 0, max: 100, dec: 0 }),
      category: faker.commerce.department(),
      createdAt: new Date(faker.date.past()),
      updatedAt: new Date(faker.date.recent()),
      __v: 0,
    });
  }
  await Product.create(products);

  console.log("Products generated successfully");
};

export const deleteRandomProducts = async (count: number = 10) => {
  const products = await Product.find({}).skip(count);
  products.forEach(async (product) => {
    try {
      if (product.photos) {
        const publicId = product.photos[0].url.split("/").pop()?.split(".")[0];
        if (publicId) {
          await cloudinary.uploader.destroy(
            `${process.env.CLOUDINARY_FOLDER}/${publicId}`
          );
        }
      }
    } catch (error) {
      console.error("Cloudinary Error:", error);
    }
    await product.deleteOne();
  });
  console.log("Products deleted successfully");
};
