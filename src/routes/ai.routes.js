import express from "express";

import protect from "../middleware/auth.middleware.js";

import {
  summarizeProject,
  detectBlockers,
  generateSubtasks,
} from "../controllers/ai.controller.js";

const router = express.Router();

router.get("/summary/:projectId", protect, summarizeProject);

router.get("/blockers/:projectId", protect, detectBlockers);

router.post("/subtasks", protect, generateSubtasks);

export default router;