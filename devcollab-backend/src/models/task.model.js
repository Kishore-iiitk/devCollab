import mongoose from "mongoose";

const commentSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    text: {
      type: String,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

const taskSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },

    description: {
      type: String,
      default: "",
    },

    status: {
      type: String,
      enum: ["To Do", "In Progress", "In Review", "Done"],
      default: "To Do",
    },

    priority: {
      type: String,
      enum: ["P0", "P1", "P2"],
      default: "P2",
    },

    dueDate: {
      type: Date,
    },

    labels: {
      type: [String],
      default: [],
    },

    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      required: true,
    },

    feature: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Feature",
    },

    milestone: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Milestone",
    },

    assignee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    comments: [commentSchema],
  },
  {
    timestamps: true,
  }
);

taskSchema.index({ project: 1, milestone: 1 });
taskSchema.index({ feature: 1 });
taskSchema.index({ feature: 1, milestone: 1 });

const Task = mongoose.model("Task", taskSchema);

export default Task;