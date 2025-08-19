import { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Helper function to calculate order totals
const calculateOrderTotals = async (orderLineItems: any[], wilaya: string, shippingMethod: string) => {
  const subtotal = orderLineItems.reduce((sum, item) => 
    sum + (item.actualSalePrice * item.quantity), 0
  );
  
  // Get shipping price from shipping zone
  const shippingZone = await prisma.shippingZones.findUnique({
    where: { wilaya }
  });
  
  if (!shippingZone) {
    throw new Error(`Shipping zone not found for wilaya: ${wilaya}`);
  }
  
  const shippingPrice = shippingMethod === 'DOMICILE' 
    ? shippingZone.domicilePrice 
    : shippingZone.stopdeskPrice;
  
  return {
    subtotal,
    shippingPrice,
    finalPrice: subtotal + shippingPrice
  };
};

// Helper function to update stock levels
const updateStockLevels = async (orderLineItems: any[], changeType: 'DECREASE' | 'INCREASE', orderId: string, reason: string) => {
  for (const item of orderLineItems) {
    const variant = await prisma.variants.findUnique({
      where: { sku: item.sku }
    });
    
    if (!variant) {
      throw new Error(`Variant with SKU ${item.sku} not found`);
    }
    
    const quantityChange = changeType === 'DECREASE' ? -item.quantity : item.quantity;
    const newStock = variant.stockOnHand + quantityChange;
    
    if (newStock < 0 && changeType === 'DECREASE') {
      throw new Error(`Insufficient stock for SKU ${item.sku}. Available: ${variant.stockOnHand}, Required: ${item.quantity}`);
    }
    
    // Update stock
    await prisma.variants.update({
      where: { sku: item.sku },
      data: { stockOnHand: newStock }
    });
    
    // Create stock history
    await prisma.stockHistory.create({
      data: {
        sku: item.sku,
        changeType: changeType === 'DECREASE' ? 'OUT' : 'IN',
        quantityChange,
        previousStock: variant.stockOnHand,
        newStock,
        reason,
        orderId
      }
    });
  }
};

// Calculate marketing cost per sale
const calculateMarketingCost = async (orderLineItems: any[]) => {
  let totalMarketingCost = 0;
  
  for (const item of orderLineItems) {
    const variant = await prisma.variants.findUnique({
      where: { sku: item.sku },
      include: {
        product: {
          include: {
            marketingCampaigns: {
              where: { status: 'ACTIVE' }
            }
          }
        }
      }
    });
    
    if (variant?.product.marketingCampaigns.length > 0) {
      // Calculate average marketing cost per sale for this product
      const totalBudget = variant.product.marketingCampaigns.reduce(
        (sum, campaign) => sum + campaign.budgetAllocated, 0
      );
      
      // Get total sales for this product (simplified calculation)
      const totalSales = await prisma.orderLineItems.count({
        where: {
          sku: { in: variant.product.variants.map(v => v.sku) },
          order: { status: 'DELIVERED' }
        }
      });
      
      const avgMarketingCostPerSale = totalSales > 0 ? totalBudget / totalSales : 0;
      totalMarketingCost += avgMarketingCostPerSale * item.quantity;
    }
  }
  
  return totalMarketingCost;
};

// Create financial transactions for delivered orders
const createFinancialTransactions = async (order: any, orderLineItems: any[]) => {
  const transactions = [];
  
  // Calculate COGS
  let totalCOGS = 0;
  for (const item of orderLineItems) {
    const variant = await prisma.variants.findUnique({
      where: { sku: item.sku }
    });
    if (variant) {
      totalCOGS += variant.costPrice * item.quantity;
    }
  }
  
  // Revenue transaction
  transactions.push({
    transactionName: `Order Revenue - ${order.orderId}`,
    type: 'REVENUE',
    moneyIn: order.finalPrice,
    orderId: order.orderId
  });
  
  // COGS transaction
  transactions.push({
    transactionName: `COGS - ${order.orderId}`,
    type: 'COGS',
    moneyOut: totalCOGS,
    orderId: order.orderId
  });
  
  // Marketing cost allocation
  const marketingCost = await calculateMarketingCost(orderLineItems);
  if (marketingCost > 0) {
    transactions.push({
      transactionName: `Marketing Allocation - ${order.orderId}`,
      type: 'MARKETING',
      moneyOut: marketingCost,
      orderId: order.orderId
    });
  }
  
  // Create all transactions
  for (const transaction of transactions) {
    await prisma.financesLedger.create({ data: transaction });
  }
};

export const getOrders = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      search,
      status,
      wilaya,
      startDate,
      endDate,
      page = '1',
      limit = '20'
    } = req.query;
    
    const skip = (parseInt(page.toString()) - 1) * parseInt(limit.toString());
    
    const where: any = {};
    
    if (search) {
      where.OR = [
        { customerName: { contains: search.toString(), mode: 'insensitive' } },
        { phoneNumber: { contains: search.toString() } },
        { orderId: { contains: search.toString() } }
      ];
    }
    
    if (status) where.status = status;
    if (wilaya) where.wilaya = wilaya;
    if (startDate || endDate) {
      where.orderDate = {};
      if (startDate) where.orderDate.gte = new Date(startDate.toString());
      if (endDate) where.orderDate.lte = new Date(endDate.toString());
    }
    
    const [orders, total] = await Promise.all([
      prisma.orders.findMany({
        where,
        include: {
          orderLineItems: {
            include: {
              variant: {
                include: { product: true }
              }
            }
          },
          shippingZone: true
        },
        orderBy: { orderDate: 'desc' },
        skip,
        take: parseInt(limit.toString())
      }),
      prisma.orders.count({ where })
    ]);
    
    res.json({
      orders,
      pagination: {
        total,
        page: parseInt(page.toString()),
        limit: parseInt(limit.toString()),
        totalPages: Math.ceil(total / parseInt(limit.toString()))
      }
    });
  } catch (error) {
    console.error("Error retrieving orders:", error);
    res.status(500).json({ message: "Error retrieving orders" });
  }
};

export const getOrderById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { orderId } = req.params;
    
    const order = await prisma.orders.findUnique({
      where: { orderId },
      include: {
        orderLineItems: {
          include: {
            variant: {
              include: { product: true }
            }
          }
        },
        shippingZone: true,
        financesLedger: true,
        stockHistory: true
      }
    });
    
    if (!order) {
      res.status(404).json({ message: "Order not found" });
      return;
    }
    
    res.json(order);
  } catch (error) {
    console.error("Error retrieving order:", error);
    res.status(500).json({ message: "Error retrieving order" });
  }
};

export const createOrder = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      customerName,
      phoneNumber,
      address,
      wilaya,
      shippingMethod,
      discount = 0,
      note,
      orderLineItems
    } = req.body;
    
    // Validate required fields
    if (!customerName || !phoneNumber || !address || !wilaya || 
        !shippingMethod || !orderLineItems || orderLineItems.length === 0) {
      res.status(400).json({ message: "All required fields must be provided" });
      return;
    }
    
    // Validate stock availability
    for (const item of orderLineItems) {
      const variant = await prisma.variants.findUnique({
        where: { sku: item.sku }
      });
      
      if (!variant) {
        res.status(400).json({ message: `Variant with SKU ${item.sku} not found` });
        return;
      }
      
      if (variant.stockOnHand < item.quantity) {
        res.status(400).json({ 
          message: `Insufficient stock for ${variant.product?.name || item.sku}. Available: ${variant.stockOnHand}, Required: ${item.quantity}` 
        });
        return;
      }
    }
    
    // Calculate totals
    const { subtotal, shippingPrice, finalPrice } = await calculateOrderTotals(
      orderLineItems, wilaya, shippingMethod
    );
    
    const finalPriceWithDiscount = finalPrice - discount;
    
    // Create order with transaction
    const order = await prisma.$transaction(async (tx) => {
      // Create order
      const newOrder = await tx.orders.create({
        data: {
          customerName,
          phoneNumber,
          address,
          wilaya,
          shippingMethod,
          discount,
          note,
          subtotal,
          shippingPrice,
          finalPrice: finalPriceWithDiscount,
          status: 'NEW'
        }
      });
      
      // Create order line items
      for (const item of orderLineItems) {
        await tx.orderLineItems.create({
          data: {
            orderId: newOrder.orderId,
            sku: item.sku,
            quantity: item.quantity,
            actualSalePrice: item.actualSalePrice
          }
        });
      }
      
      return newOrder;
    });
    
    // Update stock levels (commit stock)
    await updateStockLevels(orderLineItems, 'DECREASE', order.orderId, 'Order created - stock committed');
    
    // Fetch complete order for response
    const completeOrder = await prisma.orders.findUnique({
      where: { orderId: order.orderId },
      include: {
        orderLineItems: {
          include: {
            variant: {
              include: { product: true }
            }
          }
        },
        shippingZone: true
      }
    });
    
    res.status(201).json(completeOrder);
  } catch (error) {
    console.error("Error creating order:", error);
    res.status(500).json({ message: "Error creating order" });
  }
};

export const updateOrderStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const { orderId } = req.params;
    const { status } = req.body;
    
    if (!status) {
      res.status(400).json({ message: "Status is required" });
      return;
    }
    
    const currentOrder = await prisma.orders.findUnique({
      where: { orderId },
      include: {
        orderLineItems: {
          include: { variant: true }
        }
      }
    });
    
    if (!currentOrder) {
      res.status(404).json({ message: "Order not found" });
      return;
    }
    
    // Handle status-specific logic
    if (status === 'DELIVERED' && currentOrder.status !== 'DELIVERED') {
      // Create financial transactions
      await createFinancialTransactions(currentOrder, currentOrder.orderLineItems);
    } else if (status === 'RETURNED' && currentOrder.status === 'DELIVERED') {
      // Return stock
      await updateStockLevels(currentOrder.orderLineItems, 'INCREASE', orderId, 'Order returned');
      
      // Create return fee transaction
      await prisma.financesLedger.create({
        data: {
          transactionName: `Return Fee - ${orderId}`,
          type: 'OTHER_EXPENSE',
          moneyOut: 50, // Default return fee - should be configurable
          orderId
        }
      });
    } else if (status === 'CANCELLED' && currentOrder.status === 'NEW') {
      // Return committed stock
      await updateStockLevels(currentOrder.orderLineItems, 'INCREASE', orderId, 'Order cancelled');
    }
    
    const updatedOrder = await prisma.orders.update({
      where: { orderId },
      data: { status },
      include: {
        orderLineItems: {
          include: {
            variant: {
              include: { product: true }
            }
          }
        },
        shippingZone: true
      }
    });
    
    res.json(updatedOrder);
  } catch (error) {
    console.error("Error updating order status:", error);
    res.status(500).json({ message: "Error updating order status" });
  }
};

export const updateOrder = async (req: Request, res: Response): Promise<void> => {
  try {
    const { orderId } = req.params;
    const updateData = req.body;
    
    // Don't allow status updates through this endpoint
    delete updateData.status;
    
    const order = await prisma.orders.update({
      where: { orderId },
      data: updateData,
      include: {
        orderLineItems: {
          include: {
            variant: {
              include: { product: true }
            }
          }
        },
        shippingZone: true
      }
    });
    
    res.json(order);
  } catch (error) {
    console.error("Error updating order:", error);
    res.status(500).json({ message: "Error updating order" });
  }
};

// Dashboard specific endpoints
export const getRecentOrders = async (req: Request, res: Response): Promise<void> => {
  try {
    const limit = parseInt(req.query.limit?.toString() || '10');
    
    const orders = await prisma.orders.findMany({
      include: {
        orderLineItems: {
          include: {
            variant: {
              include: { product: true }
            }
          }
        }
      },
      orderBy: { orderDate: 'desc' },
      take: limit
    });
    
    res.json(orders);
  } catch (error) {
    console.error("Error retrieving recent orders:", error);
    res.status(500).json({ message: "Error retrieving recent orders" });
  }
};

export const getOrderStatistics = async (req: Request, res: Response): Promise<void> => {
  try {
    const { startDate, endDate } = req.query;
    
    const where: any = {};
    if (startDate || endDate) {
      where.orderDate = {};
      if (startDate) where.orderDate.gte = new Date(startDate.toString());
      if (endDate) where.orderDate.lte = new Date(endDate.toString());
    }
    
    const [
      totalOrders,
      newOrders,
      shippedOrders,
      deliveredOrders,
      returnedOrders,
      cancelledOrders,
      totalRevenue,
      averageOrderValue
    ] = await Promise.all([
      prisma.orders.count({ where }),
      prisma.orders.count({ where: { ...where, status: 'NEW' } }),
      prisma.orders.count({ where: { ...where, status: 'SHIPPED' } }),
      prisma.orders.count({ where: { ...where, status: 'DELIVERED' } }),
      prisma.orders.count({ where: { ...where, status: 'RETURNED' } }),
      prisma.orders.count({ where: { ...where, status: 'CANCELLED' } }),
      prisma.orders.aggregate({
        where: { ...where, status: 'DELIVERED' },
        _sum: { finalPrice: true }
      }),
      prisma.orders.aggregate({
        where: { ...where, status: 'DELIVERED' },
        _avg: { finalPrice: true }
      })
    ]);
    
    const returnRate = totalOrders > 0 ? (returnedOrders / totalOrders) * 100 : 0;
    
    res.json({
      totalOrders,
      ordersByStatus: {
        new: newOrders,
        shipped: shippedOrders,
        delivered: deliveredOrders,
        returned: returnedOrders,
        cancelled: cancelledOrders
      },
      totalRevenue: totalRevenue._sum.finalPrice || 0,
      averageOrderValue: averageOrderValue._avg.finalPrice || 0,
      returnRate
    });
  } catch (error) {
    console.error("Error retrieving order statistics:", error);
    res.status(500).json({ message: "Error retrieving order statistics" });
  }
};