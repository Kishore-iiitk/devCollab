import Project from "../models/project.model.js";
import Task from "../models/task.model.js";

import { generateAIResponse } from "../services/ai.service.js";

export const summarizeProject = async (req, res) => {
  try {
    const { projectId } = req.params;

    const project = await Project.findById(projectId);

    const tasks = await Task.find({
      project: projectId,
    });

    const prompt = `
    Project Name: ${project.name}

    Tasks:
    ${tasks
      .map(
        (task) =>
          `- ${task.title} | Status: ${task.status} | Priority: ${task.priority}`
      )
      .join("\n")}

    Give a concise progress summary of this software project.
    `;

    const summary = await generateAIResponse(prompt);

    res.status(200).json({
      summary,
    });
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
};

export const detectBlockers = async (req, res) => {
  try {
    const { projectId } = req.params;

    const tasks = await Task.find({
      project: projectId,
      status: "In Progress",
    });

    const prompt = `
    These tasks have been in progress:

    ${tasks.map((task) => `- ${task.title}`).join("\n")}

    Identify possible blockers and risks in this project.
    `;

    const blockers = await generateAIResponse(prompt);

    res.status(200).json({
      blockers,
    });
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
};

export const generateSubtasks = async (req, res) => {
  try {
    const { feature } = req.body;

    const prompt = `
    Break this software feature into actionable development subtasks.

    Feature:
    ${feature}

    Return concise bullet points.
    `;

    const subtasks = await generateAIResponse(prompt);

    res.status(200).json({
      subtasks,
    });
  } catch (error) {
    res.status(500).json({
      message: error.message,
    });
  }
};