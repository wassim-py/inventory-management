import { Request, Response } from "express";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Products Management
export const getProducts = async (req: Request, res: Response): Promise<void> => {
  try {
    const search = req.query.search?.toString();
    const category = req.query.category?.toString();
    
    const products = await prisma.products.findMany({
      where: {
        ...(search && {
          name: {
            contains: search,
            mode: 'insensitive'
          }
        }),
        ...(category && { category })
      },
      include: {
        variants: true,
        _count: {
          select: { variants: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
    
    res.json(products);
  } catch (error) {
    console.error("Error retrieving products:", error);
    res.status(500).json({ message: "Error retrieving products" });
  }
};

export const getProductById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { productId } = req.params;
    
    const product = await prisma.products.findUnique({
      where: { productId },
      include: {
        variants: {
          include: {
            stockHistory: {
              orderBy: { createdAt: 'desc' },
              take: 10
            }
          }
        },
        marketingCampaigns: {
          where: { status: 'ACTIVE' }
        }
      }
    });
    
    if (!product) {
      res.status(404).json({ message: "Product not found" });
      return;
    }
    
    res.json(product);
  } catch (error) {
    console.error("Error retrieving product:", error);
    res.status(500).json({ message: "Error retrieving product" });
  }
};

export const createProduct = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, category } = req.body;
    
    // Validate required fields
    if (!name || !category) {
      res.status(400).json({ message: "Name and category are required" });
      return;
    }
    
    const product = await prisma.products.create({
      data: { name, category },
      include: { variants: true }
    });
    
    res.status(201).json(product);
  } catch (error) {
    console.error("Error creating product:", error);
    res.status(500).json({ message: "Error creating product" });
  }
};

export const updateProduct = async (req: Request, res: Response): Promise<void> => {
  try {
    const { productId } = req.params;
    const { name, category } = req.body;
    
    const product = await prisma.products.update({
      where: { productId },
      data: { name, category },
      include: { variants: true }
    });
    
    res.json(product);
  } catch (error) {
    console.error("Error updating product:", error);
    res.status(500).json({ message: "Error updating product" });
  }
};

export const deleteProduct = async (req: Request, res: Response): Promise<void> => {
  try {
    const { productId } = req.params;
    
    // Check if product has variants with stock
    const variants = await prisma.variants.findMany({
      where: { productId, stockOnHand: { gt: 0 } }
    });
    
    if (variants.length > 0) {
      res.status(400).json({ 
        message: "Cannot delete product with variants that have stock on hand" 
      });
      return;
    }
    
    await prisma.products.delete({
      where: { productId }
    });
    
    res.json({ message: "Product deleted successfully" });
  } catch (error) {
    console.error("Error deleting product:", error);
    res.status(500).json({ message: "Error deleting product" });
  }
};

// Variants Management
export const getVariants = async (req: Request, res: Response): Promise<void> => {
  try {
    const { productId } = req.query;
    const search = req.query.search?.toString();
    
    const variants = await prisma.variants.findMany({
      where: {
        ...(productId && { productId: productId.toString() }),
        ...(search && {
          OR: [
            { sku: { contains: search, mode: 'insensitive' } },
            { size: { contains: search, mode: 'insensitive' } },
            { color: { contains: search, mode: 'insensitive' } }
          ]
        })
      },
      include: {
        product: true,
        _count: {
          select: { orderLineItems: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
    
    res.json(variants);
  } catch (error) {
    console.error("Error retrieving variants:", error);
    res.status(500).json({ message: "Error retrieving variants" });
  }
};

export const createVariant = async (req: Request, res: Response): Promise<void> => {
  try {
    const { 
      sku, 
      productId, 
      size, 
      color, 
      costPrice, 
      standardSellingPrice, 
      stockOnHand 
    } = req.body;
    
    // Validate required fields
    if (!sku || !productId || !size || !color || costPrice === undefined || 
        standardSellingPrice === undefined || stockOnHand === undefined) {
      res.status(400).json({ message: "All variant fields are required" });
      return;
    }
    
    // Check if product exists
    const product = await prisma.products.findUnique({
      where: { productId }
    });
    
    if (!product) {
      res.status(404).json({ message: "Product not found" });
      return;
    }
    
    const variant = await prisma.variants.create({
      data: {
        sku,
        productId,
        size,
        color,
        costPrice,
        standardSellingPrice,
        stockOnHand
      },
      include: { product: true }
    });
    
    // Create initial stock history record
    await prisma.stockHistory.create({
      data: {
        sku,
        changeType: 'IN',
        quantityChange: stockOnHand,
        previousStock: 0,
        newStock: stockOnHand,
        reason: 'Initial stock'
      }
    });
    
    res.status(201).json(variant);
  } catch (error) {
    console.error("Error creating variant:", error);
    if (error.code === 'P2002') {
      res.status(400).json({ message: "SKU already exists" });
    } else {
      res.status(500).json({ message: "Error creating variant" });
    }
  }
};

export const updateVariant = async (req: Request, res: Response): Promise<void> => {
  try {
    const { sku } = req.params;
    const { 
      size, 
      color, 
      costPrice, 
      standardSellingPrice, 
      stockOnHand 
    } = req.body;
    
    // Get current variant for stock history
    const currentVariant = await prisma.variants.findUnique({
      where: { sku }
    });
    
    if (!currentVariant) {
      res.status(404).json({ message: "Variant not found" });
      return;
    }
    
    const variant = await prisma.variants.update({
      where: { sku },
      data: {
        size,
        color,
        costPrice,
        standardSellingPrice,
        stockOnHand
      },
      include: { product: true }
    });
    
    // Create stock history if stock changed
    if (stockOnHand !== undefined && stockOnHand !== currentVariant.stockOnHand) {
      await prisma.stockHistory.create({
        data: {
          sku,
          changeType: 'ADJUSTMENT',
          quantityChange: stockOnHand - currentVariant.stockOnHand,
          previousStock: currentVariant.stockOnHand,
          newStock: stockOnHand,
          reason: 'Manual adjustment'
        }
      });
    }
    
    res.json(variant);
  } catch (error) {
    console.error("Error updating variant:", error);
    res.status(500).json({ message: "Error updating variant" });
  }
};

export const getVariantStockHistory = async (req: Request, res: Response): Promise<void> => {
  try {
    const { sku } = req.params;
    const limit = parseInt(req.query.limit?.toString() || '50');
    
    const history = await prisma.stockHistory.findMany({
      where: { sku },
      include: {
        order: {
          select: {
            orderId: true,
            customerName: true,
            status: true
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: limit
    });
    
    res.json(history);
  } catch (error) {
    console.error("Error retrieving stock history:", error);
    res.status(500).json({ message: "Error retrieving stock history" });
  }
};

// Low stock alerts
export const getLowStockItems = async (req: Request, res: Response): Promise<void> => {
  try {
    const threshold = parseInt(req.query.threshold?.toString() || '10');
    
    const lowStockItems = await prisma.variants.findMany({
      where: {
        stockOnHand: { lte: threshold }
      },
      include: {
        product: true
      },
      orderBy: { stockOnHand: 'asc' }
    });
    
    res.json(lowStockItems);
  } catch (error) {
    console.error("Error retrieving low stock items:", error);
    res.status(500).json({ message: "Error retrieving low stock items" });
  }
};