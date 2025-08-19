import { Router } from "express";
import {
  getFinancesLedger,
  getTransactionById,
  createManualTransaction,
  updateTransaction,
  deleteTransaction,
  getFinancialSummary,
  getCashFlowAnalysis,
  getShippingZones,
  createShippingZone,
  updateShippingZone
} from "../controllers/financesController";

const router = Router();

// Finances ledger routes
router.get("/ledger", getFinancesLedger);
router.get("/ledger/:transactionId", getTransactionById);
router.post("/ledger", createManualTransaction);
router.put("/ledger/:transactionId", updateTransaction);
router.delete("/ledger/:transactionId", deleteTransaction);

// Financial analytics routes
router.get("/summary", getFinancialSummary);
router.get("/cash-flow", getCashFlowAnalysis);

// Shipping zones routes
router.get("/shipping-zones", getShippingZones);
router.post("/shipping-zones", createShippingZone);
router.put("/shipping-zones/:wilaya", updateShippingZone);

export default router;