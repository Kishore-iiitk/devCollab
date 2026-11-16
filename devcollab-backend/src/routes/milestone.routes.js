import express from "express";

import protect from "../middleware/auth.middleware.js";
import {
  requireProjectRole,
  requireProjectRoleViaFeature,
  requireProjectRoleViaMilestone,
} from "../middleware/rbac.middleware.js";

import {
  createMilestone,
  getFeatureMilestones,
  getMilestoneById,
  updateMilestone,
  deleteMilestone,
} from "../controllers/milestone.controller.js";

const router = express.Router();

router.post("/", protect, requireProjectRole("Admin"), createMilestone);
router.get(
  "/feature/:featureId",
  protect,
  requireProjectRoleViaFeature("Viewer"),
  getFeatureMilestones
);
router.get(
  "/detail/:milestoneId",
  protect,
  requireProjectRoleViaMilestone("Viewer"),
  getMilestoneById
);
router.patch(
  "/:milestoneId",
  protect,
  requireProjectRoleViaMilestone("Admin"),
  updateMilestone
);
router.delete(
  "/:milestoneId",
  protect,
  requireProjectRoleViaMilestone("Admin"),
  deleteMilestone
);

export default router;
