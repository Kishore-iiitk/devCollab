import api from "../api/axios";

export const getWorkspaces = async (token) => {
  const response = await api.get("/workspaces", {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  return response.data;
};

export const createWorkspace = async (
  workspaceData,
  token
) => {
  const response = await api.post(
    "/workspaces",
    workspaceData,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  return response.data;
};