import api from "../api/axios";

export const getMilestones = async (featureId) => {
  const res = await api.get(`/milestones/feature/${featureId}`);
  return res.data;
};

export const createMilestone = async (data) => {
  const res = await api.post("/milestones", data);
  return res.data;
};

export const updateMilestone = async (id, data) => {
  const res = await api.patch(`/milestones/${id}`, data);
  return res.data;
};

export const deleteMilestone = async (id) => {
  const res = await api.delete(`/milestones/${id}`);
  return res.data;
};
