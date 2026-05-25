import express from "express";

import protect from "../middleware/auth.middleware.js";

import { reviewCode } from "../controllers/codeReview.controller.js";

const router = express.Router();

router.post("/", protect, reviewCode);

export default router;