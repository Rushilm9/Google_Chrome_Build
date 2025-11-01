import React from "react";
import { NavLink } from "react-router-dom";
import {
  Upload,
  Folder,
  LogOut,
  FileText,
  BookOpen,
  Languages,
} from "lucide-react";

const Sidebar: React.FC = () => {
  const navItems = [
    { path: "/app/projects", icon: Folder, label: "My Projects" },
    { path: "/app/upload", icon: Upload, label: "Upload Documents" },
    { path: "/app/papers", icon: FileText, label: "Show Papers" },
    { path: "/app/literature", icon: BookOpen, label: "Literature" },
    { path: "/app/translator", icon: Languages, label: "AI Translator" }, // 🌍 New Page
  ];

  return (
    <aside className="bg-white w-64 h-[calc(100vh-4rem)] border-r border-gray-200 fixed left-0 top-16 z-20 flex flex-col justify-between">
      {/* 🧭 Navigation Section */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) =>
                  `flex items-center space-x-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-blue-50 text-blue-700 border border-blue-200"
                      : "text-gray-700 hover:bg-gray-100 hover:text-blue-600"
                  }`
                }
              >
                <Icon className="h-5 w-5" />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </div>
      </div>

      {/* 🚪 Logout Button */}
      <div className="p-4 border-t border-gray-200">
        <NavLink
          to="/app/logout"
          className="flex items-center space-x-3 text-red-600 hover:bg-red-50 px-3 py-2 rounded-lg transition-colors"
        >
          <LogOut className="h-5 w-5" />
          <span className="font-medium">Logout</span>
        </NavLink>
      </div>
    </aside>
  );
};

export default Sidebar;
