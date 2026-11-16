import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getFeatures, createFeature, deleteFeature } from "../services/feature.service";
import { canManage } from "../utils/roles";
import { useToast } from "../context/ToastContext";
import { useConfirm } from "../context/ConfirmContext";
import Modal from "../components/Modal";
import Button from "../components/Button";
import ProgressBar from "../components/ProgressBar";

export default function FeaturesPage({ role = "Viewer" }) {
  const { workspaceId, projectId } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const confirmDialog = useConfirm();

  const [features, setFeatures] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ name: "", description: "" });

  const isManager = canManage(role);

  const fetchFeatures = async () => {
    try {
      const data = await getFeatures(projectId);
      setFeatures(data.features || []);
    } catch (err) {
      toast(err.response?.data?.message || "Failed to load features", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFeatures();
  }, [projectId]);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    setSubmitting(true);
    try {
      await createFeature({
        projectId,
        name: form.name.trim(),
        description: form.description,
      });
      toast("Feature created successfully", "success");
      setModalOpen(false);
      setForm({ name: "", description: "" });
      fetchFeatures();
    } catch (err) {
      toast(err.response?.data?.message || "Failed to create feature", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (e, feature) => {
    e.stopPropagation();
    const ok = await confirmDialog(
      `Deleting "${feature.name}" will permanently delete all of its milestones and tasks. This action cannot be undone.`,
      {
        title: `Delete feature "${feature.name}"?`,
        confirmLabel: "Delete Feature",
      }
    );
    if (!ok) return;

    try {
      await deleteFeature(feature._id);
      toast("Feature deleted", "success");
      setFeatures((prev) => prev.filter((f) => f._id !== feature._id));
    } catch (err) {
      toast(err.response?.data?.message || "Failed to delete feature", "error");
    }
  };

  if (loading) {
    return (
      <div className="p-8">
        <div className="h-8 w-44 bg-[#1a2035] rounded-xl animate-pulse mb-8" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {[...Array(3)].map((_, i) => (
            <div
              key={i}
              className="h-44 bg-[#0d1117] border border-[#1e2535] rounded-2xl animate-pulse"
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
          <h1 className="text-2xl font-bold text-white tracking-tight">Features</h1>
          <p className="text-slate-400 text-sm mt-1">
            {features.length} feature{features.length !== 1 ? "s" : ""} in this project
          </p>
        </div>
        {isManager && (
          <Button onClick={() => setModalOpen(true)}>+ New Feature</Button>
        )}
      </div>

      {/* Features Grid */}
      {features.length === 0 ? (
        <div className="border border-dashed border-[#1e2535] rounded-2xl p-12 text-center flex flex-col items-center justify-center">
          <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 text-xl font-bold mb-4">
            ✦
          </div>
          <h3 className="text-base font-semibold text-white mb-1">No features yet</h3>
          <p className="text-sm text-slate-400 max-w-sm mb-6">
            Features help you group work into milestones and tasks. Create your first feature to get started.
          </p>
          {isManager && (
            <Button onClick={() => setModalOpen(true)}>+ New Feature</Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {features.map((feature) => (
            <div
              key={feature._id}
              onClick={() =>
                navigate(
                  `/app/workspace/${workspaceId}/project/${projectId}/feature/${feature._id}`
                )
              }
              className="bg-[#0d1117] border border-[#1e2535] hover:border-indigo-500/40 rounded-2xl p-6 cursor-pointer transition-all hover:shadow-xl hover:shadow-black/40 group flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-3 mb-2">
                  <h3 className="text-base font-semibold text-white group-hover:text-indigo-400 transition-colors">
                    {feature.name}
                  </h3>
                  {isManager && (
                    <button
                      onClick={(e) => handleDelete(e, feature)}
                      className="text-slate-600 hover:text-red-400 transition-colors p-1 -mr-1 rounded-md hover:bg-red-500/10 opacity-0 group-hover:opacity-100"
                      title="Delete feature"
                    >
                      ✕
                    </button>
                  )}
                </div>

                <p className="text-sm text-slate-400 line-clamp-2 min-h-10 mb-4">
                  {feature.description || "No description provided."}
                </p>
              </div>

              <div className="pt-4 border-t border-[#1e2535] flex flex-col gap-3">
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-[#1a2035] text-slate-300 border border-[#2a3550] font-medium">
                    {feature.milestoneCount || 0} milestone
                    {feature.milestoneCount === 1 ? "" : "s"}
                  </span>
                </div>

                <ProgressBar
                  percent={feature.progress?.percent || 0}
                  done={feature.progress?.done || 0}
                  total={feature.progress?.total || 0}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Feature Modal */}
      {modalOpen && (
        <Modal
          title="New Feature"
          onClose={() => setModalOpen(false)}
          size="md"
        >
          <form onSubmit={handleCreate} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-slate-400 uppercase tracking-wider">
                Name *
              </label>
              <input
                autoFocus
                placeholder="e.g. Authentication, Payment Gateway"
                value={form.name}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, name: e.target.value }))
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
                placeholder="What does this feature entail?"
                value={form.description}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, description: e.target.value }))
                }
                className="w-full px-3 py-2.5 bg-[#1a2035] border border-[#2a3550] rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500/60 transition-all resize-none"
              />
            </div>

            <div className="flex gap-3 justify-end pt-2">
              <Button
                variant="ghost"
                type="button"
                onClick={() => setModalOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit" loading={submitting}>
                Create Feature
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
