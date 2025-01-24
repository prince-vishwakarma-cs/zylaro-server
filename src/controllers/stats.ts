import { redis } from "../app.js";
import { TryCatch } from "../middlewares/error.js";
import { Order } from "../models/order.js";
import { Product } from "../models/product.js";
import { User } from "../models/user.js";
import { calculatePercentage, getInventories } from "../utils/features.js";

export const dashboardStats = TryCatch(async (req, res, next) => {
  let stats;

  const key = "admin-stats";

  stats = await redis.get(key);
  if (stats) stats = JSON.parse(stats);
  else {
    const today = new Date();

    const thisMonth = {
      start: new Date(today.getFullYear(), today.getMonth(), 1),
      end: today,
    };
    const lastMonth = {
      start: new Date(today.getFullYear(), today.getMonth() - 1, 1),
      end: new Date(today.getFullYear(), today.getMonth(), 0),
    };
    const sixMonthAgo = new Date();
    sixMonthAgo.setMonth(sixMonthAgo.getMonth() - 6);

    const thisMonthProductsPromise = Product.find({
      createdAt: {
        $gte: thisMonth.start,
        $lte: thisMonth.end,
      },
    });

    const lastMonthProductsPromise = Product.find({
      createdAt: {
        $gte: lastMonth.start,
        $lte: lastMonth.end,
      },
    });
    const thisMonthUsersPromise = User.find({
      createdAt: {
        $gte: thisMonth.start,
        $lte: thisMonth.end,
      },
    });

    const lastMonthUsersPromise = User.find({
      createdAt: {
        $gte: lastMonth.start,
        $lte: lastMonth.end,
      },
    });

    const thisMonthOrdersPromise = Order.find({
      createdAt: {
        $gte: thisMonth.start,
        $lte: thisMonth.end,
      },
    });

    const lastMonthOrdersPromise = Order.find({
      createdAt: {
        $gte: lastMonth.start,
        $lte: lastMonth.end,
      },
    });

    const lastSixMonthOrdersPromise = Order.find({
      createdAt: {
        $gte: sixMonthAgo,
        $lte: today,
      },
    });

    const latestTransansactionsPromise = Order.find({})
      .select(["orderItems", "discount", "total", "status"])
      .limit(4);

    const [
      thisMonthProducts,
      lastMonthProducts,
      thisMonthUsers,
      lastMonthUsers,
      thisMonthOrders,
      lastMonthOrders,
      productsCount,
      UsersCount,
      allOrders,
      lastSixMonthOrders,
      categories,
      maleUserCount,
      latestTransansactions,
    ] = await Promise.all([
      thisMonthProductsPromise,
      lastMonthProductsPromise,
      thisMonthUsersPromise,
      lastMonthUsersPromise,
      thisMonthOrdersPromise,
      lastMonthOrdersPromise,
      Product.countDocuments(),
      User.countDocuments(),
      Order.find({}).select("total"),
      lastSixMonthOrdersPromise,
      Product.distinct("category"),
      User.countDocuments({ gender: "male" }),
      latestTransansactionsPromise,
    ]);

    const thisMonthRevenue = thisMonthOrders.reduce(
      (total, order) => total + order.total,
      0
    );

    const lastMonthRevenue = lastMonthOrders.reduce(
      (total, order) => total + order.total,
      0
    );
    const changePercent = {
      revenue: calculatePercentage(thisMonthRevenue, lastMonthRevenue),
      product: calculatePercentage(
        thisMonthProducts.length,
        lastMonthProducts.length
      ),
      user: calculatePercentage(thisMonthUsers.length, lastMonthUsers.length),
      order: calculatePercentage(
        thisMonthOrders.length,
        lastMonthOrders.length
      ),
    };

    const revenue = allOrders.reduce(
      (total, order) => total + (order.total || 0),
      0
    );
    const count = {
      revenue: revenue,
      Product: productsCount,
      user: UsersCount,
      order: allOrders.length,
    };

    const orderMonthCounts = new Array(6).fill(0);
    const orderMonthData = new Array(6).fill(0);
    lastSixMonthOrders.forEach((order) => {
      const creationDate = order.createdAt;
      const monthDiff = (today.getMonth() - creationDate.getMonth() + 12) % 12;
      const month = order.createdAt.getMonth();

      if (monthDiff < 6) {
        orderMonthCounts[6 - monthDiff - 1] += 1;
        orderMonthData[6 - monthDiff - 1] += order.total;
      }
    });

    const categoryData = await getInventories({ categories, productsCount });

    const userratio = {
      male: (maleUserCount / UsersCount) * 100,
      female: ((UsersCount - maleUserCount) / UsersCount) * 100,
    };

    const modifiedLatestTransaction = latestTransansactions.map((i) => ({
      _id: i._id,
      discount: i.discount,
      amount: i.total,
      quantity: i.orderItems.length,
      status: i.status,
    }));

    stats = {
      userratio,
      categoryData,
      changePercent,
      count,
      chart: {
        order: orderMonthCounts,
        revenue: orderMonthData,
      },
      modifiedLatestTransaction,
    };

    await redis.set(key, JSON.stringify(stats));
  }
  return res.status(200).json({
    success: true,
    stats,
  });
});

export const getpieCharts = TryCatch(async (req, res, next) => {
  let charts;
  const key = "pie-charts";

  charts = await redis.get(key)
  if (charts) charts = JSON.parse(charts);
  else {
    const [
      processingOrderCount,
      shippedOrderCount,
      deliveredOrderCount,
      categories,
      productsCount,
      outOfStock,
      allOrders,
      allUsers,
      adminUsers,
      customerUsers,
    ] = await Promise.all([
      Order.countDocuments({ status: "Processing" }),
      Order.countDocuments({ status: "Shipped" }),
      Order.countDocuments({ status: "Delivered" }),
      Product.distinct("category"),
      Product.countDocuments(),
      Product.countDocuments({ stock: 0 }),
      Order.find({}).select([
        "subTotal",
        "tax",
        "shippingCharges",
        "discount",
        "total",
      ]),
      User.find({}).select(["dob"]),
      User.countDocuments({ role: "admin" }),
      User.countDocuments({ role: "user" }),
    ]);
    const orderFullfillment = {
      processing: processingOrderCount,
      shipped: shippedOrderCount,
      delivered: deliveredOrderCount,
    };

    const productCategories = await getInventories({
      categories,
      productsCount,
    });

    const stockAvailablity = {
      inStock: productsCount - outOfStock,
      outOfStock,
    };

    const grossIncome = allOrders.reduce(
      (prev, order) => prev + (order.total || 0),
      0
    );
    const discount = allOrders.reduce(
      (prev, order) => prev + (order.discount || 0),
      0
    );
    const productionCost = allOrders.reduce(
      (prev, order) => prev + (order.shippingCharges || 0),
      0
    );

    const burnt = allOrders.reduce((prev, order) => prev + (order.tax || 0), 0);

    const marketingCost = Math.round(grossIncome * (30 / 100));

    const netIncome =
      grossIncome - discount - productionCost - burnt - marketingCost;

    const revenueDistribution = {
      netIncome,
      discount,
      productionCost,
      burnt,
      marketingCost,
    };

    const CustomerDistribution = {
      admin: adminUsers,
      customer: customerUsers,
      total: adminUsers + customerUsers,
    };

    const userAgeDistribution = {
      teen: allUsers.filter((user) => user.age < 20).length,
      adult: allUsers.filter((user) => user.age >= 20 && user.age < 40).length,
      old: allUsers.filter((user) => user.age >= 40).length,
    };

    charts = {
      orderFullfillment,
      productCategories,
      stockAvailablity,
      revenueDistribution,
      userAgeDistribution,
      CustomerDistribution,
    };
    await redis.set(key, JSON.stringify(charts));
  }
  return res.status(200).json({
    success: true,
    charts,
  });
});

export const getBarCharts = TryCatch(async (req, res, next) => {
  let charts;
  const key = "bar-charts";

  charts = await redis.get(key);
  if (charts) charts = JSON.parse(charts);
  else {
    const today = new Date();

    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

    const sixMonthsProductsPromise = Product.find({
      createdAt: {
        $gte: sixMonthsAgo,
        $lte: today,
      },
    }).select("createdAt");

    const sixMonthsUsersPromise = User.find({
      createdAt: {
        $gte: sixMonthsAgo,
        $lte: today,
      },
    }).select("createdAt");

    const twelveMonthsOrdersPromise = Order.find({
      createdAt: {
        $gte: twelveMonthsAgo,
        $lte: today,
      },
    }).select("createdAt");

    const [products, users, orders] = await Promise.all([
      sixMonthsProductsPromise,
      sixMonthsUsersPromise,
      twelveMonthsOrdersPromise,
    ]);

    // For products (length: 6)
    const productData: number[] = new Array(6).fill(0);
    products.forEach((record) => {
      const creationDate = record.createdAt;
      const monthDiff = (today.getMonth() - creationDate.getMonth() + 12) % 12;
      if (monthDiff < 6) {
        productData[6 - monthDiff - 1] += 1;
      }
    });

    // For users (length: 6)
    const userData: number[] = new Array(6).fill(0);
    users.forEach((record) => {
      const creationDate = record.createdAt;
      const monthDiff = (today.getMonth() - creationDate.getMonth() + 12) % 12;
      if (monthDiff < 6) {
        userData[6 - monthDiff - 1] += 1;
      }
    });

    // For orders (length: 12)
    const orderData: number[] = new Array(12).fill(0);
    orders.forEach((record) => {
      const creationDate = record.createdAt;
      const monthDiff = (today.getMonth() - creationDate.getMonth() + 12) % 12;
      if (monthDiff < 12) {
        orderData[12 - monthDiff - 1] += 1;
      }
    });

    charts = {
      users: userData,
      products: productData,
      orders: orderData,
    };
    await redis.set(key, JSON.stringify(charts));
  }
  return res.status(200).json({
    success: true,
    charts,
  });
});

export const getLineCharts = TryCatch(async (req, res, next) => {
  let charts;
  const key = "line-charts";

  charts =await redis.get(key)
  if (charts) charts = JSON.parse(charts);
  else {
    const today = new Date();

    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

    const baseQuery = {
      createdAt: {
        $gte: twelveMonthsAgo,
        $lte: today,
      },
    };

    const [products, users, orders] = await Promise.all([
      Product.find(baseQuery).select("createdAt"),
      User.find(baseQuery).select("createdAt"),
      Order.find(baseQuery).select(["createdAt","discount","total"]),
    ]);

    // For products 
    const productData: number[] = new Array(12).fill(0);
    products.forEach((record) => {
      const creationDate = record.createdAt;
      const monthDiff = (today.getMonth() - creationDate.getMonth() + 12) % 12;
      if (monthDiff < 12) {
        productData[12 - monthDiff - 1] += 1;
      }
    });

    // For users 
    const userData: number[] = new Array(12).fill(0);
    users.forEach((record) => {
      const creationDate = record.createdAt;
      const monthDiff = (today.getMonth() - creationDate.getMonth() + 12) % 12;
      if (monthDiff < 12) {
        userData[12 - monthDiff - 1] += 1;
      }
    });

    // For discount
    const discountData: number[] = new Array(12).fill(0);
    orders.forEach((record) => {
      const creationDate = record.createdAt;
      const monthDiff = (today.getMonth() - creationDate.getMonth() + 12) % 12;
      if (monthDiff < 12) {
        discountData[12 - monthDiff - 1] += record.discount;
      }
    });
    // For revenue
    const revenueData: number[] = new Array(12).fill(0);
    orders.forEach((record) => {
      const creationDate = record.createdAt;
      const monthDiff = (today.getMonth() - creationDate.getMonth() + 12) % 12;
      if (monthDiff < 12) {
        revenueData[12 - monthDiff - 1] += record.total;
      }
    });

    charts = {
      users: userData,
      products: productData,
      discount: discountData,
      revenue: revenueData,
    };
    await redis.set(key, JSON.stringify(charts));
  }
  return res.status(200).json({
    success: true,
    charts,
  });
});
