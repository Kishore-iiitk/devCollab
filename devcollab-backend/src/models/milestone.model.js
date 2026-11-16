import mongoose from "mongoose";

const milestoneSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    description: {
      type: String,
      default: "",
    },

    dueDate: {
      type: Date,
    },

    feature: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Feature",
      required: true,
    },

    project: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project",
      required: true,
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

milestoneSchema.index({ feature: 1 });
milestoneSchema.index({ project: 1 });

const Milestone = mongoose.model("Milestone", milestoneSchema);

export default Milestone;
