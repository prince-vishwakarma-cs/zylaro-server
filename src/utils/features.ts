import { v2 as cloudinary, UploadApiResponse } from "cloudinary";
import { Redis } from "ioredis";
import mongoose from "mongoose";
import { redis } from "../app.js";
import { Product } from "../models/product.js";
import { InvalidateCacheProps, OderItem } from "../types/types.js";

export const connectDB = (uri: string) => {
  mongoose
    .connect(uri)
    .then((c) => console.log("Database Connected"))
    .catch((e) => console.log(e));
};

export const connectRedis = (redisURI:string) =>
{
  const redis = new Redis(redisURI);
  redis.on("connect",()=>console.log("Redis connected" ));
  redis.on("error",(e)=>console.log(e));
  return redis;
}

const getBase64 = (file: Express.Multer.File) => `data:${file.mimetype};base64,${file.buffer.toString('base64')}`;

export const uploadToCloudinary = async (files: Express.Multer.File[]) => {
  const promises=files.map(async (file) => {
    return new Promise<UploadApiResponse>((resolve, reject) => {
      cloudinary.uploader.upload(getBase64(file), (error, result) => {
        if (error) return reject(error);
        resolve(result!);
      });
    });
  })

  const result = await Promise.all(promises);

  return result.map((r) => ({
    public_id: r.public_id,
    url: r.secure_url,
  }));
}

export const deleteFromCloudinary= async(publicIds:string[])=>{
  const promises = publicIds.map((id) => {
    return new Promise<void>((resolve, reject) => {
      cloudinary.uploader.destroy(id, (error, result) => {
        if (error) return reject(error);
        resolve();
      })
    })
  })

}

export const invalidateCache =async  ({
  product,
  order,
  admin,
  userId,
  orderId,
  productId,
  review,
}: InvalidateCacheProps) => {
  if(review){
    await redis.del([`product-${productId}-reviews`]);
  }
  if (product) {
    const productKeys: string[] = [
      `categories`,
      `latest-products`,
      `all-products`,
    ];

    if (typeof productId === "string") productKeys.push(`product-${productId}`);
    else if (typeof productId === "object") {
      productId.forEach((i) => productKeys.push(`product-${i}`));
    }

    await redis.del(productKeys);
  }
  if (order) {
    const ordersKeys: string[] = [
      `all-orders`,
      `my-orders-${userId}`,
      `order-${orderId}`,
    ];

    await redis.del(ordersKeys);
  }
  if (admin) {
    await redis.del(["admin-stats", "pie-charts", "bar-charts", "line-charts"]);
  }
};

export const reduceStack = async (orderItems: OderItem[]) => {
  let stock = 0;
  orderItems.forEach(async (item) => {
    const product = await Product.findById(item.productId);
    if (!product) throw new Error("Product not found");
    product.stock -= item.quantity;
    await product.save();
  });
};

export const calculatePercentage = (thisMonth: number, lastMonth: number) => {
  if (lastMonth === 0) return thisMonth * 100;
  const percent = ((thisMonth - lastMonth) / lastMonth) * 100;
  return Number(percent.toFixed(0));
};

export const getInventories = async ({
  categories,
  productsCount,
}: {
  categories: string[];
  productsCount: number;
}) => {
  const categoriesCountPromise = categories.map((category) =>
    Product.countDocuments({ category })
  );

  const categoriesCount = await Promise.all(categoriesCountPromise);

  const categoryCount: Record<string, number>[] = [];

  categories.forEach((category, i) => {
    categoryCount.push({
      [category]: Math.round((categoriesCount[i] / productsCount) * 100),
    });
  });

  return categoryCount;
};
