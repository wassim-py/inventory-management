import { Router } from "express";
import {
  getOrders,
  getOrderById,
  createOrder,
  updateOrder,
  updateOrderStatus,
  getRecentOrders,
  getOrderStatistics
} from "../controllers/orderController";

const router = Router();

// Order management routes
router.get("/", getOrders);
router.get("/recent", getRecentOrders);
router.get("/statistics", getOrderStatistics);
router.get("/:orderId", getOrderById);
router.post("/", createOrder);
router.put("/:orderId", updateOrder);
router.patch("/:orderId/status", updateOrderStatus);

export default router;