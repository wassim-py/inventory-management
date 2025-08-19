import { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Finances Ledger Management
export const getFinancesLedger = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      search,
      type,
      startDate,
      endDate,
      page = '1',
      limit = '50'
    } = req.query;
    
    const skip = (parseInt(page.toString()) - 1) * parseInt(limit.toString());
    
    const where: any = {};
    
    if (search) {
      where.OR = [
        { transactionName: { contains: search.toString(), mode: 'insensitive' } },
        { orderId: { contains: search.toString() } }
      ];
    }
    
    if (type) where.type = type;
    if (startDate || endDate) {
      where.date = {};
      if (startDate) where.date.gte = new Date(startDate.toString());
      if (endDate) where.date.lte = new Date(endDate.toString());
    }
    
    const [transactions, total] = await Promise.all([
      prisma.financesLedger.findMany({
        where,
        include: {
          order: {
            select: {
              orderId: true,
              customerName: true,
              status: true
            }
          }
        },
        orderBy: { date: 'desc' },
        skip,
        take: parseInt(limit.toString())
      }),
      prisma.financesLedger.count({ where })
    ]);
    
    // Calculate summary for filtered results
    const summary = await prisma.financesLedger.aggregate({
      where,
      _sum: {
        moneyIn: true,
        moneyOut: true
      }
    });
    
    res.json({
      transactions,
      pagination: {
        total,
        page: parseInt(page.toString()),
        limit: parseInt(limit.toString()),
        totalPages: Math.ceil(total / parseInt(limit.toString()))
      },
      summary: {
        totalIncome: summary._sum.moneyIn || 0,
        totalExpenses: summary._sum.moneyOut || 0,
        netAmount: (summary._sum.moneyIn || 0) - (summary._sum.moneyOut || 0)
      }
    });
  } catch (error) {
    console.error("Error retrieving finances ledger:", error);
    res.status(500).json({ message: "Error retrieving finances ledger" });
  }
};

export const getTransactionById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { transactionId } = req.params;
    
    const transaction = await prisma.financesLedger.findUnique({
      where: { transactionId },
      include: {
        order: {
          include: {
            orderLineItems: {
              include: {
                variant: {
                  include: { product: true }
                }
              }
            }
          }
        }
      }
    });
    
    if (!transaction) {
      res.status(404).json({ message: "Transaction not found" });
      return;
    }
    
    res.json(transaction);
  } catch (error) {
    console.error("Error retrieving transaction:", error);
    res.status(500).json({ message: "Error retrieving transaction" });
  }
};

export const createManualTransaction = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      transactionName,
      type,
      moneyIn = 0,
      moneyOut = 0,
      orderId
    } = req.body;
    
    // Validate required fields
    if (!transactionName || !type) {
      res.status(400).json({ message: "Transaction name and type are required" });
      return;
    }
    
    // Validate that either moneyIn or moneyOut is provided (but not both)
    if ((moneyIn > 0 && moneyOut > 0) || (moneyIn === 0 && moneyOut === 0)) {
      res.status(400).json({ message: "Provide either money in or money out, not both or neither" });
      return;
    }
    
    // Validate transaction type
    const validTypes = ['REVENUE', 'COGS', 'MARKETING', 'RETURN_FEE', 'CURRENCY_PURCHASE', 'OTHER_INCOME', 'OTHER_EXPENSE'];
    if (!validTypes.includes(type)) {
      res.status(400).json({ message: "Invalid transaction type" });
      return;
    }
    
    const transaction = await prisma.financesLedger.create({
      data: {
        transactionName,
        type,
        moneyIn,
        moneyOut,
        orderId
      },
      include: {
        order: {
          select: {
            orderId: true,
            customerName: true,
            status: true
          }
        }
      }
    });
    
    res.status(201).json(transaction);
  } catch (error) {
    console.error("Error creating manual transaction:", error);
    res.status(500).json({ message: "Error creating manual transaction" });
  }
};

export const updateTransaction = async (req: Request, res: Response): Promise<void> => {
  try {
    const { transactionId } = req.params;
    const updateData = req.body;
    
    // Don't allow updating system-generated transactions linked to orders
    const existingTransaction = await prisma.financesLedger.findUnique({
      where: { transactionId }
    });
    
    if (!existingTransaction) {
      res.status(404).json({ message: "Transaction not found" });
      return;
    }
    
    if (existingTransaction.orderId && ['REVENUE', 'COGS', 'MARKETING', 'RETURN_FEE'].includes(existingTransaction.type)) {
      res.status(400).json({ message: "Cannot modify system-generated transaction" });
      return;
    }
    
    const transaction = await prisma.financesLedger.update({
      where: { transactionId },
      data: updateData,
      include: {
        order: {
          select: {
            orderId: true,
            customerName: true,
            status: true
          }
        }
      }
    });
    
    res.json(transaction);
  } catch (error) {
    console.error("Error updating transaction:", error);
    res.status(500).json({ message: "Error updating transaction" });
  }
};

export const deleteTransaction = async (req: Request, res: Response): Promise<void> => {
  try {
    const { transactionId } = req.params;
    
    // Don't allow deleting system-generated transactions
    const transaction = await prisma.financesLedger.findUnique({
      where: { transactionId }
    });
    
    if (!transaction) {
      res.status(404).json({ message: "Transaction not found" });
      return;
    }
    
    if (transaction.orderId && ['REVENUE', 'COGS', 'MARKETING', 'RETURN_FEE'].includes(transaction.type)) {
      res.status(400).json({ message: "Cannot delete system-generated transaction" });
      return;
    }
    
    await prisma.financesLedger.delete({
      where: { transactionId }
    });
    
    res.json({ message: "Transaction deleted successfully" });
  } catch (error) {
    console.error("Error deleting transaction:", error);
    res.status(500).json({ message: "Error deleting transaction" });
  }
};

// Financial Analytics and Reports
export const getFinancialSummary = async (req: Request, res: Response): Promise<void> => {
  try {
    const { startDate, endDate, groupBy = 'month' } = req.query;
    
    const dateFilter: any = {};
    if (startDate || endDate) {
      if (startDate) dateFilter.gte = new Date(startDate.toString());
      if (endDate) dateFilter.lte = new Date(endDate.toString());
    }
    
    // Overall summary
    const overallSummary = await prisma.financesLedger.aggregate({
      where: dateFilter.gte || dateFilter.lte ? { date: dateFilter } : {},
      _sum: {
        moneyIn: true,
        moneyOut: true
      }
    });
    
    // Summary by transaction type
    const summaryByType = await prisma.financesLedger.groupBy({
      by: ['type'],
      where: dateFilter.gte || dateFilter.lte ? { date: dateFilter } : {},
      _sum: {
        moneyIn: true,
        moneyOut: true
      }
    });
    
    // Time-based analysis
    let timeGrouping = 'month';
    if (groupBy === 'day') timeGrouping = 'day';
    else if (groupBy === 'year') timeGrouping = 'year';
    
    const timeBasedSummary = await prisma.$queryRaw`
      SELECT 
        DATE_TRUNC(${timeGrouping}, date) as period,
        SUM("moneyIn") as total_income,
        SUM("moneyOut") as total_expenses,
        SUM("moneyIn") - SUM("moneyOut") as net_profit
      FROM "FinancesLedger"
      ${dateFilter.gte || dateFilter.lte ? `WHERE date >= '${dateFilter.gte || '1900-01-01'}' AND date <= '${dateFilter.lte || '2100-01-01'}'` : ''}
      GROUP BY DATE_TRUNC(${timeGrouping}, date)
      ORDER BY period ASC
    `;
    
    // Profit margins by order
    const profitMargins = await prisma.$queryRaw`
      SELECT 
        o."orderId",
        o."customerName",
        o."finalPrice" as revenue,
        SUM(CASE WHEN fl.type = 'COGS' THEN fl."moneyOut" ELSE 0 END) as cogs,
        SUM(CASE WHEN fl.type = 'MARKETING' THEN fl."moneyOut" ELSE 0 END) as marketing_cost,
        o."finalPrice" - SUM(CASE WHEN fl.type = 'COGS' THEN fl."moneyOut" ELSE 0 END) - SUM(CASE WHEN fl.type = 'MARKETING' THEN fl."moneyOut" ELSE 0 END) as net_profit
      FROM "Orders" o
      LEFT JOIN "FinancesLedger" fl ON o."orderId" = fl."orderId"
      WHERE o.status = 'DELIVERED'
      ${dateFilter.gte || dateFilter.lte ? `AND o."orderDate" >= '${dateFilter.gte || '1900-01-01'}' AND o."orderDate" <= '${dateFilter.lte || '2100-01-01'}'` : ''}
      GROUP BY o."orderId", o."customerName", o."finalPrice"
      ORDER BY net_profit DESC
      LIMIT 20
    `;
    
    res.json({
      overallSummary: {
        totalIncome: overallSummary._sum.moneyIn || 0,
        totalExpenses: overallSummary._sum.moneyOut || 0,
        netProfit: (overallSummary._sum.moneyIn || 0) - (overallSummary._sum.moneyOut || 0)
      },
      summaryByType: summaryByType.map(item => ({
        type: item.type,
        income: item._sum.moneyIn || 0,
        expenses: item._sum.moneyOut || 0,
        net: (item._sum.moneyIn || 0) - (item._sum.moneyOut || 0)
      })),
      timeBasedSummary,
      topProfitableOrders: profitMargins
    });
  } catch (error) {
    console.error("Error retrieving financial summary:", error);
    res.status(500).json({ message: "Error retrieving financial summary" });
  }
};

export const getCashFlowAnalysis = async (req: Request, res: Response): Promise<void> => {
  try {
    const { period = '30' } = req.query;
    const days = parseInt(period.toString());
    
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    
    // Daily cash flow
    const dailyCashFlow = await prisma.$queryRaw`
      SELECT 
        DATE(date) as date,
        SUM("moneyIn") as cash_in,
        SUM("moneyOut") as cash_out,
        SUM("moneyIn") - SUM("moneyOut") as net_flow
      FROM "FinancesLedger"
      WHERE date >= ${startDate} AND date <= ${endDate}
      GROUP BY DATE(date)
      ORDER BY date ASC
    `;
    
    // Running balance calculation
    let runningBalance = 0;
    const cashFlowWithBalance = (dailyCashFlow as any[]).map(day => {
      runningBalance += parseFloat(day.net_flow || '0');
      return {
        ...day,
        running_balance: runningBalance
      };
    });
    
    // Cash flow by category
    const categoryBreakdown = await prisma.financesLedger.groupBy({
      by: ['type'],
      where: {
        date: {
          gte: startDate,
          lte: endDate
        }
      },
      _sum: {
        moneyIn: true,
        moneyOut: true
      }
    });
    
    res.json({
      dailyCashFlow: cashFlowWithBalance,
      categoryBreakdown: categoryBreakdown.map(item => ({
        type: item.type,
        income: item._sum.moneyIn || 0,
        expenses: item._sum.moneyOut || 0,
        net: (item._sum.moneyIn || 0) - (item._sum.moneyOut || 0)
      })),
      period: {
        startDate,
        endDate,
        days
      }
    });
  } catch (error) {
    console.error("Error retrieving cash flow analysis:", error);
    res.status(500).json({ message: "Error retrieving cash flow analysis" });
  }
};

// Shipping Zones Management
export const getShippingZones = async (req: Request, res: Response): Promise<void> => {
  try {
    const zones = await prisma.shippingZones.findMany({
      include: {
        _count: {
          select: { orders: true }
        }
      },
      orderBy: { wilaya: 'asc' }
    });
    
    res.json(zones);
  } catch (error) {
    console.error("Error retrieving shipping zones:", error);
    res.status(500).json({ message: "Error retrieving shipping zones" });
  }
};

export const createShippingZone = async (req: Request, res: Response): Promise<void> => {
  try {
    const { wilaya, stopdeskPrice, domicilePrice } = req.body;
    
    if (!wilaya || stopdeskPrice === undefined || domicilePrice === undefined) {
      res.status(400).json({ message: "All shipping zone fields are required" });
      return;
    }
    
    const zone = await prisma.shippingZones.create({
      data: { wilaya, stopdeskPrice, domicilePrice }
    });
    
    res.status(201).json(zone);
  } catch (error) {
    console.error("Error creating shipping zone:", error);
    if (error.code === 'P2002') {
      res.status(400).json({ message: "Wilaya already exists" });
    } else {
      res.status(500).json({ message: "Error creating shipping zone" });
    }
  }
};

export const updateShippingZone = async (req: Request, res: Response): Promise<void> => {
  try {
    const { wilaya } = req.params;
    const { stopdeskPrice, domicilePrice } = req.body;
    
    const zone = await prisma.shippingZones.update({
      where: { wilaya },
      data: { stopdeskPrice, domicilePrice }
    });
    
    res.json(zone);
  } catch (error) {
    console.error("Error updating shipping zone:", error);
    res.status(500).json({ message: "Error updating shipping zone" });
  }
};