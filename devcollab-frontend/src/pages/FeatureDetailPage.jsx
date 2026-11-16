import { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { getProject } from "../services/project.service";
import { getWorkspace } from "../services/workspace.service";
import { getFeature, updateFeature } from "../services/feature.service";
import {
  getMilestones,
  createMilestone,
  updateMilestone,
  deleteMilestone,
} from "../services/milestone.service";
import { calcProgress } from "../utils/progress";
import { canManage } from "../utils/roles";
import { useToast } from "../context/ToastContext";
import { useConfirm } from "../context/ConfirmContext";
import RoleBadge from "../components/RoleBadge";
import ProgressBar from "../components/ProgressBar";
import Modal from "../components/Modal";
import Button from "../components/Button";
import TaskPage from "./TaskPage";

export default function FeatureDetailPage() {
  const { workspaceId, projectId, featureId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const toast = useToast();
  const confirmDialog = useConfirm();

  const [workspace, setWorkspace] = useState(null);
  const [project, setProject] = useState(null);
  const [feature, setFeature] = useState(null);
  const [milestones, setMilestones] = useState([]);
  const [role, setRole] = useState("Viewer");
  const [loaded, setLoaded] = useState(false);

  // Full task list for this feature to compute live progress
  const [allTasks, setAllTasks] = useState([]);

  // Milestone filter directly derived from URL (?milestone=<id|none>)
  const milestoneFilter = searchParams.get("milestone") || "all";

  const selectFilter = (val) => {
    if (val === "all") {
      setSearchParams({}, { replace: true });
    } else {
      setSearchParams({ milestone: val }, { replace: true });
    }
  };

  // Modals
  const [editFeatureModal, setEditFeatureModal] = useState(false);
  const [featureForm, setFeatureForm] = useState({ name: "", description: "" });
  const [featureSubmitting, setFeatureSubmitting] = useState(false);

  const [createMilestoneModal, setCreateMilestoneModal] = useState(false);
  const [milestoneForm, setMilestoneForm] = useState({
    name: "",
    description: "",
    dueDate: "",
  });
  const [milestoneSubmitting, setMilestoneSubmitting] = useState(false);

  const [editMilestoneModal, setEditMilestoneModal] = useState(null); // holds milestone being edited
  const [editMilestoneForm, setEditMilestoneForm] = useState({
    name: "",
    description: "",
    dueDate: "",
  });

  const isManager = canManage(role);

  // Fetch initial data
  useEffect(() => {
    let cancelled = false;

    Promise.all([
      getProject(projectId),
      getWorkspace(workspaceId),
      getFeature(featureId),
      getMilestones(featureId),
    ])
      .then(([projData, wsData, featData, msData]) => {
        if (cancelled) return;
        setProject(projData.project);
        setRole(projData.role || "Viewer");
        setWorkspace(wsData.workspace);
        setFeature(featData.feature);
        setMilestones(msData.milestones || []);
      })
      .catch((err) => {
        if (cancelled) return;
        toast(
          err.response?.data?.message || "Failed to load feature details",
          "error"
        );
      })
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });

    return () => {
      cancelled = true;
    };
  }, [workspaceId, projectId, featureId]);

  // Overall Live Progress
  const overallProgress = useMemo(() => calcProgress(allTasks), [allTasks]);

  // Progress for "No milestone"
  const noMilestoneProgress = useMemo(() => {
    const unassignedTasks = allTasks.filter((t) => !t.milestone);
    return calcProgress(unassignedTasks);
  }, [allTasks]);

  // Progress for each milestone
  const milestoneProgressMap = useMemo(() => {
    const map = new Map();
    for (const m of milestones) {
      const msTasks = allTasks.filter((t) => {
        const id = t.milestone?._id || t.milestone;
        return String(id) === String(m._id);
      });
      map.set(m._id, calcProgress(msTasks));
    }
    return map;
  }, [allTasks, milestones]);

  // Handle Edit Feature
  const handleEditFeature = async (e) => {
    e.preventDefault();
    if (!featureForm.name.trim()) return;
    setFeatureSubmitting(true);
    try {
      const res = await updateFeature(featureId, {
        name: featureForm.name.trim(),
        description: featureForm.description,
      });
      setFeature(res.feature);
      toast("Feature updated", "success");
      setEditFeatureModal(false);
    } catch (err) {
      toast(err.response?.data?.message || "Failed to update feature", "error");
    } finally {
      setFeatureSubmitting(false);
    }
  };

  // Handle Create Milestone
  const handleCreateMilestone = async (e) => {
    e.preventDefault();
    if (!milestoneForm.name.trim()) return;
    setMilestoneSubmitting(true);
    try {
      const res = await createMilestone({
        projectId,
        featureId,
        name: milestoneForm.name.trim(),
        description: milestoneForm.description,
        dueDate: milestoneForm.dueDate || undefined,
      });
      toast("Milestone created", "success");
      setMilestones((prev) => [...prev, res.milestone]);
      setCreateMilestoneModal(false);
      setMilestoneForm({ name: "", description: "", dueDate: "" });
    } catch (err) {
      toast(err.response?.data?.message || "Failed to create milestone", "error");
    } finally {
      setMilestoneSubmitting(false);
    }
  };

  // Handle Edit Milestone
  const handleUpdateMilestone = async (e) => {
    e.preventDefault();
    if (!editMilestoneForm.name.trim() || !editMilestoneModal) return;
    try {
      const res = await updateMilestone(editMilestoneModal._id, {
        name: editMilestoneForm.name.trim(),
        description: editMilestoneForm.description,
        dueDate: editMilestoneForm.dueDate || undefined,
      });
      toast("Milestone updated", "success");
      setMilestones((prev) =>
        prev.map((m) => (m._id === editMilestoneModal._id ? res.milestone : m))
      );
      setEditMilestoneModal(null);
    } catch (err) {
      toast(err.response?.data?.message || "Failed to update milestone", "error");
    }
  };

  // Handle Delete Milestone
  const handleDeleteMilestone = async (e, m) => {
    e.stopPropagation();
    const ok = await confirmDialog(
      "Deleting this milestone will NOT delete its tasks. The tasks will be kept and will become 'No milestone'.",
      {
        title: `Delete milestone "${m.name}"?`,
        confirmLabel: "Delete Milestone",
      }
    );
    if (!ok) return;

    try {
      await deleteMilestone(m._id);
      toast("Milestone deleted", "success");
      setMilestones((prev) => prev.filter((item) => item._id !== m._id));
      setAllTasks((prev) =>
        prev.map((t) => {
          const mId = t.milestone?._id || t.milestone;
          return String(mId) === String(m._id) ? { ...t, milestone: null } : t;
        })
      );
      if (milestoneFilter === m._id) {
        selectFilter("all");
      }
    } catch (err) {
      toast(err.response?.data?.message || "Failed to delete milestone", "error");
    }
  };

  if (!loaded) {
    return (
      <div className="p-8">
        <div className="h-6 w-36 bg-[#1a2035] rounded animate-pulse mb-6" />
        <div className="h-24 bg-[#0d1117] border border-[#1e2535] rounded-2xl animate-pulse mb-8" />
        <div className="h-96 bg-[#0d1117] border border-[#1e2535] rounded-2xl animate-pulse" />
      </div>
    );
  }

  return (
    <div>
      {/* Sub-nav */}
      <div className="border-b border-[#1e2535] px-8 pt-5 pb-4 flex items-center justify-between">
        <button
          onClick={() =>
            navigate(`/app/workspace/${workspaceId}/project/${projectId}`)
          }
          className="text-slate-500 hover:text-slate-300 text-sm flex items-center gap-1.5 transition-colors"
        >
          ← Back to Project
        </button>
        <RoleBadge role={role} />
      </div>

      <div className="px-8 pt-6 pb-2">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-xs text-slate-500 mb-3 font-medium">
          <span className="hover:text-slate-400 transition-colors">
            {workspace?.name || "Workspace"}
          </span>
          <span className="text-slate-600">/</span>
          <span className="hover:text-slate-400 transition-colors">
            {project?.name || "Project"}
          </span>
          <span className="text-slate-600">/</span>
          <span className="text-indigo-400 font-semibold">
            {feature?.name || "Feature"}
          </span>
        </div>

        {/* Feature Header */}
        <div className="bg-[#0d1117] border border-[#1e2535] rounded-2xl p-6 mb-8 flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-sm">
          <div className="flex-1 max-w-2xl">
            <div className="flex items-center gap-3 mb-1.5">
              <h1 className="text-2xl font-bold text-white tracking-tight">
                {feature?.name}
              </h1>
              {isManager && (
                <button
                  onClick={() => {
                    setFeatureForm({
                      name: feature?.name || "",
                      description: feature?.description || "",
                    });
                    setEditFeatureModal(true);
                  }}
                  className="text-xs text-slate-400 hover:text-indigo-400 bg-[#1a2035] border border-[#2a3550] px-2.5 py-1 rounded-lg transition-colors"
                >
                  Edit Feature
                </button>
              )}
            </div>
            <p className="text-sm text-slate-400 leading-relaxed">
              {feature?.description || "No description provided."}
            </p>
          </div>

          <div className="w-full md:w-72 bg-[#141a29] border border-[#1e2535] rounded-xl p-4 flex flex-col justify-center">
            <span className="text-xs font-medium text-slate-400 mb-2 uppercase tracking-wider text-[11px]">
              Feature Progress
            </span>
            <ProgressBar
              percent={overallProgress.percent}
              done={overallProgress.done}
              total={overallProgress.total}
            />
          </div>
        </div>

        {/* Milestones Filter Bar */}
        <div className="mb-2">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                Milestones
              </span>
              <span className="text-xs text-slate-500 font-mono">
                ({milestones.length})
              </span>
            </div>
            {isManager && (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setCreateMilestoneModal(true)}
              >
                + New Milestone
              </Button>
            )}
          </div>

          <div className="flex items-stretch gap-3 overflow-x-auto pb-3 pt-1 scrollbar-thin">
            {/* All Tasks Chip */}
            <div
              onClick={() => selectFilter("all")}
              className={`shrink-0 w-48 p-3.5 rounded-xl border cursor-pointer transition-all ${milestoneFilter === "all"
                  ? "bg-indigo-500/10 border-indigo-500/60 ring-1 ring-indigo-500/30"
                  : "bg-[#0d1117] border-[#1e2535] hover:border-slate-700"
                }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-white">All tasks</span>
                <span className="text-[11px] font-mono text-indigo-400 font-medium">
                  {overallProgress.percent}%
                </span>
              </div>
              <ProgressBar
                percent={overallProgress.percent}
                done={overallProgress.done}
                total={overallProgress.total}
                showLabel={false}
              />
            </div>

            {/* No Milestone Chip */}
            <div
              onClick={() => selectFilter("none")}
              className={`shrink-0 w-48 p-3.5 rounded-xl border cursor-pointer transition-all ${milestoneFilter === "none"
                  ? "bg-indigo-500/10 border-indigo-500/60 ring-1 ring-indigo-500/30"
                  : "bg-[#0d1117] border-[#1e2535] hover:border-slate-700"
                }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-slate-300">
                  No milestone
                </span>
                <span className="text-[11px] font-mono text-slate-400 font-medium">
                  {noMilestoneProgress.total} tasks
                </span>
              </div>
              <ProgressBar
                percent={noMilestoneProgress.percent}
                done={noMilestoneProgress.done}
                total={noMilestoneProgress.total}
                showLabel={false}
              />
            </div>

            {/* Milestone Cards */}
            {milestones.map((m) => {
              const prog = milestoneProgressMap.get(m._id) || {
                total: 0,
                done: 0,
                percent: 0,
              };
              const isSelected = milestoneFilter === m._id;

              return (
                <div
                  key={m._id}
                  onClick={() => selectFilter(m._id)}
                  className={`shrink-0 w-56 p-3.5 rounded-xl border cursor-pointer transition-all relative group flex flex-col justify-between ${isSelected
                      ? "bg-indigo-500/10 border-indigo-500/60 ring-1 ring-indigo-500/30"
                      : "bg-[#0d1117] border-[#1e2535] hover:border-slate-700"
                    }`}
                >
                  <div>
                    <div className="flex items-start justify-between gap-1 mb-1">
                      <span className="text-xs font-semibold text-white truncate max-w-37.5">
                        {m.name}
                      </span>
                      {isManager && (
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditMilestoneModal(m);
                              setEditMilestoneForm({
                                name: m.name || "",
                                description: m.description || "",
                                dueDate: m.dueDate
                                  ? m.dueDate.split("T")[0]
                                  : "",
                              });
                            }}
                            className="text-[11px] text-slate-500 hover:text-indigo-400 p-0.5"
                            title="Edit milestone"
                          >
                            ✎
                          </button>
                          <button
                            onClick={(e) => handleDeleteMilestone(e, m)}
                            className="text-[11px] text-slate-500 hover:text-red-400 p-0.5"
                            title="Delete milestone"
                          >
                            ✕
                          </button>
                        </div>
                      )}
                    </div>
                    {m.dueDate && (
                      <span className="text-[10px] text-slate-500 font-mono block mb-2">
                        Due {new Date(m.dueDate).toLocaleDateString()}
                      </span>
                    )}
                  </div>

                  <div className="mt-2">
                    <ProgressBar
                      percent={prog.percent}
                      done={prog.done}
                      total={prog.total}
                      showLabel={false}
                    />
                    <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono mt-1.5">
                      <span>
                        {prog.done}/{prog.total} done
                      </span>
                      <span className="text-indigo-400 font-semibold">
                        {prog.percent}%
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Task Kanban Board */}
      <TaskPage
        role={role}
        featureId={featureId}
        milestones={milestones}
        milestoneFilter={milestoneFilter}
        context={{
          workspaceName: workspace?.name,
          projectName: project?.name,
          featureName: feature?.name,
        }}
        onTasksChange={setAllTasks}
      />

      {/* Edit Feature Modal */}
      {editFeatureModal && (
        <Modal
          title="Edit Feature"
          onClose={() => setEditFeatureModal(false)}
          size="md"
        >
          <form onSubmit={handleEditFeature} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-slate-400 uppercase tracking-wider">
                Name *
              </label>
              <input
                autoFocus
                value={featureForm.name}
                onChange={(e) =>
                  setFeatureForm((f) => ({ ...f, name: e.target.value }))
                }
                required
                className="w-full px-3 py-2.5 bg-[#1a2035] border border-[#2a3550] rounded-xl text-sm text-white focus:outline-none focus:border-indigo-500/60 transition-all"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-slate-400 uppercase tracking-wider">
                Description
              </label>
              <textarea
                rows={3}
                value={featureForm.description}
                onChange={(e) =>
                  setFeatureForm((f) => ({ ...f, description: e.target.value }))
                }
                className="w-full px-3 py-2.5 bg-[#1a2035] border border-[#2a3550] rounded-xl text-sm text-white focus:outline-none focus:border-indigo-500/60 transition-all resize-none"
              />
            </div>

            <div className="flex gap-3 justify-end pt-2">
              <Button
                variant="ghost"
                type="button"
                onClick={() => setEditFeatureModal(false)}
              >
                Cancel
              </Button>
              <Button type="submit" loading={featureSubmitting}>
                Save Changes
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Create Milestone Modal */}
      {createMilestoneModal && (
        <Modal
          title="New Milestone"
          onClose={() => setCreateMilestoneModal(false)}
          size="md"
        >
          <form
            onSubmit={handleCreateMilestone}
            className="flex flex-col gap-4"
          >
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-slate-400 uppercase tracking-wider">
                Name *
              </label>
              <input
                autoFocus
                placeholder="e.g. v1.0 Launch, Beta Release"
                value={milestoneForm.name}
                onChange={(e) =>
                  setMilestoneForm((f) => ({ ...f, name: e.target.value }))
                }
                required
                className="w-full px-3 py-2.5 bg-[#1a2035] border border-[#2a3550] rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500/60 transition-all"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-slate-400 uppercase tracking-wider">
                Description
              </label>
              <textarea
                rows={2}
                placeholder="Milestone goals or notes…"
                value={milestoneForm.description}
                onChange={(e) =>
                  setMilestoneForm((f) => ({
                    ...f,
                    description: e.target.value,
                  }))
                }
                className="w-full px-3 py-2.5 bg-[#1a2035] border border-[#2a3550] rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500/60 transition-all resize-none"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-slate-400 uppercase tracking-wider">
                Due Date
              </label>
              <input
                type="date"
                value={milestoneForm.dueDate}
                onChange={(e) =>
                  setMilestoneForm((f) => ({ ...f, dueDate: e.target.value }))
                }
                className="w-full px-3 py-2.5 bg-[#1a2035] border border-[#2a3550] rounded-xl text-sm text-white focus:outline-none focus:border-indigo-500/60 transition-all"
              />
            </div>

            <div className="flex gap-3 justify-end pt-2">
              <Button
                variant="ghost"
                type="button"
                onClick={() => setCreateMilestoneModal(false)}
              >
                Cancel
              </Button>
              <Button type="submit" loading={milestoneSubmitting}>
                Create Milestone
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Edit Milestone Modal */}
      {editMilestoneModal && (
        <Modal
          title="Edit Milestone"
          onClose={() => setEditMilestoneModal(null)}
          size="md"
        >
          <form
            onSubmit={handleUpdateMilestone}
            className="flex flex-col gap-4"
          >
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-slate-400 uppercase tracking-wider">
                Name *
              </label>
              <input
                autoFocus
                value={editMilestoneForm.name}
                onChange={(e) =>
                  setEditMilestoneForm((f) => ({ ...f, name: e.target.value }))
                }
                required
                className="w-full px-3 py-2.5 bg-[#1a2035] border border-[#2a3550] rounded-xl text-sm text-white focus:outline-none focus:border-indigo-500/60 transition-all"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-slate-400 uppercase tracking-wider">
                Description
              </label>
              <textarea
                rows={2}
                value={editMilestoneForm.description}
                onChange={(e) =>
                  setEditMilestoneForm((f) => ({
                    ...f,
                    description: e.target.value,
                  }))
                }
                className="w-full px-3 py-2.5 bg-[#1a2035] border border-[#2a3550] rounded-xl text-sm text-white focus:outline-none focus:border-indigo-500/60 transition-all resize-none"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-slate-400 uppercase tracking-wider">
                Due Date
              </label>
              <input
                type="date"
                value={editMilestoneForm.dueDate}
                onChange={(e) =>
                  setEditMilestoneForm((f) => ({
                    ...f,
                    dueDate: e.target.value,
                  }))
                }
                className="w-full px-3 py-2.5 bg-[#1a2035] border border-[#2a3550] rounded-xl text-sm text-white focus:outline-none focus:border-indigo-500/60 transition-all"
              />
            </div>

            <div className="flex gap-3 justify-end pt-2">
              <Button
                variant="ghost"
                type="button"
                onClick={() => setEditMilestoneModal(null)}
              >
                Cancel
              </Button>
              <Button type="submit">Save Changes</Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
