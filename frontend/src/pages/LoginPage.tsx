import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { BASE_URL } from "../utils/constant";

interface LoginForm {
  email: string;
  password: string;
}

const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const [form, setForm] = useState<LoginForm>({ email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // ✅ Hit BASE_URL as soon as page loads to wake up server
  useEffect(() => {
    const wakeServer = async () => {
      try {
        await fetch(BASE_URL);
        // no UI updates, silent call
      } catch (err) {
        console.warn("Server wake-up failed:", err);
      }
    };
    wakeServer();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch(`${BASE_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();

      if (res.ok) {
        localStorage.setItem("user", JSON.stringify(data.user));
        localStorage.setItem("loginSuccess", "true");
        navigate("/app/projects");
      } else {
        setError(data.message || "Login failed");
      }
    } catch {
      setError("Something went wrong!!. Try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleTestCredentials = () => {
    setForm({ email: "chromebuild@gmail.com", password: "chrome333" });
  };

  return (
    <div className="flex items-center justify-center h-screen bg-gray-50">
      <div className="bg-white p-8 rounded-xl shadow-md w-full max-w-md">
        {/* Logo */}
        <div className="flex flex-col items-center mb-6">
          <div className="w-14 h-14 bg-gradient-to-r from-blue-700 to-teal-600 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-lg">iS</span>
          </div>
          <h1 className="mt-2 text-xl font-bold text-gray-900">
            i-SMART Research Scholar
          </h1>
        </div>

        <h2 className="text-2xl font-bold text-center text-blue-700 mb-6">
          Login
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            name="email"
            type="email"
            placeholder="Email"
            value={form.email}
            onChange={handleChange}
            required
            className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-blue-600"
          />
          <input
            name="password"
            type="password"
            placeholder="Password"
            value={form.password}
            onChange={handleChange}
            required
            className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-blue-600"
          />

          {error && <p className="text-red-600 text-sm">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-700 text-white py-3 rounded-lg hover:bg-blue-800 transition-colors"
          >
            {loading ? "Logging in..." : "Login"}
          </button>

          <button
            type="button"
            onClick={handleTestCredentials}
            className="w-full mt-2 bg-gray-100 text-blue-700 py-2 rounded-lg border border-gray-300 hover:bg-gray-200 transition-colors"
          >
            Use Test Credentials
          </button>
        </form>
      </div>
    </div>
  );
};

export default LoginPage;
