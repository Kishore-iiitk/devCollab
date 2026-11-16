import mongoose from "mongoose";
import Milestone from "../models/milestone.model.js";
import Feature from "../models/feature.model.js";
import Task from "../models/task.model.js";
import Project from "../models/project.model.js";
import { logActivity } from "../services/activity.service.js";

export const createMilestone = async (req, res) => {
  try {
    const { projectId, featureId, name, description, dueDate } = req.body;

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

    if (!featureId) {
      return res.status(400).json({
        message: "featureId is required",
      });
    }

    if (!mongoose.isValidObjectId(featureId)) {
      return res.status(400).json({
        message: "Invalid featureId",
      });
    }

    if (!name || !name.trim()) {
      return res.status(400).json({
        message: "Milestone name is required",
      });
    }

    const feature = req.feature || (await Feature.findById(featureId));

    if (!feature) {
      return res.status(404).json({
        message: "Feature not found",
      });
    }

    if (feature.project.toString() !== projectId) {
      return res.status(400).json({
        message: "Feature does not belong to this project",
      });
    }

    const project = req.project || (await Project.findById(feature.project));

    if (!project) {
      return res.status(404).json({
        message: "Project not found",
      });
    }

    const milestone = await Milestone.create({
      name: name.trim(),
      description: description || "",
      dueDate: dueDate || undefined,
      feature: feature._id,
      project: feature.project,
      createdBy: req.user._id,
    });

    await logActivity({
      workspace: project.workspace,
      project: project._id,
      user: req.user._id,
      action: "created a milestone",
      entityType: "Milestone",
      entityId: milestone._id,
      metadata: {
        milestoneName: milestone.name,
        featureName: feature.name,
      },
    });

    res.status(201).json({
      message: "Milestone created successfully",
      milestone,
    });
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
};

export const getFeatureMilestones = async (req, res) => {
  try {
    const { featureId } = req.params;

    if (!mongoose.isValidObjectId(featureId)) {
      return res.status(400).json({
        message: "Invalid featureId",
      });
    }

    const milestones = await Milestone.find({ feature: featureId })
      .sort({ createdAt: 1 })
      .populate("createdBy", "name email");

    const milestoneIds = milestones.map((m) => m._id);

    const stats = await Task.aggregate([
      {
        $match: {
          milestone: { $in: milestoneIds },
        },
      },
      {
        $group: {
          _id: "$milestone",
          total: { $sum: 1 },
          done: {
            $sum: {
              $cond: [{ $eq: ["$status", "Done"] }, 1, 0],
            },
          },
        },
      },
    ]);

    const progressMap = new Map();
    for (const stat of stats) {
      if (stat._id) {
        progressMap.set(stat._id.toString(), {
          total: stat.total,
          done: stat.done,
        });
      }
    }

    const milestonesWithProgress = milestones.map((milestone) => {
      const obj = milestone.toObject();
      const stat = progressMap.get(milestone._id.toString()) || {
        total: 0,
        done: 0,
      };
      const percent = stat.total
        ? Math.round((stat.done / stat.total) * 100)
        : 0;

      return {
        ...obj,
        progress: {
          total: stat.total,
          done: stat.done,
          percent,
        },
      };
    });

    res.status(200).json({
      milestones: milestonesWithProgress,
    });
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
};

export const getMilestoneById = async (req, res) => {
  try {
    const { milestoneId } = req.params;

    if (!mongoose.isValidObjectId(milestoneId)) {
      return res.status(400).json({
        message: "Invalid milestoneId",
      });
    }

    let milestone = req.milestone || (await Milestone.findById(milestoneId));

    if (!milestone) {
      return res.status(404).json({
        message: "Milestone not found",
      });
    }

    await milestone.populate("feature", "name");
    await milestone.populate("createdBy", "name email");

    const stats = await Task.aggregate([
      {
        $match: {
          milestone: new mongoose.Types.ObjectId(milestone._id),
        },
      },
      {
        $group: {
          _id: "$milestone",
          total: { $sum: 1 },
          done: {
            $sum: {
              $cond: [{ $eq: ["$status", "Done"] }, 1, 0],
            },
          },
        },
      },
    ]);

    const total = stats[0]?.total || 0;
    const done = stats[0]?.done || 0;
    const percent = total ? Math.round((done / total) * 100) : 0;

    res.status(200).json({
      milestone,
      progress: {
        total,
        done,
        percent,
      },
      role: req.projectRole,
    });
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
};

export const updateMilestone = async (req, res) => {
  try {
    const { milestoneId } = req.params;

    if (!mongoose.isValidObjectId(milestoneId)) {
      return res.status(400).json({
        message: "Invalid milestoneId",
      });
    }

    const { name, description, dueDate } = req.body;

    const milestone = req.milestone || (await Milestone.findById(milestoneId));

    if (!milestone) {
      return res.status(404).json({
        message: "Milestone not found",
      });
    }

    if (name !== undefined) {
      if (!name.trim()) {
        return res.status(400).json({
          message: "Milestone name cannot be empty",
        });
      }
      milestone.name = name.trim();
    }

    if (description !== undefined) {
      milestone.description = description;
    }

    if (dueDate !== undefined) {
      milestone.dueDate = dueDate;
    }

    await milestone.save();
    await milestone.populate("feature", "name");
    await milestone.populate("createdBy", "name email");

    const project = req.project || (await Project.findById(milestone.project));

    await logActivity({
      workspace: project?.workspace || req.workspace?._id,
      project: milestone.project,
      user: req.user._id,
      action: "updated a milestone",
      entityType: "Milestone",
      entityId: milestone._id,
      metadata: {
        milestoneName: milestone.name,
        featureName: milestone.feature?.name,
      },
    });

    res.status(200).json({
      message: "Milestone updated successfully",
      milestone,
    });
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
};

export const deleteMilestone = async (req, res) => {
  try {
    const { milestoneId } = req.params;

    if (!mongoose.isValidObjectId(milestoneId)) {
      return res.status(400).json({
        message: "Invalid milestoneId",
      });
    }

    const milestone = req.milestone || (await Milestone.findById(milestoneId));

    if (!milestone) {
      return res.status(404).json({
        message: "Milestone not found",
      });
    }

    await Task.updateMany(
      { milestone: milestone._id },
      { $unset: { milestone: "" } }
    );
    await milestone.deleteOne();

    const project = req.project || (await Project.findById(milestone.project));

    await logActivity({
      workspace: project?.workspace || req.workspace?._id,
      project: milestone.project,
      user: req.user._id,
      action: "deleted a milestone",
      entityType: "Milestone",
      entityId: milestone._id,
      metadata: {
        milestoneName: milestone.name,
      },
    });

    res.status(200).json({
      message: "Milestone deleted successfully",
    });
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
};
