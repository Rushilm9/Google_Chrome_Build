import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";

const Logout: React.FC = () => {
  const navigate = useNavigate();

  useEffect(() => {
    // 🧹 Clear all stored session data
    localStorage.removeItem("user");
    localStorage.removeItem("projects");
    localStorage.removeItem("selectedProjectId");
    localStorage.removeItem("loginSuccess"); // ✅ Must clear this flag

    // 🔁 Redirect to login
    const timer = setTimeout(() => {
      navigate("/login");
    }, 1000);

    return () => clearTimeout(timer);
  }, [navigate]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] text-center">
      <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center mb-4">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-8 w-8 text-blue-600"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1m0-10V5m0 0h-2a2 2 0 00-2 2v2"
          />
        </svg>
      </div>
      <h2 className="text-xl font-semibold text-gray-800 mb-1">
        Logging you out...
      </h2>
      <p className="text-gray-500 text-sm">Redirecting to login page</p>
    </div>
  );
};

export default Logout;
