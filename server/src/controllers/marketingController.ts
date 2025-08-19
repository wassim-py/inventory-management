import { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Marketing Campaigns Management
export const getMarketingCampaigns = async (req: Request, res: Response): Promise<void> => {
  try {
    const { status, productId, startDate, endDate } = req.query;
    
    const where: any = {};
    if (status) where.status = status;
    if (productId) where.productId = productId.toString();
    if (startDate || endDate) {
      where.startDate = {};
      if (startDate) where.startDate.gte = new Date(startDate.toString());
      if (endDate) where.startDate.lte = new Date(endDate.toString());
    }
    
    const campaigns = await prisma.marketingCampaigns.findMany({
      where,
      include: {
        product: {
          include: {
            variants: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
    
    // Calculate performance metrics for each campaign
    const campaignsWithMetrics = await Promise.all(
      campaigns.map(async (campaign) => {
        // Get sales data for this product during campaign period
        const sales = await prisma.orderLineItems.findMany({
          where: {
            variant: {
              productId: campaign.productId
            },
            order: {
              status: 'DELIVERED',
              orderDate: {
                gte: campaign.startDate,
                lte: campaign.endDate
              }
            }
          },
          include: {
            order: true,
            variant: true
          }
        });
        
        const totalSales = sales.reduce((sum, sale) => sum + (sale.actualSalePrice * sale.quantity), 0);
        const totalUnits = sales.reduce((sum, sale) => sum + sale.quantity, 0);
        const roi = campaign.budgetAllocated > 0 ? ((totalSales - campaign.budgetAllocated) / campaign.budgetAllocated) * 100 : 0;
        
        return {
          ...campaign,
          performance: {
            totalSales,
            totalUnits,
            roi,
            costPerSale: totalUnits > 0 ? campaign.budgetAllocated / totalUnits : 0
          }
        };
      })
    );
    
    res.json(campaignsWithMetrics);
  } catch (error) {
    console.error("Error retrieving marketing campaigns:", error);
    res.status(500).json({ message: "Error retrieving marketing campaigns" });
  }
};

export const getCampaignById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { campaignId } = req.params;
    
    const campaign = await prisma.marketingCampaigns.findUnique({
      where: { campaignId },
      include: {
        product: {
          include: {
            variants: true
          }
        }
      }
    });
    
    if (!campaign) {
      res.status(404).json({ message: "Campaign not found" });
      return;
    }
    
    // Get detailed performance data
    const sales = await prisma.orderLineItems.findMany({
      where: {
        variant: {
          productId: campaign.productId
        },
        order: {
          status: 'DELIVERED',
          orderDate: {
            gte: campaign.startDate,
            lte: campaign.endDate
          }
        }
      },
      include: {
        order: true,
        variant: true
      }
    });
    
    // Daily performance breakdown
    const dailyPerformance = await prisma.$queryRaw`
      SELECT 
        DATE(o."orderDate") as date,
        SUM(oli."actualSalePrice" * oli.quantity) as revenue,
        SUM(oli.quantity) as units_sold
      FROM "OrderLineItems" oli
      JOIN "Orders" o ON oli."orderId" = o."orderId"
      JOIN "Variants" v ON oli.sku = v.sku
      WHERE v."productId" = ${campaign.productId}
      AND o.status = 'DELIVERED'
      AND o."orderDate" >= ${campaign.startDate}
      AND o."orderDate" <= ${campaign.endDate}
      GROUP BY DATE(o."orderDate")
      ORDER BY date ASC
    `;
    
    const totalSales = sales.reduce((sum, sale) => sum + (sale.actualSalePrice * sale.quantity), 0);
    const totalUnits = sales.reduce((sum, sale) => sum + sale.quantity, 0);
    const roi = campaign.budgetAllocated > 0 ? ((totalSales - campaign.budgetAllocated) / campaign.budgetAllocated) * 100 : 0;
    
    res.json({
      ...campaign,
      performance: {
        totalSales,
        totalUnits,
        roi,
        costPerSale: totalUnits > 0 ? campaign.budgetAllocated / totalUnits : 0,
        dailyPerformance
      }
    });
  } catch (error) {
    console.error("Error retrieving campaign:", error);
    res.status(500).json({ message: "Error retrieving campaign" });
  }
};

export const createMarketingCampaign = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      campaignName,
      productId,
      budgetAllocated,
      startDate,
      endDate
    } = req.body;
    
    // Validate required fields
    if (!campaignName || !productId || budgetAllocated === undefined || !startDate || !endDate) {
      res.status(400).json({ message: "All campaign fields are required" });
      return;
    }
    
    // Validate dates
    const start = new Date(startDate);
    const end = new Date(endDate);
    const now = new Date();
    
    if (end <= start) {
      res.status(400).json({ message: "End date must be after start date" });
      return;
    }
    
    // Determine initial status
    let status: 'PENDING' | 'ACTIVE' = 'PENDING';
    if (start <= now && end > now) {
      status = 'ACTIVE';
    }
    
    // Check if product exists
    const product = await prisma.products.findUnique({
      where: { productId }
    });
    
    if (!product) {
      res.status(404).json({ message: "Product not found" });
      return;
    }
    
    const campaign = await prisma.marketingCampaigns.create({
      data: {
        campaignName,
        productId,
        budgetAllocated,
        startDate: start,
        endDate: end,
        status
      },
      include: {
        product: true
      }
    });
    
    res.status(201).json(campaign);
  } catch (error) {
    console.error("Error creating marketing campaign:", error);
    res.status(500).json({ message: "Error creating marketing campaign" });
  }
};

export const updateMarketingCampaign = async (req: Request, res: Response): Promise<void> => {
  try {
    const { campaignId } = req.params;
    const updateData = req.body;
    
    // Don't allow direct status updates - they should be handled by the system
    delete updateData.status;
    
    const campaign = await prisma.marketingCampaigns.update({
      where: { campaignId },
      data: updateData,
      include: {
        product: true
      }
    });
    
    res.json(campaign);
  } catch (error) {
    console.error("Error updating marketing campaign:", error);
    res.status(500).json({ message: "Error updating marketing campaign" });
  }
};

export const updateCampaignStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const { campaignId } = req.params;
    const { status } = req.body;
    
    if (!['ACTIVE', 'PENDING', 'PAUSED', 'ENDED'].includes(status)) {
      res.status(400).json({ message: "Invalid status" });
      return;
    }
    
    const campaign = await prisma.marketingCampaigns.update({
      where: { campaignId },
      data: { status },
      include: {
        product: true
      }
    });
    
    res.json(campaign);
  } catch (error) {
    console.error("Error updating campaign status:", error);
    res.status(500).json({ message: "Error updating campaign status" });
  }
};

export const deleteMarketingCampaign = async (req: Request, res: Response): Promise<void> => {
  try {
    const { campaignId } = req.params;
    
    await prisma.marketingCampaigns.delete({
      where: { campaignId }
    });
    
    res.json({ message: "Campaign deleted successfully" });
  } catch (error) {
    console.error("Error deleting marketing campaign:", error);
    res.status(500).json({ message: "Error deleting marketing campaign" });
  }
};

// Currency Purchases Management
export const getCurrencyPurchases = async (req: Request, res: Response): Promise<void> => {
  try {
    const { currency, startDate, endDate } = req.query;
    
    const where: any = {};
    if (currency) where.currency = currency.toString();
    if (startDate || endDate) {
      where.purchaseDate = {};
      if (startDate) where.purchaseDate.gte = new Date(startDate.toString());
      if (endDate) where.purchaseDate.lte = new Date(endDate.toString());
    }
    
    const purchases = await prisma.currencyPurchases.findMany({
      where,
      orderBy: { purchaseDate: 'desc' }
    });
    
    // Calculate summary statistics
    const summary = purchases.reduce((acc, purchase) => {
      if (!acc[purchase.currency]) {
        acc[purchase.currency] = {
          totalAmount: 0,
          totalCost: 0,
          averageRate: 0,
          count: 0
        };
      }
      
      acc[purchase.currency].totalAmount += purchase.amountBought;
      acc[purchase.currency].totalCost += purchase.amountBought * purchase.exchangeRatePaid;
      acc[purchase.currency].count += 1;
      acc[purchase.currency].averageRate = acc[purchase.currency].totalCost / acc[purchase.currency].totalAmount;
      
      return acc;
    }, {} as any);
    
    res.json({
      purchases,
      summary
    });
  } catch (error) {
    console.error("Error retrieving currency purchases:", error);
    res.status(500).json({ message: "Error retrieving currency purchases" });
  }
};

export const createCurrencyPurchase = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      purchaseDate,
      currency,
      amountBought,
      exchangeRatePaid
    } = req.body;
    
    // Validate required fields
    if (!purchaseDate || !currency || amountBought === undefined || exchangeRatePaid === undefined) {
      res.status(400).json({ message: "All currency purchase fields are required" });
      return;
    }
    
    const purchase = await prisma.currencyPurchases.create({
      data: {
        purchaseDate: new Date(purchaseDate),
        currency,
        amountBought,
        exchangeRatePaid
      }
    });
    
    // Create corresponding financial transaction
    await prisma.financesLedger.create({
      data: {
        transactionName: `Currency Purchase - ${currency}`,
        type: 'OTHER_EXPENSE',
        moneyOut: amountBought * exchangeRatePaid
      }
    });
    
    res.status(201).json(purchase);
  } catch (error) {
    console.error("Error creating currency purchase:", error);
    res.status(500).json({ message: "Error creating currency purchase" });
  }
};

// Marketing Analytics
export const getMarketingAnalytics = async (req: Request, res: Response): Promise<void> => {
  try {
    const { startDate, endDate } = req.query;
    
    const dateFilter: any = {};
    if (startDate || endDate) {
      if (startDate) dateFilter.gte = new Date(startDate.toString());
      if (endDate) dateFilter.lte = new Date(endDate.toString());
    }
    
    // Overall marketing spend
    const totalMarketingSpend = await prisma.marketingCampaigns.aggregate({
      where: dateFilter.gte || dateFilter.lte ? {
        startDate: dateFilter
      } : {},
      _sum: { budgetAllocated: true }
    });
    
    // Campaign performance summary
    const campaignPerformance = await prisma.$queryRaw`
      SELECT 
        mc."campaignName",
        mc."budgetAllocated",
        p.name as product_name,
        SUM(oli."actualSalePrice" * oli.quantity) as revenue_generated,
        SUM(oli.quantity) as units_sold,
        COUNT(DISTINCT o."orderId") as orders_count
      FROM "MarketingCampaigns" mc
      JOIN "Products" p ON mc."productId" = p."productId"
      LEFT JOIN "Variants" v ON p."productId" = v."productId"
      LEFT JOIN "OrderLineItems" oli ON v.sku = oli.sku
      LEFT JOIN "Orders" o ON oli."orderId" = o."orderId" 
        AND o.status = 'DELIVERED' 
        AND o."orderDate" >= mc."startDate" 
        AND o."orderDate" <= mc."endDate"
      ${dateFilter.gte || dateFilter.lte ? `WHERE mc."startDate" >= '${dateFilter.gte || '1900-01-01'}' AND mc."startDate" <= '${dateFilter.lte || '2100-01-01'}'` : ''}
      GROUP BY mc."campaignId", mc."campaignName", mc."budgetAllocated", p.name
      ORDER BY revenue_generated DESC
    `;
    
    // Marketing ROI by product category
    const roiByCategory = await prisma.$queryRaw`
      SELECT 
        p.category,
        SUM(mc."budgetAllocated") as total_spend,
        SUM(oli."actualSalePrice" * oli.quantity) as total_revenue,
        (SUM(oli."actualSalePrice" * oli.quantity) - SUM(mc."budgetAllocated")) / SUM(mc."budgetAllocated") * 100 as roi_percentage
      FROM "MarketingCampaigns" mc
      JOIN "Products" p ON mc."productId" = p."productId"
      LEFT JOIN "Variants" v ON p."productId" = v."productId"
      LEFT JOIN "OrderLineItems" oli ON v.sku = oli.sku
      LEFT JOIN "Orders" o ON oli."orderId" = o."orderId" 
        AND o.status = 'DELIVERED' 
        AND o."orderDate" >= mc."startDate" 
        AND o."orderDate" <= mc."endDate"
      GROUP BY p.category
      ORDER BY roi_percentage DESC
    `;
    
    res.json({
      totalMarketingSpend: totalMarketingSpend._sum.budgetAllocated || 0,
      campaignPerformance,
      roiByCategory
    });
  } catch (error) {
    console.error("Error retrieving marketing analytics:", error);
    res.status(500).json({ message: "Error retrieving marketing analytics" });
  }
};