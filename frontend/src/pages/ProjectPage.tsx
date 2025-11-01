import React, { useEffect, useState } from "react";
import { Folder, Plus, Trash2, AlertTriangle, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { BASE_URL } from "../utils/constant";

interface Project {
  project_id: number;
  project_name: string;
  project_desc: string;
  created_at: string;
}

const ProjectsPage: React.FC = () => {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem("user") || "null");
  const userId = user?.user_id;

  const [projects, setProjects] = useState<Project[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [projectName, setProjectName] = useState("");
  const [projectDesc, setProjectDesc] = useState("");
  const [loading, setLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(false);

  // For delete confirmation modal
  const [deleteConfirm, setDeleteConfirm] = useState<null | Project>(null);
  const [deleting, setDeleting] = useState(false);

  // Fetch all projects
  const fetchProjects = async () => {
    if (!userId) return;
    try {
      setPageLoading(true);
      const res = await fetch(`${BASE_URL}/projects/user/${userId}`);
      const data = await res.json();

      // Handle backend returning null, undefined, or non-array
      const validData = Array.isArray(data) ? data : [];
      setProjects(validData);

      localStorage.setItem("projects", JSON.stringify(validData));
      window.dispatchEvent(new Event("projectsUpdated"));
    } catch (err) {
      console.error("Error fetching projects:", err);
      setProjects([]); // make sure state is empty if error occurs
    } finally {
      setPageLoading(false);
    }
  };

  // Create project
  const handleCreateProject = async () => {
    if (!projectName.trim()) return alert("Enter project name");
    setLoading(true);
    try {
      const res = await fetch(`${BASE_URL}/projects/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: userId,
          project_name: projectName,
          project_desc: projectDesc || "No description",
        }),
      });
      const data = await res.json();
      setProjects((prev) => [...prev, data]);
      localStorage.setItem("projects", JSON.stringify([...projects, data]));
      window.dispatchEvent(new Event("projectsUpdated"));
      setProjectName("");
      setProjectDesc("");
      setShowModal(false);
    } catch (err) {
      console.error("Error creating project:", err);
    } finally {
      setLoading(false);
    }
  };

  // Delete project
  const handleDelete = async (project: Project) => {
    setDeleting(true);
    try {
      await fetch(`${BASE_URL}/projects/${project.project_id}`, {
        method: "DELETE",
      });
      const updated = projects.filter(
        (p) => p.project_id !== project.project_id
      );
      setProjects(updated);
      localStorage.setItem("projects", JSON.stringify(updated));
      window.dispatchEvent(new Event("projectsUpdated"));
      setDeleteConfirm(null);
    } catch (err) {
      console.error("Error deleting project:", err);
    } finally {
      setDeleting(false);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  return (
    <div className="bg-gray-50 min-h-screen">
      {/* MAIN CONTENT */}
      <main className="p-12 md:p-16 flex justify-center">
        <div className="w-full max-w-7xl">
          {/* Header */}
          <div className="flex items-center justify-between mb-12">
            <div>
              <h1 className="text-4xl font-extrabold text-gray-900 tracking-tight">
                My Projects
              </h1>
              <p className="text-gray-600 mt-2 text-lg">
                Manage and explore all your research projects
              </p>
            </div>
            <button
              onClick={() => setShowModal(true)}
              className="bg-blue-700 hover:bg-blue-800 text-white flex items-center space-x-2 px-6 py-3 rounded-lg shadow-md transition-all duration-300"
            >
              <Plus className="h-5 w-5" />
              <span>Create Project</span>
            </button>
          </div>

          <hr className="my-10 border-gray-200" />

          {/* Page Loader */}
          {pageLoading ? (
            <div className="flex flex-col items-center justify-center py-32 text-center">
              <Loader2 className="h-10 w-10 text-blue-600 animate-spin mb-3" />
              <p className="text-gray-600 text-sm font-medium">
                Loading your projects...
              </p>
            </div>
          ) : projects.length === 0 ? (
            // Empty State
            <div className="flex flex-col items-center justify-center mt-32 text-center">
              <Folder className="h-12 w-12 text-gray-400 mb-4" />
              <h2 className="text-xl font-semibold text-gray-700 mb-2">
                No Projects Found
              </h2>
              <p className="text-gray-500 mb-6">
                You haven’t created any projects yet. Start your first one below.
              </p>
              <button
                onClick={() => setShowModal(true)}
                className="bg-blue-700 text-white px-5 py-3 rounded-lg hover:bg-blue-800 transition"
              >
                + Create Project
              </button>
            </div>
          ) : (
            // Projects Grid
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-10">
              {projects.map((proj) => (
                <div
                  key={proj.project_id}
                  className="bg-white border border-gray-200 rounded-xl p-8 shadow-sm hover:shadow-xl hover:border-blue-300 transition-all duration-300 relative cursor-pointer"
                  onClick={() => {
                    localStorage.setItem(
                      "selectedProjectId",
                      proj.project_id.toString()
                    );
                    navigate("/app/upload");
                  }}
                >
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center space-x-2">
                      <Folder className="h-6 w-6 text-blue-600" />
                      <h3 className="text-lg font-semibold text-gray-900">
                        {proj.project_name}
                      </h3>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteConfirm(proj);
                      }}
                      className="text-gray-400 hover:text-red-600 transition"
                    >
                      <Trash2 className="h-5 w-5" />
                    </button>
                  </div>
                  <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                    {proj.project_desc}
                  </p>
                  <p className="text-xs text-gray-400">
                    Created on{" "}
                    {new Date(proj.created_at).toLocaleDateString("en-US", {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Create Project Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
          <div className="bg-white w-full max-w-md rounded-xl shadow-lg p-6 relative">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              Create New Project
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Project Name
                </label>
                <input
                  type="text"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  placeholder="Enter project name"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  value={projectDesc}
                  onChange={(e) => setProjectDesc(e.target.value)}
                  placeholder="Brief description of your project"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 h-24 focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex justify-end space-x-3 pt-2">
                <button
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-lg text-gray-700 hover:bg-gray-100"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateProject}
                  disabled={loading}
                  className="bg-blue-700 hover:bg-blue-800 text-white px-5 py-2 rounded-lg shadow-md flex items-center space-x-2"
                >
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Plus className="h-4 w-4" />
                  )}
                  <span>{loading ? "Creating..." : "Create"}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
          <div className="bg-white w-full max-w-sm rounded-xl shadow-lg p-6 text-center">
            <AlertTriangle className="h-10 w-10 text-red-600 mx-auto mb-3" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Delete Project?
            </h3>
            <p className="text-sm text-gray-600 mb-6">
              Are you sure you want to delete{" "}
              <span className="font-medium text-gray-900">
                {deleteConfirm.project_name}
              </span>
              ? This action cannot be undone.
            </p>
            <div className="flex justify-center space-x-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="px-4 py-2 rounded-lg text-gray-700 hover:bg-gray-100"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deleteConfirm)}
                disabled={deleting}
                className="bg-red-600 hover:bg-red-700 text-white px-5 py-2 rounded-lg flex items-center justify-center space-x-2"
              >
                {deleting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
                <span>{deleting ? "Deleting..." : "Delete"}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProjectsPage;
