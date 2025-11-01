import React, { useEffect, useState, useRef } from "react";
import { User, ChevronDown, Plus } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface UserInfo {
  user_id: number;
  name: string;
  email: string;
  affiliation: string;
}

const Navbar: React.FC = () => {
  const navigate = useNavigate();
  const user: UserInfo | null = JSON.parse(localStorage.getItem("user") || "null");

  const [projects, setProjects] = useState<any[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>(
    localStorage.getItem("selectedProjectId") || ""
  );
  const [showProfile, setShowProfile] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  // ✅ Load projects from localStorage
  const updateProjects = () => {
    const storedProjects = JSON.parse(localStorage.getItem("projects") || "[]");
    setProjects(storedProjects);

    // 🔹 Set first project as default if none selected
    const storedSelected = localStorage.getItem("selectedProjectId");
    if (!storedSelected && storedProjects.length > 0) {
      const firstId = storedProjects[0].project_id;
      localStorage.setItem("selectedProjectId", firstId);
      setSelectedProjectId(firstId);
      window.dispatchEvent(new Event("projectChanged"));
    } else {
      setSelectedProjectId(storedSelected || "");
    }
  };

  // ✅ Initialize + sync with storage changes
  useEffect(() => {
    updateProjects();

    const handleStorage = (e: StorageEvent) => {
      if (["projects", "selectedProjectId"].includes(e.key || "")) {
        updateProjects();
      }
    };

    const handleFocus = () => updateProjects();

    window.addEventListener("projectsUpdated", updateProjects);
    window.addEventListener("storage", handleStorage);
    document.addEventListener("visibilitychange", handleFocus);

    return () => {
      window.removeEventListener("projectsUpdated", updateProjects);
      window.removeEventListener("storage", handleStorage);
      document.removeEventListener("visibilitychange", handleFocus);
    };
  }, []);

  // ✅ Update when another component triggers a project change
  useEffect(() => {
    const handleProjectChange = () => {
      setSelectedProjectId(localStorage.getItem("selectedProjectId") || "");
    };
    window.addEventListener("projectChanged", handleProjectChange);
    return () => window.removeEventListener("projectChanged", handleProjectChange);
  }, []);

  // ✅ Close profile popup when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setShowProfile(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // ✅ Handle project change + reload current page
  const handleProjectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedId = e.target.value;
    localStorage.setItem("selectedProjectId", selectedId);
    setSelectedProjectId(selectedId);
    window.dispatchEvent(new Event("projectChanged"));

    // 🔄 Reload the current page to reflect new project context
    window.location.reload();
  };

  return (
    <nav className="bg-white border-b border-gray-200 fixed w-full z-30 top-0 shadow-sm">
      <div className="px-6 py-4">
        <div className="flex items-center justify-between">
          {/* ✅ Left Logo */}
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-gradient-to-r from-blue-700 to-teal-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">iS</span>
            </div>
            <span className="text-xl font-bold text-gray-900">
              i-SMART Research Scholar
            </span>
          </div>

          {/* ✅ Right Section */}
          <div className="flex items-center space-x-4 relative">
            {/* Project Dropdown */}
            <div className="relative">
              <select
                className="appearance-none border border-gray-300 rounded-lg px-4 py-2 text-sm font-medium text-gray-700 bg-white hover:border-blue-400 focus:ring-2 focus:ring-blue-500 focus:outline-none cursor-pointer pr-8"
                onChange={handleProjectChange}
                value={selectedProjectId}
              >
                <option value="">Select Project</option>
                {projects.map((proj) => (
                  <option key={proj.project_id} value={proj.project_id}>
                    {proj.project_name}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-500 h-4 w-4 pointer-events-none" />
            </div>

            {/* If no projects → Show Create Project Button */}
            {projects.length === 0 && (
              <button
                onClick={() => navigate("/app/projects")}
                className="flex items-center space-x-2 bg-blue-700 hover:bg-blue-800 text-white px-3 py-2 rounded-lg text-sm font-medium shadow-sm transition"
              >
                <Plus className="h-4 w-4" />
                <span>Create Project</span>
              </button>
            )}

            {/* ✅ User Icon & Profile */}
            {user && (
              <div ref={profileRef} className="relative">
                <button
                  onClick={() => setShowProfile(!showProfile)}
                  className="flex items-center space-x-2 bg-blue-50 text-blue-700 px-3 py-2 rounded-lg font-medium hover:bg-blue-100 transition"
                >
                  <User className="h-4 w-4" />
                  <span>{user.name}</span>
                </button>

                {/* Profile Card Popup */}
                {showProfile && (
                  <div className="absolute right-0 mt-2 w-64 bg-white shadow-lg rounded-lg border border-gray-200 p-4 z-50">
                    <div className="flex items-center space-x-3 mb-3">
                      <div className="w-10 h-10 bg-gradient-to-r from-blue-600 to-teal-500 rounded-full flex items-center justify-center text-white font-semibold text-lg">
                        {user.name?.charAt(0)}
                      </div>
                      <div>
                        <h4 className="font-semibold text-gray-900">{user.name}</h4>
                        <p className="text-xs text-gray-500">{user.affiliation}</p>
                      </div>
                    </div>
                    <div className="border-t border-gray-200 my-2"></div>
                    <div className="text-sm text-gray-700">
                      <p className="mb-1">
                        <span className="font-medium text-gray-900">Email:</span>{" "}
                        {user.email}
                      </p>
                      <p>
                        <span className="font-medium text-gray-900">Affiliation:</span>{" "}
                        {user.affiliation}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
