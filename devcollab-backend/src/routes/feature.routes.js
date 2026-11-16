import express from "express";

import protect from "../middleware/auth.middleware.js";
import {
  requireProjectRole,
  requireProjectRoleViaFeature,
} from "../middleware/rbac.middleware.js";

import {
  createFeature,
  getFeatureById,
  getProjectFeatures,
  updateFeature,
  deleteFeature,
} from "../controllers/feature.controller.js";

const router = express.Router();

router.post("/", protect, requireProjectRole("Admin"), createFeature);
router.get(
  "/detail/:featureId",
  protect,
  requireProjectRoleViaFeature("Viewer"),
  getFeatureById
);
router.get(
  "/:projectId",
  protect,
  requireProjectRole("Viewer"),
  getProjectFeatures
);
router.patch(
  "/:featureId",
  protect,
  requireProjectRoleViaFeature("Admin"),
  updateFeature
);
router.delete(
  "/:featureId",
  protect,
  requireProjectRoleViaFeature("Admin"),
  deleteFeature
);

export default router;
