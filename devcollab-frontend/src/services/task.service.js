import api from "../api/axios";

export const getTasks = async (projectId, { featureId, milestoneId } = {}) => {
  const params = {};
  if (featureId) params.featureId = featureId;
  if (milestoneId !== undefined && milestoneId !== null && milestoneId !== "") {
    params.milestoneId = milestoneId;
  }
  const res = await api.get(`/tasks/${projectId}`, { params });
  return res.data;
};

export const createTask = async (data) => {
  const res = await api.post("/tasks", data);
  return res.data;
};

export const updateTask = async (taskId, data) => {
  const res = await api.patch(`/tasks/${taskId}`, data);
  return res.data;
};

export const updateTaskStatus = async (taskId, status) => {
  const res = await api.patch(`/tasks/${taskId}/status`, { status });
  return res.data;
};

export const addComment = async (taskId, text) => {
  const res = await api.post(`/tasks/${taskId}/comments`, { text });
  return res.data;
};

export const deleteTask = async (taskId) => {
  const res = await api.delete(`/tasks/${taskId}`);
  return res.data;
};
