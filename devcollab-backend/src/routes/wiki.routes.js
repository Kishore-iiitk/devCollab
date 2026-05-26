import express from "express";

import protect from "../middleware/auth.middleware.js";

import {
  createWikiPage,
  getProjectWikiPages,
  updateWikiPage,
} from "../controllers/wiki.controller.js";

const router = express.Router();

router.post("/", protect, createWikiPage);

router.get("/:projectId", protect, getProjectWikiPages);

router.patch("/:wikiId", protect, updateWikiPage);

export default router;