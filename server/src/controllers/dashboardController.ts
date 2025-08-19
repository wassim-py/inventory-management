import { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export const getDashboardMetrics = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { startDate, endDate } = req.query;
    
    // Build date filter
    const dateFilter: any = {};
    if (startDate || endDate) {
      if (startDate) dateFilter.gte = new Date(startDate.toString());
      if (endDate) dateFilter.lte = new Date(endDate.toString());
    }
    
    // Current Capital (from finances ledger)
    const financialSummary = await prisma.financesLedger.aggregate({
      where: dateFilter.gte || dateFilter.lte ? { date: dateFilter } : {},
      _sum: {
        moneyIn: true,
        moneyOut: true
      }
    });
    
    const currentCapital = (financialSummary._sum.moneyIn || 0) - (financialSummary._sum.moneyOut || 0);
    
    // Revenue and Profit calculations
    const deliveredOrders = await prisma.orders.findMany({
      where: {
        status: 'DELIVERED',
        ...(dateFilter.gte || dateFilter.lte ? { orderDate: dateFilter } : {})
      },
      include: {
        orderLineItems: {
          include: {
            variant: true
          }
        }
      }
    });
    
    let totalRevenue = 0;
    let totalCOGS = 0;
    
    for (const order of deliveredOrders) {
      totalRevenue += order.finalPrice;
      
      // Calculate COGS for this order
      for (const item of order.orderLineItems) {
        totalCOGS += item.variant.costPrice * item.quantity;
      }
    }
    
    const grossProfit = totalRevenue - totalCOGS;
    
    // Get marketing costs
    const marketingCosts = await prisma.financesLedger.aggregate({
      where: {
        type: 'MARKETING',
        ...(dateFilter.gte || dateFilter.lte ? { date: dateFilter } : {})
      },
      _sum: { moneyOut: true }
    });
    
    const netProfit = grossProfit - (marketingCosts._sum.moneyOut || 0);
    
    // Average Order Value
    const orderStats = await prisma.orders.aggregate({
      where: {
        status: 'DELIVERED',
        ...(dateFilter.gte || dateFilter.lte ? { orderDate: dateFilter } : {})
      },
      _avg: { finalPrice: true },
      _count: true
    });
    
    const averageOrderValue = orderStats._avg.finalPrice || 0;
    
    // Return Rate
    const totalOrders = await prisma.orders.count({
      where: dateFilter.gte || dateFilter.lte ? { orderDate: dateFilter } : {}
    });
    
    const returnedOrders = await prisma.orders.count({
      where: {
        status: 'RETURNED',
        ...(dateFilter.gte || dateFilter.lte ? { orderDate: dateFilter } : {})
      }
    });
    
    const returnRate = totalOrders > 0 ? (returnedOrders / totalOrders) * 100 : 0;
    
    // Top 5 Best-Selling Products by Net Profit
    const productProfitability = await prisma.$queryRaw`
      SELECT 
        p.name,
        p."productId",
        SUM((oli."actualSalePrice" - v."costPrice") * oli.quantity) as net_profit,
        SUM(oli.quantity) as total_sold
      FROM "Products" p
      JOIN "Variants" v ON p."productId" = v."productId"
      JOIN "OrderLineItems" oli ON v.sku = oli.sku
      JOIN "Orders" o ON oli."orderId" = o."orderId"
      WHERE o.status = 'DELIVERED'
      ${dateFilter.gte || dateFilter.lte ? `AND o."orderDate" >= '${dateFilter.gte || '1900-01-01'}' AND o."orderDate" <= '${dateFilter.lte || '2100-01-01'}'` : ''}
      GROUP BY p."productId", p.name
      ORDER BY net_profit DESC
      LIMIT 5
    `;
    
    // Revenue vs Profit chart data (last 30 days)
    const chartEndDate = new Date();
    const chartStartDate = new Date();
    chartStartDate.setDate(chartStartDate.getDate() - 30);
    
    const dailyData = await prisma.$queryRaw`
      SELECT 
        DATE(o."orderDate") as date,
        SUM(o."finalPrice") as revenue,
        SUM((oli."actualSalePrice" - v."costPrice") * oli.quantity) as profit
      FROM "Orders" o
      JOIN "OrderLineItems" oli ON o."orderId" = oli."orderId"
      JOIN "Variants" v ON oli.sku = v.sku
      WHERE o.status = 'DELIVERED' 
      AND o."orderDate" >= $1 
      AND o."orderDate" <= $2
      GROUP BY DATE(o."orderDate")
      ORDER BY date ASC
    `;
    
    // Recent Orders
    const recentOrders = await prisma.orders.findMany({
      take: 5,
      orderBy: { orderDate: 'desc' },
      include: {
        orderLineItems: {
          include: {
            variant: {
              include: { product: true }
            }
          }
        }
      }
    });
    
    // Low Stock Items
    const lowStockItems = await prisma.variants.findMany({
      where: { stockOnHand: { lte: 10 } },
      include: { product: true },
      orderBy: { stockOnHand: 'asc' },
      take: 5
    });
    
    res.json({
      kpis: {
        currentCapital,
        netProfit,
        grossProfit,
        averageOrderValue,
        returnRate
      },
      charts: {
        revenueVsProfit: dailyData,
        topProducts: productProfitability
      },
      recentOrders,
      lowStockItems,
      summary: {
        totalRevenue,
        totalCOGS,
        totalOrders,
        deliveredOrders: deliveredOrders.length
      }
    });
  } catch (error) {
    console.error("Error retrieving dashboard metrics:", error);
    res.status(500).json({ message: "Error retrieving dashboard metrics" });
  }
};

export const getFinancialOverview = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { startDate, endDate } = req.query;
    
    const dateFilter: any = {};
    if (startDate || endDate) {
      if (startDate) dateFilter.gte = new Date(startDate.toString());
      if (endDate) dateFilter.lte = new Date(endDate.toString());
    }
    
    // Get all transactions grouped by type
    const transactionsByType = await prisma.financesLedger.groupBy({
      by: ['type'],
      where: dateFilter.gte || dateFilter.lte ? { date: dateFilter } : {},
      _sum: {
        moneyIn: true,
        moneyOut: true
      }
    });
    
    // Format for response
    const financialBreakdown = transactionsByType.map(item => ({
      type: item.type,
      income: item._sum.moneyIn || 0,
      expense: item._sum.moneyOut || 0,
      net: (item._sum.moneyIn || 0) - (item._sum.moneyOut || 0)
    }));
    
    // Monthly trends
    const monthlyTrends = await prisma.$queryRaw`
      SELECT 
        DATE_TRUNC('month', date) as month,
        SUM("moneyIn") as total_income,
        SUM("moneyOut") as total_expenses
      FROM "FinancesLedger"
      ${dateFilter.gte || dateFilter.lte ? `WHERE date >= '${dateFilter.gte || '1900-01-01'}' AND date <= '${dateFilter.lte || '2100-01-01'}'` : ''}
      GROUP BY DATE_TRUNC('month', date)
      ORDER BY month ASC
    `;
    
    res.json({
      financialBreakdown,
      monthlyTrends
    });
  } catch (error) {
    console.error("Error retrieving financial overview:", error);
    res.status(500).json({ message: "Error retrieving financial overview" });
  }
};