import React, { useEffect, useState, useRef } from "react";
import { Loader2, CheckCircle, Sparkles } from "lucide-react";
import { BASE_URL } from "../utils/constant";

type Project = {
  project_id: number;
  project_name?: string;
  raw_query?: string;
};

type ProjectStats = {
  project_id: number;
  project_name: string;
  total_papers: number;
  analyzed_papers: number;
  unanalyzed_papers: number;
};

const FetchPapersPage: React.FC = () => {
  const [project, setProject] = useState<Project | null>(null);
  const [keywords, setKeywords] = useState<string[]>([]);
  const [stats, setStats] = useState<ProjectStats | null>(null);
  const [alertMsg, setAlertMsg] = useState<string | null>(null);

  const [isFetching, setIsFetching] = useState(false);
  const [progress, setProgress] = useState(0);
  const [stageLabel, setStageLabel] = useState("Initializing…");
  const tickRef = useRef<number | null>(null);
  const startRef = useRef<number | null>(null);

  // Filter fields
  const [limit, setLimit] = useState<number | "">("");
  const [minCitations, setMinCitations] = useState<number | "">("");
  const [yearMin, setYearMin] = useState<number | "">("");
  const [yearMax, setYearMax] = useState<number | "">("");
  const [quartile, setQuartile] = useState<string>("");

  // -------------------------------
  // Helpers
  // -------------------------------
  const safeJson = async (res: Response): Promise<any> => {
    const t = await res.text();
    if (!t) return null;
    try {
      return JSON.parse(t);
    } catch {
      return t;
    }
  };

  const startProgress = () => {
    stopProgress();
    startRef.current = Date.now();
    tickRef.current = window.setInterval(() => {
      const elapsed = (Date.now() - (startRef.current || 0)) / 1000;
      const pct = Math.min(100, Math.round((elapsed / 45) * 100));
      setProgress(pct);
      if (elapsed < 20) setStageLabel("Fetching papers…");
      else if (elapsed < 35) setStageLabel("Analyzing abstracts…");
      else setStageLabel("Finalizing results…");
    }, 200);
  };

  const stopProgress = () => {
    if (tickRef.current) window.clearInterval(tickRef.current);
    tickRef.current = null;
  };

  // -------------------------------
  // Load project & keywords
  // -------------------------------
  useEffect(() => {
    const loadProject = () => {
      const projectId = localStorage.getItem("selectedProjectId");
      const projects = JSON.parse(localStorage.getItem("projects") || "[]");
      const selected = projects.find(
        (p: any) => p.project_id.toString() === projectId
      );
      if (selected) {
        setProject(selected);
        fetchKeywords(selected.project_id);
        fetchStats(selected.project_id);
      } else {
        setAlertMsg("⚠️ No project found.");
      }
    };
    loadProject();
    return () => stopProgress();
  }, []);

  const fetchKeywords = async (id: number) => {
    try {
      const res = await fetch(`${BASE_URL}/keyword/fetch/${id}`);
      const data = await safeJson(res);
      if (res.ok && data?.keywords?.length) setKeywords(data.keywords);
    } catch (e) {
      console.error(e);
      setAlertMsg("❌ Could not load keywords.");
    }
  };

  const fetchStats = async (id: number) => {
    try {
      const res = await fetch(`${BASE_URL}/papers/stats/project/${id}`);
      const data = await safeJson(res);
      if (res.ok) setStats(data);
    } catch (e) {
      console.error(e);
    }
  };

  // -------------------------------
  // Handle Ingest / Fetch
  // -------------------------------
  const handleFetchPapers = async () => {
    if (!project) return;
    setIsFetching(true);
    setAlertMsg("🔎 Starting paper ingestion…");
    startProgress();
    try {
      const params = new URLSearchParams();

      if (limit) params.set("limit", String(limit));
      if (minCitations) params.set("min_citations", String(minCitations));
      if (yearMin) params.set("year_min", String(yearMin));
      if (yearMax) params.set("year_max", String(yearMax));
      if (quartile.trim()) params.set("quartile_in", quartile.trim());

      params.set("require_abstract", "true");
      params.set("authors_in_background", "true");
      params.set("openalex_enabled", "true");
      params.set("crossref_enabled", "true");

      const res = await fetch(
        `${BASE_URL}/research/ingest/${project.project_id}?${params.toString()}`,
        { method: "POST", headers: { accept: "application/json" } }
      );

      const data = await safeJson(res);
      if (!res.ok) throw new Error(data?.detail || "Failed to fetch papers");

      setAlertMsg("✅ Papers fetched successfully!");
      stopProgress();
      setProgress(100);
      fetchStats(project.project_id);
      setTimeout(() => {
        window.location.href = "/app/papers";
      }, 1000);
    } catch (err: any) {
      console.error(err);
      stopProgress();
      setAlertMsg("❌ " + (err.message || "Failed to fetch papers."));
    } finally {
      setIsFetching(false);
    }
  };

  // -------------------------------
  // UI
  // -------------------------------
  const AlertBox = ({ msg }: { msg: string }) => (
    <div className="fixed bottom-6 right-6 bg-blue-700 text-white px-4 py-3 rounded-lg shadow-lg text-sm">
      {msg}
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center pt-20 pb-16 px-4 space-y-8">
      {alertMsg && <AlertBox msg={alertMsg} />}

      {project && (
        <div className="bg-gradient-to-r from-blue-600 to-teal-500 text-white rounded-xl shadow-md p-6 w-full max-w-4xl">
          <div className="flex justify-between">
            <div>
              <h1 className="text-3xl font-bold">{project.project_name}</h1>
              <p className="text-blue-100 text-sm mt-1">
                Project ID: {project.project_id}
              </p>
            </div>
            <div className="flex items-center bg-white/20 px-3 py-1.5 rounded-md">
              <CheckCircle className="h-4 w-4 mr-2 text-white" />
              <span className="text-sm font-medium">Active Analyzer</span>
            </div>
          </div>
        </div>
      )}

      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full max-w-4xl">
          <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
            <p className="text-xs text-gray-500">Total Papers</p>
            <p className="text-2xl font-semibold">{stats.total_papers}</p>
          </div>
          <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
            <p className="text-xs text-gray-500">Analyzed</p>
            <p className="text-2xl font-semibold text-green-700">
              {stats.analyzed_papers}
            </p>
          </div>
          <div className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
            <p className="text-xs text-gray-500">Remaining</p>
            <p className="text-2xl font-semibold text-amber-700">
              {stats.unanalyzed_papers}
            </p>
          </div>
        </div>
      )}

      {/* Keywords */}
      {keywords.length > 0 && (
        <div className="bg-white border border-blue-200 rounded-xl shadow-sm p-6 w-full max-w-4xl">
          <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-blue-600" />
            Keywords
          </h3>
          <div className="flex flex-wrap gap-2">
            {keywords.map((k, i) => (
              <span
                key={i}
                className="bg-blue-50 border border-blue-200 text-blue-800 px-3 py-1 rounded-full text-sm"
              >
                {k}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Fetch Options */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-6 w-full max-w-4xl">
        <h3 className="text-lg font-semibold mb-4">Fetch Papers</h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="text-xs text-gray-600">
            Limit
            <input
              type="number"
              min={1}
              value={limit}
              onChange={(e) =>
                setLimit(e.target.value === "" ? "" : Number(e.target.value))
              }
              className="mt-1 w-full border rounded px-3 py-2 text-sm"
              placeholder="Max number of papers"
              disabled={isFetching}
            />
          </label>

          <label className="text-xs text-gray-600">
            Min Citations
            <input
              type="number"
              min={0}
              value={minCitations}
              onChange={(e) =>
                setMinCitations(
                  e.target.value === "" ? "" : Number(e.target.value)
                )
              }
              className="mt-1 w-full border rounded px-3 py-2 text-sm"
              placeholder="optional"
              disabled={isFetching}
            />
          </label>

          <label className="text-xs text-gray-600">
            Year Min
            <input
              type="number"
              min={1900}
              max={new Date().getFullYear()}
              value={yearMin}
              onChange={(e) =>
                setYearMin(e.target.value === "" ? "" : Number(e.target.value))
              }
              className="mt-1 w-full border rounded px-3 py-2 text-sm"
              placeholder="optional"
              disabled={isFetching}
            />
          </label>

          <label className="text-xs text-gray-600">
            Year Max
            <input
              type="number"
              min={1900}
              max={new Date().getFullYear()}
              value={yearMax}
              onChange={(e) =>
                setYearMax(e.target.value === "" ? "" : Number(e.target.value))
              }
              className="mt-1 w-full border rounded px-3 py-2 text-sm"
              placeholder="optional"
              disabled={isFetching}
            />
          </label>

          <label className="text-xs text-gray-600 md:col-span-2">
            Quartile (comma-separated)
            <input
              type="text"
              value={quartile}
              onChange={(e) => setQuartile(e.target.value)}
              className="mt-1 w-full border rounded px-3 py-2 text-sm"
              placeholder="e.g. Q1,Q2"
              disabled={isFetching}
            />
          </label>
        </div>

        {/* Progress */}
        {isFetching && (
          <div className="mt-6">
            <div className="flex items-center gap-3 text-blue-700 text-sm mb-2">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span>{stageLabel}</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all duration-200"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        {/* Buttons */}
        <div className="flex justify-end mt-6 gap-3">
          <button
            onClick={() => window.history.back()}
            className="px-4 py-2 text-sm rounded bg-gray-100"
            disabled={isFetching}
          >
            Cancel
          </button>
          <button
            onClick={handleFetchPapers}
            disabled={isFetching}
            className="px-4 py-2 text-sm rounded bg-blue-700 text-white flex items-center gap-2"
          >
            {isFetching ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Fetching…
              </>
            ) : (
              "Start Fetch"
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default FetchPapersPage;
