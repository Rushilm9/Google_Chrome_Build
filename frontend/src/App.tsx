import React from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";

// 🌟 Layout & Shared
import Layout from "./components/Layout";

// 🔍 Core Research Pages
import UploadDocumentsPage from "./pages/KeywordGenerator";
import FetchPapersPage from "./pages/FetchPapersPage";
import ProjectsPage from "./pages/ProjectPage";
import ShowPapersPage from "./pages/ShowPapersPage";
import PaperDetailPage from "./pages/PaperDetailPage";

// 👤 Auth Pages
import LoginPage from "./pages/LoginPage";
import SignupPage from "./pages/SignupPage";
import Logout from "./pages/Logout";

// 📚 Literature Pages (Backend – Gemini/Server)
import LiteratureListPage from "./pages/LiteratureListPage";
import LiteratureUploadPage from "./pages/LiteratureUploadPage";
import LiteratureDetailPage from "./pages/LiteratureDetailPage";

// 🧠 Local Chrome Build AI Literature Management (Frontend-Only)
import LiteratureListLocalPage from "./pages/LiteratureListLocalPage";

// 🌍 Chrome AI Translator
import ChromeTranslatorPage from "./pages/ChromeTranslatorPage";

// 🔒 Protected Route Wrapper
const ProtectedRoute: React.FC<{ element: JSX.Element }> = ({ element }) => {
  const isAuthenticated = localStorage.getItem("loginSuccess") === "true";
  return isAuthenticated ? element : <Navigate to="/login" replace />;
};

// 🧠 Root Route Logic — checks login and redirects accordingly
const RootRedirect: React.FC = () => {
  const isAuthenticated = localStorage.getItem("loginSuccess") === "true";
  return isAuthenticated ? (
    <Navigate to="/app/projects" replace />
  ) : (
    <Navigate to="/login" replace />
  );
};

const App: React.FC = () => {
  return (
    <Router>
      <Routes>
        {/* 🏠 Root — check login and redirect */}
        <Route path="/" element={<RootRedirect />} />

        {/* 👤 Public Auth Routes */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />

        {/* 🔐 Protected App Layout */}
        <Route
          path="/app"
          element={<ProtectedRoute element={<Layout />} />}
        >
          {/* 🚀 Core Research Features */}
          <Route path="projects" element={<ProjectsPage />} />
          <Route path="upload" element={<UploadDocumentsPage />} />
          <Route path="fetch" element={<FetchPapersPage />} />
          <Route path="papers" element={<ShowPapersPage />} />
          <Route path="papers/:paperId" element={<PaperDetailPage />} />

          {/* 📘 Literature Review (Backend – Gemini/Server) */}
          <Route path="literature" element={<LiteratureListPage />} />
          <Route path="literature/upload" element={<LiteratureUploadPage />} />
          <Route path="literature/:paperId" element={<LiteratureDetailPage />} />

          {/* 🧠 Local Literature Review (Frontend – Chrome Build) */}
          <Route path="literature/local" element={<LiteratureListLocalPage />} />

          {/* 🌍 Chrome AI Translator */}
          <Route path="translator" element={<ChromeTranslatorPage />} />

          {/* 🔑 Logout */}
          <Route path="logout" element={<Logout />} />
        </Route>

        {/* ⚠️ Catch-all fallback */}
        <Route path="*" element={<RootRedirect />} />
      </Routes>
    </Router>
  );
};

export default App;
