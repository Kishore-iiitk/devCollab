import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
} from "@dnd-kit/core";
import {
  getTasks,
  createTask,
  updateTask,
  updateTaskStatus,
  addComment,
  deleteTask,
} from "../services/task.service";
import { useToast } from "../context/ToastContext";
import { useConfirm } from "../context/ConfirmContext";
import { useAuth } from "../context/AuthContext";
import Modal from "../components/Modal";
import Button from "../components/Button";
import Select from "../components/Select";
import { canWrite, canManage } from "../utils/roles";

// ── Exact values from backend task.model.js ──────────────────────
const COLUMNS = [
  { id: "To Do", label: "To Do", color: "text-slate-400", dot: "bg-slate-500" },
  {
    id: "In Progress",
    label: "In Progress",
    color: "text-blue-400",
    dot: "bg-blue-500",
  },
  {
    id: "In Review",
    label: "In Review",
    color: "text-amber-400",
    dot: "bg-amber-500",
  },
  {
    id: "Done",
    label: "Done",
    color: "text-emerald-400",
    dot: "bg-emerald-500",
  },
];

const PRIORITIES = [
  { value: "P0", label: "P0 — Critical" },
  { value: "P1", label: "P1 — Medium" },
  { value: "P2", label: "P2 — Low" },
];

const PRIORITY_STYLES = {
  P0: "bg-red-500/15 text-red-300 border-red-500/30",
  P1: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  P2: "bg-slate-700/60 text-slate-400 border-slate-600/40",
};

const STATUS_STYLES = {
  "To Do": "bg-slate-700/60 text-slate-300 border-slate-600/40",
  "In Progress": "bg-blue-500/15 text-blue-300 border-blue-500/30",
  "In Review": "bg-amber-500/15 text-amber-300 border-amber-500/30",
  Done: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
};

function TaskCardContent({ task }) {
  return (
    <>
      <p className="text-sm font-medium text-white mb-2 leading-snug">
        {task.title}
      </p>
      <div className="flex flex-wrap items-center gap-1.5">
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border ${PRIORITY_STYLES[task.priority] || PRIORITY_STYLES.P1
            }`}
        >
          {task.priority || "P1"}
        </span>
        {task.dueDate && (
          <span className="text-xs text-slate-500 font-mono">
            {new Date(task.dueDate).toLocaleDateString()}
          </span>
        )}
        {task.milestone && (
          <span className="text-[11px] bg-indigo-500/10 text-indigo-300 px-1.5 py-0.5 rounded border border-indigo-500/20 truncate max-w-30">
            ⚐ {task.milestone.name || "Milestone"}
          </span>
        )}
      </div>
      {task.labels?.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {task.labels.map((l, i) => (
            <span
              key={i}
              className="text-xs bg-[#1a2035] text-slate-400 px-2 py-0.5 rounded-md border border-[#2a3550]"
            >
              {l}
            </span>
          ))}
        </div>
      )}
      {task.comments?.length > 0 && (
        <p className="text-xs text-slate-600 mt-2">💬 {task.comments.length}</p>
      )}
    </>
  );
}

function DraggableTaskCard({ task, onOpen, disabled }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: task._id,
    data: { task },
    disabled,
  });

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      onClick={() => onOpen(task)}
      className={`bg-[#0d1117] border border-[#1e2535] hover:border-indigo-500/30 rounded-xl p-3.5 transition-all hover:shadow-md animate-fadein ${disabled ? "cursor-pointer" : "cursor-grab active:cursor-grabbing"
        } ${isDragging ? "opacity-30" : ""}`}
    >
      <TaskCardContent task={task} />
    </div>
  );
}

function DroppableColumn({ col, children }) {
  const { setNodeRef, isOver } = useDroppable({ id: col.id });

  return (
    <div
      ref={setNodeRef}
      className={`flex flex-col gap-2 min-h-30 rounded-2xl p-1.5 -m-1.5 transition-colors ${isOver ? "bg-indigo-500/6 ring-1 ring-indigo-500/40" : ""
        }`}
    >
      {children}
    </div>
  );
}

function TaskPage({
  role = "Viewer",
  featureId,
  milestones = [],
  milestoneFilter = "all",
  context = {},
  onTasksChange,
}) {
  const { projectId } = useParams();
  const toast = useToast();
  const confirmDialog = useConfirm();
  const { user } = useAuth();

  const canCreate = canWrite(role);
  const canManageTasks = canManage(role);

  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [createModal, setCreateModal] = useState(false);
  const [detailTask, setDetailTask] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [comment, setComment] = useState("");
  const [addingComment, setAddingComment] = useState(false);
  const [activeTask, setActiveTask] = useState(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    })
  );

  const defaultMilestoneId =
    milestoneFilter && milestoneFilter !== "all" && milestoneFilter !== "none"
      ? milestoneFilter
      : "";

  const [form, setForm] = useState({
    title: "",
    description: "",
    priority: "P1",
    dueDate: "",
    labels: "",
    milestoneId: defaultMilestoneId,
  });

  const fetchTasks = async () => {
    try {
      const data = await getTasks(projectId, featureId ? { featureId } : {});
      const allTasks = data.tasks || [];
      setTasks(allTasks);
      if (onTasksChange) onTasksChange(allTasks);
    } catch (err) {
      toast(err.response?.data?.message || "Failed to load tasks", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
  }, [projectId, featureId, milestones]);

  // Keep detailTask in sync when tasks list updates
  useEffect(() => {
    if (detailTask) {
      const updated = tasks.find((t) => t._id === detailTask._id);
      if (updated) setDetailTask(updated);
    }
  }, [tasks]);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    setSubmitting(true);
    try {
      const body = {
        title: form.title,
        description: form.description,
        priority: form.priority,
        dueDate: form.dueDate || undefined,
        labels: form.labels
          ? form.labels
            .split(",")
            .map((l) => l.trim())
            .filter(Boolean)
          : [],
        projectId,
        featureId,
      };
      if (form.milestoneId) {
        body.milestoneId = form.milestoneId;
      }

      await createTask(body);
      toast("Task created!", "success");
      setCreateModal(false);
      setForm({
        title: "",
        description: "",
        priority: "P1",
        dueDate: "",
        labels: "",
        milestoneId: defaultMilestoneId,
      });
      fetchTasks();
    } catch (err) {
      toast(err.response?.data?.message || "Failed to create task", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleStatusChange = async (taskId, status) => {
    try {
      await updateTaskStatus(taskId, status);
      setTasks((prev) => {
        const next = prev.map((t) => (t._id === taskId ? { ...t, status } : t));
        if (onTasksChange) onTasksChange(next);
        return next;
      });
    } catch (err) {
      toast(err.response?.data?.message || "Failed to update status", "error");
    }
  };

  const handleDragStart = (event) => {
    const task = tasks.find((t) => t._id === event.active.id);
    setActiveTask(task || null);
  };

  const handleDragEnd = (event) => {
    const { active, over } = event;
    setActiveTask(null);
    if (!over) return;

    const taskId = active.id;
    const newStatus = over.id;
    const task = tasks.find((t) => t._id === taskId);
    if (!task || task.status === newStatus) return;

    const prevTasks = tasks;
    const nextTasks = tasks.map((t) =>
      t._id === taskId ? { ...t, status: newStatus } : t
    );
    setTasks(nextTasks);
    if (onTasksChange) onTasksChange(nextTasks);

    updateTaskStatus(taskId, newStatus).catch((err) => {
      setTasks(prevTasks);
      if (onTasksChange) onTasksChange(prevTasks);
      toast(err.response?.data?.message || "Failed to move task", "error");
    });
  };

  const handleDelete = async (taskId) => {
    const ok = await confirmDialog(
      "This will permanently delete the task and its comments.",
      {
        title: "Delete this task?",
        confirmLabel: "Delete",
      }
    );
    if (!ok) return;
    try {
      await deleteTask(taskId);
      toast("Task deleted", "success");
      setDetailTask(null);
      fetchTasks();
    } catch (err) {
      toast(err.response?.data?.message || "Failed to delete task", "error");
    }
  };

  const handleAddComment = async (e) => {
    e.preventDefault();
    if (!comment.trim()) return;
    setAddingComment(true);
    try {
      const data = await addComment(detailTask._id, comment);
      const updatedTask = data.task;
      setTasks((prev) => {
        const next = prev.map((t) =>
          t._id === updatedTask._id ? updatedTask : t
        );
        if (onTasksChange) onTasksChange(next);
        return next;
      });
      setDetailTask(updatedTask);
      setComment("");
    } catch (err) {
      toast(err.response?.data?.message || "Failed to add comment", "error");
    } finally {
      setAddingComment(false);
    }
  };

  // Filter tasks displayed on the board
  const displayedTasks = tasks.filter((t) => {
    if (milestoneFilter === "none") {
      return !t.milestone;
    }
    if (milestoneFilter && milestoneFilter !== "all") {
      const mId = t.milestone?._id || t.milestone;
      return String(mId) === String(milestoneFilter);
    }
    return true;
  });

  const byStatus = (status) =>
    displayedTasks.filter((t) => (t.status || "To Do") === status);

  if (loading) {
    return (
      <div className="p-8">
        <div className="h-6 w-32 bg-[#1a2035] rounded-lg animate-pulse mb-8" />
        <div className="grid grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div
              key={i}
              className="h-48 bg-[#0d1117] border border-[#1e2535] rounded-2xl animate-pulse"
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight">Board</h2>
          <p className="text-slate-400 text-sm mt-0.5">
            Showing {displayedTasks.length} of {tasks.length} task
            {tasks.length !== 1 ? "s" : ""}
          </p>
        </div>
        {canCreate && (
          <Button
            onClick={() => {
              setForm((f) => ({
                ...f,
                milestoneId: defaultMilestoneId,
              }));
              setCreateModal(true);
            }}
          >
            + New Task
          </Button>
        )}
      </div>

      {/* Kanban board */}
      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="grid grid-cols-4 gap-4">
          {COLUMNS.map((col) => {
            const colTasks = byStatus(col.id);
            return (
              <div key={col.id} className="flex flex-col gap-3">
                {/* Column header */}
                <div className="flex items-center gap-2 px-1">
                  <span className={`w-2 h-2 rounded-full ${col.dot}`} />
                  <span
                    className={`text-xs font-semibold uppercase tracking-wider ${col.color}`}
                  >
                    {col.label}
                  </span>
                  <span className="ml-auto text-xs text-slate-600 bg-[#1a2035] px-2 py-0.5 rounded-full">
                    {colTasks.length}
                  </span>
                </div>

                {/* Cards */}
                <DroppableColumn col={col}>
                  {colTasks.map((task) => (
                    <DraggableTaskCard
                      key={task._id}
                      task={task}
                      onOpen={setDetailTask}
                      disabled={!canCreate}
                    />
                  ))}

                  {colTasks.length === 0 && (
                    <div className="border border-dashed border-[#1e2535] rounded-xl h-16 flex items-center justify-center">
                      <span className="text-xs text-slate-700">Empty</span>
                    </div>
                  )}
                </DroppableColumn>
              </div>
            );
          })}
        </div>

        <DragOverlay dropAnimation={{ duration: 180, easing: "ease-out" }}>
          {activeTask && (
            <div className="bg-[#0d1117] border border-indigo-500/50 rounded-xl p-3.5 shadow-2xl shadow-black/50 rotate-2 w-67 cursor-grabbing">
              <TaskCardContent task={activeTask} />
            </div>
          )}
        </DragOverlay>
      </DndContext>

      {/* ── Create Task Modal ─────────────────────────── */}
      {createModal && (
        <Modal
          title="New Task"
          onClose={() => setCreateModal(false)}
          size="lg"
        >
          <form onSubmit={handleCreate} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-slate-400 uppercase tracking-wider">
                Title *
              </label>
              <input
                autoFocus
                placeholder="Task title"
                value={form.title}
                onChange={(e) =>
                  setForm((f) => ({ ...f, title: e.target.value }))
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
                rows={3}
                placeholder="Task details…"
                value={form.description}
                onChange={(e) =>
                  setForm((f) => ({ ...f, description: e.target.value }))
                }
                className="w-full px-3 py-2.5 bg-[#1a2035] border border-[#2a3550] rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500/60 transition-all resize-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Priority
                </label>
                <Select
                  value={form.priority}
                  onChange={(v) => setForm((f) => ({ ...f, priority: v }))}
                  options={PRIORITIES}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Due Date
                </label>
                <input
                  type="date"
                  value={form.dueDate}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, dueDate: e.target.value }))
                  }
                  className="w-full px-3 py-2.5 bg-[#1a2035] border border-[#2a3550] rounded-xl text-sm text-white focus:outline-none focus:border-indigo-500/60 transition-all"
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-slate-400 uppercase tracking-wider">
                Milestone (Optional)
              </label>
              <Select
                value={form.milestoneId}
                onChange={(v) => setForm((f) => ({ ...f, milestoneId: v }))}
                options={[
                  { value: "", label: "No milestone" },
                  ...milestones.map((m) => ({ value: m._id, label: m.name })),
                ]}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-slate-400 uppercase tracking-wider">
                Labels (comma separated)
              </label>
              <input
                placeholder="bug, frontend, urgent"
                value={form.labels}
                onChange={(e) =>
                  setForm((f) => ({ ...f, labels: e.target.value }))
                }
                className="w-full px-3 py-2.5 bg-[#1a2035] border border-[#2a3550] rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500/60 transition-all"
              />
            </div>

            <div className="flex gap-3 justify-end pt-1">
              <Button
                variant="ghost"
                type="button"
                onClick={() => setCreateModal(false)}
              >
                Cancel
              </Button>
              <Button type="submit" loading={submitting}>
                Create Task
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* ── Task Detail Modal ─────────────────────────── */}
      {detailTask && (
        <Modal
          title={detailTask.title}
          onClose={() => setDetailTask(null)}
          size="lg"
        >
          <div className="flex flex-col gap-5">
            {/* Location block */}
            <div className="bg-[#141a29] border border-[#232c42] rounded-xl p-3 flex flex-col gap-1.5 text-xs text-slate-400">
              <span className="font-semibold text-slate-300 uppercase tracking-wider text-[10px]">
                Location
              </span>
              <div className="flex items-center gap-1.5 flex-wrap text-slate-300">
                <span className="text-slate-400">
                  {context?.workspaceName || "Workspace"}
                </span>
                <span className="text-slate-600">→</span>
                <span className="text-slate-400">
                  {context?.projectName || "Project"}
                </span>
                <span className="text-slate-600">→</span>
                <span className="text-indigo-300 font-medium">
                  {context?.featureName || detailTask.feature?.name || "Feature"}
                </span>
                <span className="text-slate-600">→</span>
                <span className="text-slate-300 font-medium">
                  {detailTask.milestone?.name || "No milestone"}
                </span>
              </div>
            </div>

            {/* Badges */}
            <div className="flex flex-wrap gap-2">
              <span
                className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border ${STATUS_STYLES[detailTask.status] || STATUS_STYLES["To Do"]
                  }`}
              >
                {detailTask.status || "To Do"}
              </span>
              <span
                className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border ${PRIORITY_STYLES[detailTask.priority] || PRIORITY_STYLES.P1
                  }`}
              >
                {detailTask.priority || "P1"}
              </span>
              {detailTask.dueDate && (
                <span className="text-xs text-slate-400 border border-[#2a3550] px-2 py-0.5 rounded-md font-mono">
                  Due {new Date(detailTask.dueDate).toLocaleDateString()}
                </span>
              )}
            </div>

            {/* Description */}
            {detailTask.description && (
              <p className="text-sm text-slate-400 leading-relaxed">
                {detailTask.description}
              </p>
            )}

            {/* Labels */}
            {detailTask.labels?.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {detailTask.labels.map((l, i) => (
                  <span
                    key={i}
                    className="text-xs bg-[#1a2035] text-slate-400 px-2.5 py-1 rounded-lg border border-[#2a3550]"
                  >
                    {l}
                  </span>
                ))}
              </div>
            )}

            {/* Assignee */}
            {detailTask.assignee && (
              <p className="text-sm text-slate-500">
                Assigned to:{" "}
                <span className="text-slate-300">
                  {detailTask.assignee?.name || detailTask.assignee}
                </span>
              </p>
            )}

            {/* Created by */}
            {detailTask.createdBy && (
              <p className="text-sm text-slate-500">
                Created by:{" "}
                <span className="text-slate-300">
                  {detailTask.createdBy?.name}
                </span>
              </p>
            )}

            {/* Change Milestone */}
            {canCreate && (
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Milestone
                </label>
                <Select
                  value={detailTask.milestone?._id || detailTask.milestone || ""}
                  onChange={async (newMilestoneId) => {
                    try {
                      const res = await updateTask(detailTask._id, {
                        milestoneId: newMilestoneId || null,
                      });
                      const updated = res.task;
                      setTasks((prev) => {
                        const next = prev.map((t) =>
                          t._id === updated._id ? updated : t
                        );
                        if (onTasksChange) onTasksChange(next);
                        return next;
                      });
                      setDetailTask(updated);
                      toast("Milestone updated", "success");
                    } catch (err) {
                      toast(
                        err.response?.data?.message ||
                        "Failed to update milestone",
                        "error"
                      );
                    }
                  }}
                  options={[
                    { value: "", label: "No milestone" },
                    ...milestones.map((m) => ({ value: m._id, label: m.name })),
                  ]}
                />
              </div>
            )}

            {/* Change Status */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-slate-400 uppercase tracking-wider">
                Change Status
              </label>
              <Select
                value={detailTask.status || "To Do"}
                onChange={(v) => handleStatusChange(detailTask._id, v)}
                disabled={!canCreate}
                options={COLUMNS.map((c) => ({ value: c.id, label: c.label }))}
              />
            </div>

            {/* Delete */}
            {(canManageTasks || detailTask.createdBy?._id === user?.id) && (
              <Button
                variant="danger"
                size="sm"
                className="w-fit"
                onClick={() => handleDelete(detailTask._id)}
              >
                Delete Task
              </Button>
            )}

            {/* Comments */}
            <div className="border-t border-[#1e2535] pt-5">
              <h4 className="text-sm font-semibold text-white mb-4">
                Comments ({detailTask.comments?.length || 0})
              </h4>

              <div className="space-y-3 mb-4 max-h-48 overflow-y-auto pr-1">
                {detailTask.comments?.length === 0 && (
                  <p className="text-sm text-slate-600">No comments yet.</p>
                )}
                {detailTask.comments?.map((c, i) => (
                  <div key={i} className="flex gap-3">
                    <div className="w-7 h-7 rounded-full bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-300 text-xs font-bold shrink-0">
                      {(c.user?.name || "U").slice(0, 2).toUpperCase()}
                    </div>
                    <div className="flex-1 bg-[#1a2035] rounded-xl px-3 py-2.5">
                      <p className="text-xs font-medium text-indigo-300 mb-1">
                        {c.user?.name || "User"}
                      </p>
                      <p className="text-sm text-slate-300">{c.text}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Add comment */}
              {canCreate ? (
                <form onSubmit={handleAddComment} className="flex gap-2">
                  <input
                    placeholder="Write a comment…"
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    className="flex-1 px-3 py-2 bg-[#1a2035] border border-[#2a3550] rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500/60 transition-all"
                  />
                  <Button type="submit" size="sm" loading={addingComment}>
                    Post
                  </Button>
                </form>
              ) : (
                <p className="text-xs text-slate-600">
                  You have view-only access to this project.
                </p>
              )}
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

export default TaskPage;
