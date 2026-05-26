import { useEffect, useState } from "react";

import {
  getWorkspaces,
  createWorkspace,
} from "../services/workspace.service";

import { useAuth } from "../context/AuthContext";

function WorkspacePage() {
  const { token } = useAuth();

  const [workspaces, setWorkspaces] = useState([]);

  const [name, setName] = useState("");

  const fetchWorkspaces = async () => {
    try {
      const data = await getWorkspaces(token);

      setWorkspaces(data.workspaces);
    } catch (error) {
      console.log(error);
    }
  };

  useEffect(() => {
    fetchWorkspaces();
  }, []);

  const handleCreateWorkspace = async (e) => {
    e.preventDefault();

    try {
      await createWorkspace(
        {
          name,
          description: "Frontend created workspace",
        },
        token
      );

      setName("");

      fetchWorkspaces();
    } catch (error) {
      console.log(error);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-4xl font-bold">
          Workspaces
        </h1>
      </div>

      <form
        onSubmit={handleCreateWorkspace}
        className="flex gap-4 mb-8"
      >
        <input
          type="text"
          placeholder="Workspace name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="bg-slate-800 p-3 rounded w-[300px]"
        />

        <button className="bg-blue-600 hover:bg-blue-700 px-5 rounded">
          Create
        </button>
      </form>

      <div className="grid grid-cols-3 gap-5">
        {workspaces.map((workspace) => (
          <div
            key={workspace._id}
            className="bg-slate-800 p-5 rounded-xl border border-slate-700"
          >
            <h2 className="text-2xl font-semibold mb-2">
              {workspace.name}
            </h2>

            <p className="text-slate-400">
              {workspace.description}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

export default WorkspacePage;