import mongoose from "mongoose";
import { io } from "../server.js";
import Task from "../models/task.model.js";
import Project from "../models/project.model.js";
import Feature from "../models/feature.model.js";
import Milestone from "../models/milestone.model.js";
import { logActivity } from "../services/activity.service.js";

export const createTask = async (req, res) => {
  try {
    const {
      title,
      description,
      priority,
      dueDate,
      labels,
      projectId,
      assignee,
      featureId: bodyFeatureId,
      feature: bodyFeature,
      milestoneId: bodyMilestoneId,
      milestone: bodyMilestone,
    } = req.body;

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

    const featureId = bodyFeatureId || bodyFeature;
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

    const feature = await Feature.findById(featureId);
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

    const milestoneId = bodyMilestoneId || bodyMilestone;
    if (milestoneId) {
      if (!mongoose.isValidObjectId(milestoneId)) {
        return res.status(400).json({
          message: "Invalid milestoneId",
        });
      }

      const milestoneDoc = await Milestone.findById(milestoneId);
      if (!milestoneDoc) {
        return res.status(404).json({
          message: "Milestone not found",
        });
      }

      if (milestoneDoc.feature.toString() !== feature._id.toString()) {
        return res.status(400).json({
          message: "Milestone does not belong to this feature",
        });
      }
    }

    if (assignee && !mongoose.isValidObjectId(assignee)) {
      return res.status(400).json({
        message: "Invalid assignee",
      });
    }

    const project = req.project || (await Project.findById(projectId));

    if (!project) {
      return res.status(404).json({
        message: "Project not found",
      });
    }

    const taskData = {
      title,
      description,
      priority,
      dueDate,
      labels,
      project: projectId,
      feature: feature._id,
      assignee,
      createdBy: req.user._id,
    };

    if (milestoneId) {
      taskData.milestone = milestoneId;
    }

    const task = await Task.create(taskData);

    io.to(projectId).emit("taskCreated", task);

    await logActivity({
      workspace: project.workspace,
      project: project._id,
      user: req.user._id,
      action: "created a task",
      entityType: "Task",
      entityId: task._id,
      metadata: {
        taskTitle: task.title,
      },
    });

    res.status(201).json({
      message: "Task created successfully",
      task,
    });
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
};

export const getProjectTasks = async (req, res) => {
  try {
    const { projectId } = req.params;
    const { milestoneId, featureId } = req.query;

    if (!mongoose.isValidObjectId(projectId)) {
      return res.status(400).json({
        message: "Invalid projectId",
      });
    }

    const filter = { project: projectId };

    if (featureId) {
      if (!mongoose.isValidObjectId(featureId)) {
        return res.status(400).json({
          message: "Invalid featureId",
        });
      }
      filter.feature = featureId;
    }

    if (milestoneId) {
      if (milestoneId.toLowerCase() === "none") {
        filter.milestone = null;
      } else {
        if (!mongoose.isValidObjectId(milestoneId)) {
          return res.status(400).json({
            message: "Invalid milestoneId",
          });
        }
        filter.milestone = milestoneId;
      }
    }

    const tasks = await Task.find(filter)
      .populate("feature", "name")
      .populate("milestone", "name")
      .populate("assignee", "name email")
      .populate("createdBy", "name email")
      .populate("comments.user", "name email");

    res.status(200).json({
      tasks,
    });
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
};

export const updateTask = async (req, res) => {
  try {
    const { taskId } = req.params;

    if (!mongoose.isValidObjectId(taskId)) {
      return res.status(400).json({
        message: "Invalid taskId",
      });
    }

    const {
      title,
      description,
      priority,
      dueDate,
      labels,
      milestoneId,
    } = req.body;

    const task = req.task || (await Task.findById(taskId));

    if (!task) {
      return res.status(404).json({
        message: "Task not found",
      });
    }

    if (title !== undefined) {
      if (!title.trim()) {
        return res.status(400).json({
          message: "Title cannot be empty",
        });
      }
      task.title = title.trim();
    }

    if (description !== undefined) {
      task.description = description;
    }

    if (priority !== undefined) {
      const allowedPriorities = ["P0", "P1", "P2"];
      if (!allowedPriorities.includes(priority)) {
        return res.status(400).json({
          message: `Invalid priority. Must be one of: ${allowedPriorities.join(", ")}`,
        });
      }
      task.priority = priority;
    }

    if (dueDate !== undefined) {
      task.dueDate = dueDate ? new Date(dueDate) : null;
    }

    if (labels !== undefined) {
      if (Array.isArray(labels)) {
        task.labels = labels;
      }
    }

    if (milestoneId !== undefined) {
      if (milestoneId === null || milestoneId === "") {
        task.milestone = null;
      } else {
        if (!mongoose.isValidObjectId(milestoneId)) {
          return res.status(400).json({
            message: "Invalid milestoneId",
          });
        }

        const milestoneDoc = await Milestone.findById(milestoneId);
        if (!milestoneDoc) {
          return res.status(404).json({
            message: "Milestone not found",
          });
        }

        if (
          !task.feature ||
          milestoneDoc.feature.toString() !== task.feature.toString()
        ) {
          return res.status(400).json({
            message: "Milestone does not belong to this task's feature",
          });
        }

        task.milestone = milestoneDoc._id;
      }
    }

    await task.save();

    await task.populate([
      { path: "feature", select: "name" },
      { path: "milestone", select: "name" },
      { path: "assignee", select: "name email" },
      { path: "createdBy", select: "name email" },
      { path: "comments.user", select: "name email" },
    ]);

    io.to(task.project.toString()).emit("taskUpdated", task);

    const project = req.project || (await Project.findById(task.project));

    await logActivity({
      workspace: project?.workspace || req.workspace?._id,
      project: task.project,
      user: req.user._id,
      action: "updated a task",
      entityType: "Task",
      entityId: task._id,
      metadata: {
        taskTitle: task.title,
      },
    });

    res.status(200).json({
      message: "Task updated successfully",
      task,
    });
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
};

export const updateTaskStatus = async (req, res) => {
  try {
    const { taskId } = req.params;

    if (!mongoose.isValidObjectId(taskId)) {
      return res.status(400).json({
        message: "Invalid taskId",
      });
    }

    const { status } = req.body;

    const task = req.task || (await Task.findById(taskId));

    if (!task) {
      return res.status(404).json({
        message: "Task not found",
      });
    }

    const project = req.project || (await Project.findById(task.project));

    task.status = status;

    await task.save();

    io.to(task.project.toString()).emit("taskUpdated", task);

    await logActivity({
      workspace: project.workspace,
      project: task.project,
      user: req.user._id,
      action: `moved task to ${status}`,
      entityType: "Task",
      entityId: task._id,
      metadata: {
        status,
      },
    });

    res.status(200).json({
      message: "Task status updated",
      task,
    });
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
};

export const addComment = async (req, res) => {
  try {
    const { taskId } = req.params;

    if (!mongoose.isValidObjectId(taskId)) {
      return res.status(400).json({
        message: "Invalid taskId",
      });
    }

    const { text } = req.body;

    const task = req.task || (await Task.findById(taskId));

    if (!task) {
      return res.status(404).json({
        message: "Task not found",
      });
    }

    const project = req.project || (await Project.findById(task.project));

    task.comments.push({
      user: req.user._id,
      text,
    });

    await task.save();
    await task.populate("comments.user", "name email");

    io.to(task.project.toString()).emit("commentAdded", task);

    await logActivity({
      workspace: project.workspace,
      project: task.project,
      user: req.user._id,
      action: "added a comment",
      entityType: "Comment",
      entityId: task._id,
    });

    res.status(200).json({
      message: "Comment added",
      task,
    });
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
};

export const deleteTask = async (req, res) => {
  try {
    const { taskId } = req.params;

    if (!mongoose.isValidObjectId(taskId)) {
      return res.status(400).json({
        message: "Invalid taskId",
      });
    }

    const task = req.task || (await Task.findById(taskId));

    if (!task) {
      return res.status(404).json({
        message: "Task not found",
      });
    }

    // Project Admins (incl. workspace Owner/Admin) can delete any task;
    // otherwise only the task's own creator can delete it.
    const isCreator = task.createdBy.toString() === req.user._id.toString();
    const isProjectAdmin = req.projectRole === "Admin";

    if (!isCreator && !isProjectAdmin) {
      return res.status(403).json({
        message: "Not authorized to delete this task",
      });
    }

    await task.deleteOne();

    res.status(200).json({
      message: "Task deleted successfully",
    });
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
};
