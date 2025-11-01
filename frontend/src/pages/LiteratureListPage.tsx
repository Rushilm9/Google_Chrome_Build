import React, { useEffect, useMemo, useState } from "react";
import { Loader2, Download, Eye, Plus } from "lucide-react";
import { Link } from "react-router-dom";
import { BASE_URL } from "../utils/constant";

type Analysis = {
  analysis_id: number;
  created_at?: string;
};

type LitPaperReviewed = {
  paper_id: number;
  project_id: number;
  title: string;
  publication_year?: number;
  file_type?: string;
  file_path?: string;
  analysis?: Analysis;
};

const LiteratureListPage: React.FC = () => {
  const [projectId, setProjectId] = useState<number | null>(null);
  const [papers, setPapers] = useState<LitPaperReviewed[]>([]);
  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string>("Fetching literature papers...");

  useEffect(() => {
    const storedId = localStorage.getItem("selectedProjectId");
    if (storedId) setProjectId(Number(storedId));
    else setStatusMsg("⚠️ No project selected.");
  }, []);

  // Prefer the new endpoint that returns only papers WITH reviews.
  // If a backend ships the typo-alias, we fall back to it automatically.
  const fetchReviewedPapers = async (id: number) => {
    setLoading(true);
    setStatusMsg("⚙️ Fetching reviewed papers...");
    try {
      let res = await fetch(`${BASE_URL}/literature/literature-review-fetch?project_id=${id}`, {
        headers: { accept: "application/json" },
      });

      // Fallback to alias if 404/405
      if (!res.ok && (res.status === 404 || res.status === 405)) {
        res = await fetch(`${BASE_URL}/literature/litertaure-reiew-rftech?project_id=${id}`, {
          headers: { accept: "application/json" },
        });
      }

      const data = await res.json().catch(() => ({}));
      if (res.ok && data?.papers_with_reviews) {
        setPapers(data.papers_with_reviews);
        setStatusMsg(`✅ Loaded ${data.papers_with_reviews.length} reviewed item(s).`);
      } else {
        // If this endpoint isn't available, optionally fall back to listing all papers:
        setPapers([]);
        setStatusMsg("⚠️ No reviewed papers found for this project.");
      }
    } catch (err) {
      console.error(err);
      setStatusMsg("❌ Failed to load reviewed papers.");
      setPapers([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!projectId) return;
    fetchReviewedPapers(projectId);

    // refresh when other components emit an update
    const onChanged = (e: Event) => {
      const detail: any = (e as CustomEvent).detail;
      if (!detail || detail.projectId === projectId) fetchReviewedPapers(projectId);
    };
    window.addEventListener("projectLiteratureChanged", onChanged);
    return () => window.removeEventListener("projectLiteratureChanged", onChanged);
  }, [projectId]);

  const sorted = useMemo(() => {
    return [...papers].sort((a, b) => {
      const da = a.analysis?.created_at ? new Date(a.analysis.created_at).getTime() : 0;
      const db = b.analysis?.created_at ? new Date(b.analysis.created_at).getTime() : 0;
      if (db !== da) return db - da;
      return (b.paper_id || 0) - (a.paper_id || 0);
    });
  }, [papers]);

  return (
    <div className="pt-20 p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">📚 Literature for Project</h1>
          <p className="text-sm text-gray-500">{statusMsg}</p>
        </div>

        <div>
          <Link
            to="/app/literature/upload"
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white rounded-lg text-sm font-medium shadow"
          >
            <Plus className="h-4 w-4" /> Upload Literature
          </Link>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-gray-500">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading...
        </div>
      ) : sorted.length === 0 ? (
        <div className="p-6 bg-white border rounded text-sm text-gray-600">
          No literature reviews found. Use the button above to upload documents and generate reviews.
        </div>
      ) : (
        <div className="grid gap-4">
          {sorted.map((p) => (
            <div key={p.paper_id} className="p-4 bg-white border rounded-lg flex justify-between items-start">
              <div>
                <h3 className="text-lg font-semibold">{p.title}</h3>
                <div className="text-xs text-gray-500 mt-1">
                  ID: {p.paper_id} • {p.file_type || "PDF"} {p.publication_year ? `• ${p.publication_year}` : ""}
                </div>
              </div>

              <div className="flex flex-col items-end gap-2">
                {/* New: direct raw download API */}
                <a
                  href={`${BASE_URL}/literature/paper/${p.paper_id}/download`}
                  className="text-sm text-blue-700 flex items-center gap-1"
                >
                  <Download className="h-4 w-4" /> Download
                </a>

                <Link to={`/app/literature/${p.paper_id}`} className="text-sm text-blue-700 flex items-center gap-1">
                  <Eye className="h-4 w-4" /> View more
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default LiteratureListPage;
