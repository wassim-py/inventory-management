import { Router } from "express";
import {
  getProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
  getVariants,
  createVariant,
  updateVariant,
  getVariantStockHistory,
  getLowStockItems
} from "../controllers/productController";

const router = Router();

// Product routes
router.get("/", getProducts);
router.get("/low-stock", getLowStockItems);
router.get("/:productId", getProductById);
router.post("/", createProduct);
router.put("/:productId", updateProduct);
router.delete("/:productId", deleteProduct);

// Variant routes
router.get("/variants/all", getVariants);
router.post("/variants", createVariant);
router.put("/variants/:sku", updateVariant);
router.get("/variants/:sku/stock-history", getVariantStockHistory);

export default router;