import { Router } from "express";
import {
  getMarketingCampaigns,
  getCampaignById,
  createMarketingCampaign,
  updateMarketingCampaign,
  updateCampaignStatus,
  deleteMarketingCampaign,
  getCurrencyPurchases,
  createCurrencyPurchase,
  getMarketingAnalytics
} from "../controllers/marketingController";

const router = Router();

// Marketing campaigns routes
router.get("/campaigns", getMarketingCampaigns);
router.get("/campaigns/:campaignId", getCampaignById);
router.post("/campaigns", createMarketingCampaign);
router.put("/campaigns/:campaignId", updateMarketingCampaign);
router.patch("/campaigns/:campaignId/status", updateCampaignStatus);
router.delete("/campaigns/:campaignId", deleteMarketingCampaign);

// Currency purchases routes
router.get("/currency-purchases", getCurrencyPurchases);
router.post("/currency-purchases", createCurrencyPurchase);

// Analytics routes
router.get("/analytics", getMarketingAnalytics);

export default router;