import dotenv from "dotenv";
dotenv.config();
import mongoose from "mongoose";
import Project from "../src/models/project.model.js";
import Feature from "../src/models/feature.model.js";
import Milestone from "../src/models/milestone.model.js";
import Task from "../src/models/task.model.js";

const migrate = async () => {
  const isDryRun = process.argv.includes("--dry-run");
  if (isDryRun) {
    console.log("[DRY RUN MODE] Running migration in dry-run mode. No writes will be performed.");
  }

  const mongoUri = process.env.MONGO_URI;
  if (!mongoUri) {
    console.error("MONGO_URI is missing in .env");
    process.exit(1);
  }

  try {
    await mongoose.connect(mongoUri);
    console.log("Connected to MongoDB for migration.");

    // a. Backfill: every Feature missing workspace gets workspace from its Project.
    const featuresMissingWorkspace = await Feature.find({
      $or: [{ workspace: { $exists: false } }, { workspace: null }],
    });
    let backfilledFeaturesCount = 0;
    let skippedFeaturesCount = 0;
    for (const feat of featuresMissingWorkspace) {
      const proj = await Project.findById(feat.project);
      if (proj && proj.workspace) {
        if (!isDryRun) {
          await Feature.updateOne(
            { _id: feat._id },
            { $set: { workspace: proj.workspace } },
            { timestamps: false }
          );
        }
        backfilledFeaturesCount++;
      } else {
        skippedFeaturesCount++;
      }
    }
    console.log(
      `Step A (Backfill): ${isDryRun ? "Would update" : "Updated"} ${backfilledFeaturesCount} features with missing workspace. Skipped features whose project no longer exists: ${skippedFeaturesCount}.`
    );

    // b. Repair: every Task that has a milestone but no feature gets feature = that milestone's feature.
    const tasksNeedingRepair = await Task.find({
      milestone: { $exists: true, $ne: null },
      $or: [{ feature: { $exists: false } }, { feature: null }],
    });
    let repairedTasksCount = 0;
    for (const task of tasksNeedingRepair) {
      const milestone = await Milestone.findById(task.milestone);
      if (milestone && milestone.feature) {
        if (!isDryRun) {
          await Task.updateOne(
            { _id: task._id },
            { $set: { feature: milestone.feature } },
            { timestamps: false }
          );
        }
        repairedTasksCount++;
      }
    }
    console.log(
      `Step B (Repair): ${isDryRun ? "Would repair" : "Repaired"} ${repairedTasksCount} tasks from their milestone's feature.`
    );

    // c. For each Project that still has tasks with no feature: find or create Feature "General", then Task.updateMany.
    const unassignedProjectIds = await Task.distinct("project", {
      $or: [{ feature: { $exists: false } }, { feature: null }],
    });
    let generalFeaturesCreated = 0;
    let tasksAssignedToGeneral = 0;
    let orphanTasksSkipped = 0;

    for (const projId of unassignedProjectIds) {
      const project = await Project.findById(projId);
      if (!project) {
        const orphanCount = await Task.countDocuments({
          project: projId,
          $or: [{ feature: { $exists: false } }, { feature: null }],
        });
        orphanTasksSkipped += orphanCount;
        continue;
      }

      let generalFeature = await Feature.findOne({
        project: project._id,
        name: "General",
      });

      if (!generalFeature) {
        if (!isDryRun) {
          generalFeature = await Feature.create({
            name: "General",
            description: "Default feature for legacy tasks",
            workspace: project.workspace,
            project: project._id,
            createdBy: project.createdBy,
          });
        }
        generalFeaturesCreated++;
      }

      if (!isDryRun) {
        const updateRes = await Task.updateMany(
          {
            project: project._id,
            $or: [{ feature: { $exists: false } }, { feature: null }],
          },
          { $set: { feature: generalFeature._id } },
          { timestamps: false }
        );
        tasksAssignedToGeneral += updateRes.modifiedCount;
      } else {
        const wouldUpdateCount = await Task.countDocuments({
          project: project._id,
          $or: [{ feature: { $exists: false } }, { feature: null }],
        });
        tasksAssignedToGeneral += wouldUpdateCount;
      }
    }
    console.log(
      `Step C (General Features): ${isDryRun ? "Would create" : "Created"} ${generalFeaturesCreated} "General" features; ${isDryRun ? "would update" : "updated"} ${tasksAssignedToGeneral} tasks. Skipped orphan tasks whose project no longer exists: ${orphanTasksSkipped}.`
    );

    // d. Cleanup: delete any Milestone named "General" that has zero tasks and whose feature is a "General" feature.
    const generalFeatures = await Feature.find({ name: "General" });
    const generalFeatureIds = generalFeatures.map((f) => f._id);

    const generalMilestones = await Milestone.find({
      name: "General",
      feature: { $in: generalFeatureIds },
    });

    let cleanedMilestonesCount = 0;
    for (const m of generalMilestones) {
      const taskCount = await Task.countDocuments({ milestone: m._id });
      if (taskCount === 0) {
        if (!isDryRun) {
          await m.deleteOne();
        }
        cleanedMilestonesCount++;
      }
    }
    console.log(
      `Step D (Cleanup): ${isDryRun ? "Would delete" : "Deleted"} ${cleanedMilestonesCount} unused "General" milestones.`
    );

    console.log(`Migration ${isDryRun ? "[DRY RUN] " : ""}completed successfully.`);
  } catch (error) {
    console.error("Migration failed:", error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log("Disconnected from MongoDB.");
  }
};

migrate();
