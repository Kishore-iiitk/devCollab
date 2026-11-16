import api from "../api/axios";

export const getFeatures = async (projectId) => {
  const res = await api.get(`/features/${projectId}`);
  return res.data;
};

export const getFeature = async (featureId) => {
  const res = await api.get(`/features/detail/${featureId}`);
  return res.data;
};

export const createFeature = async (data) => {
  const res = await api.post("/features", data);
  return res.data;
};

export const updateFeature = async (id, data) => {
  const res = await api.patch(`/features/${id}`, data);
  return res.data;
};

export const deleteFeature = async (id) => {
  const res = await api.delete(`/features/${id}`);
  return res.data;
};
