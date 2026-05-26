import mongoose from "mongoose";

const versionSchema = new mongoose.Schema(
  {
    content: {
      type: String,
      required: true,
    },

    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    updatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    _id: false,
  }
);

const wikiSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },

    content: {
      type: String,
      default: "",
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

    versions: [versionSchema],
  },
  {
    timestamps: true,
  }
);

const Wiki = mongoose.model("Wiki", wikiSchema);

export default Wiki;