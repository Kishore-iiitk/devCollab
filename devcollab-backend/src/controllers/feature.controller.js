import mongoose from "mongoose";
import Feature from "../models/feature.model.js";
import Milestone from "../models/milestone.model.js";
import Task from "../models/task.model.js";
import Project from "../models/project.model.js";
import { logActivity } from "../services/activity.service.js";

export const createFeature = async (req, res) => {
  try {
    const { name, description, projectId } = req.body;

    if (!projectId) {
      return res.status(400).json({
        message: "projectId is required",
      });
    }

    if (!mongoose.isValidObjectId(projectId)) {
      return res.status(400).json({
        message: "Invalid projectId",
      });
    }

    if (!name || !name.trim()) {
      return res.status(400).json({
        message: "Feature name is required",
      });
    }

    const project = req.project || (await Project.findById(projectId));

    if (!project) {
      return res.status(404).json({
        message: "Project not found",
      });
    }

    const feature = await Feature.create({
      name: name.trim(),
      description: description || "",
      project: project._id,
      workspace: project.workspace,
      createdBy: req.user._id,
    });

    const featureName = feature.name;

    await logActivity({
      workspace: project.workspace,
      project: project._id,
      user: req.user._id,
      action: "created a feature",
      entityType: "Feature",
      entityId: feature._id,
      metadata: {
        featureName,
      },
    });

    res.status(201).json({
      message: "Feature created successfully",
      feature,
    });
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
};

export const getProjectFeatures = async (req, res) => {
  try {
    const { projectId } = req.params;

    if (!mongoose.isValidObjectId(projectId)) {
      return res.status(400).json({
        message: "Invalid projectId",
      });
    }

    const features = await Feature.find({ project: projectId })
      .sort({ createdAt: 1 })
      .populate("createdBy", "name email");

    const stats = await Task.aggregate([
      {
        $match: {
          project: new mongoose.Types.ObjectId(projectId),
          feature: { $exists: true, $ne: null },
        },
      },
      {
        $group: {
          _id: "$feature",
          total: { $sum: 1 },
          done: {
            $sum: {
              $cond: [{ $eq: ["$status", "Done"] }, 1, 0],
            },
          },
        },
      },
    ]);

    const milestoneCounts = await Milestone.aggregate([
      {
        $match: {
          project: new mongoose.Types.ObjectId(projectId),
        },
      },
      {
        $group: {
          _id: "$feature",
          count: { $sum: 1 },
        },
      },
    ]);

    const taskStatsMap = new Map();
    for (const stat of stats) {
      if (stat._id) {
        taskStatsMap.set(stat._id.toString(), {
          total: stat.total,
          done: stat.done,
        });
      }
    }

    const milestoneCountMap = new Map();
    for (const m of milestoneCounts) {
      if (m._id) {
        milestoneCountMap.set(m._id.toString(), m.count);
      }
    }

    const featuresWithProgress = features.map((feature) => {
      const featObj = feature.toObject();
      const stat = taskStatsMap.get(feature._id.toString()) || {
        total: 0,
        done: 0,
      };
      const milestoneCount =
        milestoneCountMap.get(feature._id.toString()) || 0;
      const percent = stat.total
        ? Math.round((stat.done / stat.total) * 100)
        : 0;

      return {
        ...featObj,
        milestoneCount,
        progress: {
          total: stat.total,
          done: stat.done,
          percent,
        },
      };
    });

    res.status(200).json({
      features: featuresWithProgress,
    });
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
};

export const getFeatureById = async (req, res) => {
  try {
    const { featureId } = req.params;

    if (!mongoose.isValidObjectId(featureId)) {
      return res.status(400).json({
        message: "Invalid featureId",
      });
    }

    let feature = req.feature || (await Feature.findById(featureId));

    if (!feature) {
      return res.status(404).json({
        message: "Feature not found",
      });
    }

    await feature.populate("createdBy", "name email");

    res.status(200).json({
      feature,
      role: req.projectRole,
      workspaceRole: req.workspaceRole,
    });
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
};

export const updateFeature = async (req, res) => {
  try {
    const { featureId } = req.params;

    if (!mongoose.isValidObjectId(featureId)) {
      return res.status(400).json({
        message: "Invalid featureId",
      });
    }

    const { name, description } = req.body;

    const feature = req.feature || (await Feature.findById(featureId));

    if (!feature) {
      return res.status(404).json({
        message: "Feature not found",
      });
    }

    if (name !== undefined) {
      if (!name.trim()) {
        return res.status(400).json({
          message: "Feature name cannot be empty",
        });
      }
      feature.name = name.trim();
    }

    if (description !== undefined) {
      feature.description = description;
    }

    await feature.save();
    await feature.populate("createdBy", "name email");

    const project = req.project || (await Project.findById(feature.project));

    await logActivity({
      workspace: project?.workspace || req.workspace?._id,
      project: feature.project,
      user: req.user._id,
      action: "updated a feature",
      entityType: "Feature",
      entityId: feature._id,
      metadata: {
        featureName: feature.name,
      },
    });

    res.status(200).json({
      message: "Feature updated successfully",
      feature,
    });
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
};

export const deleteFeature = async (req, res) => {
  try {
    const { featureId } = req.params;

    if (!mongoose.isValidObjectId(featureId)) {
      return res.status(400).json({
        message: "Invalid featureId",
      });
    }

    const feature = req.feature || (await Feature.findById(featureId));

    if (!feature) {
      return res.status(404).json({
        message: "Feature not found",
      });
    }

    await Task.deleteMany({ feature: feature._id });
    await Milestone.deleteMany({ feature: feature._id });
    await feature.deleteOne();

    const project = req.project || (await Project.findById(feature.project));

    await logActivity({
      workspace: project?.workspace || req.workspace?._id,
      project: feature.project,
      user: req.user._id,
      action: "deleted a feature",
      entityType: "Feature",
      entityId: feature._id,
      metadata: {
        featureName: feature.name,
      },
    });

    res.status(200).json({
      message: "Feature deleted successfully",
    });
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
};
