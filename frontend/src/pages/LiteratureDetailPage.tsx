import React, { useEffect, useState, useRef } from "react";
import {
  FileText,
  BookOpen,
  Key,
  ArrowLeft,
  Loader2,
  Brain,
  Calendar,
  Download,
} from "lucide-react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { BASE_URL } from "../utils/constant";
import { jsPDF } from "jspdf";
import html2canvas from "html2canvas";

type LocalAnalysisData = {
  Summary?: string;
  Strengths?: string[];
  Weaknesses?: string[];
  "Research Gaps"?: string[];
  Keywords?: string[];
  Metadata?: {
    "Possible Title"?: string;
    "Authors (if mentioned)"?: string;
    "Field / Domain"?: string;
    "Publication Context (if inferable)"?: string;
  };
};

type ServerPaper = {
  paper_id: number;
  summary_text: string;
  strengths: string[];
  weaknesses: string[];
  gaps: string[];
  semantic_patterns: string[];
  tone?: string;
  critique_score?: number;
  sentiment_score?: number;
  peer_reviewed?: boolean | null;
  created_at?: string;
  message?: string;
  title?: string;
};

const LiteratureDetailPage: React.FC = () => {
  const navigate = useNavigate();
  const { state } = useLocation() as any;
  const { paperId } = useParams();

  const [source, setSource] = useState<"local" | "db">("local");
  const [fileName, setFileName] = useState<string>("Untitled Paper");
  const [loading, setLoading] = useState(true);
  const [localAnalysis, setLocalAnalysis] = useState<LocalAnalysisData | null>(
    null
  );
  const [serverData, setServerData] = useState<ServerPaper | null>(null);

  const reviewRef = useRef<HTMLDivElement>(null);

  // ✅ Parse local AI JSON safely
  const parseLocalAnalysis = (data: any): LocalAnalysisData | null => {
    if (!data) return null;
    try {
      if (typeof data === "object") return data;
      const jsonMatch = data.match(/\{[\s\S]*\}/);
      if (!jsonMatch) return null;
      let parsed = JSON.parse(jsonMatch[0]);
      if (typeof parsed === "string") parsed = JSON.parse(parsed);
      return parsed;
    } catch (err) {
      console.warn("JSON parse error:", err);
      return null;
    }
  };

  // 🧩 Detect data source
  useEffect(() => {
    const fetchData = async () => {
      if (state?.analysis) {
        // Case 1: Local (Chrome AI)
        setSource("local");
        setFileName(state.name || state.fileName || "Untitled Paper");
        const parsed = parseLocalAnalysis(state.analysis);
        setLocalAnalysis(parsed);
        setLoading(false);
        return;
      }

      if (paperId) {
        // Case 2: From DB
        setSource("db");
        try {
          setLoading(true);
          const res = await fetch(`${BASE_URL}/literature/review/${paperId}`, {
            headers: { accept: "application/json" },
          });
          if (!res.ok) throw new Error(`Server returned ${res.status}`);
          const data = await res.json();
          setServerData(data);
          setFileName(data.title || `Paper ${data.paper_id}`);
        } catch (err) {
          console.error("❌ Error fetching paper:", err);
          setServerData(null);
        } finally {
          setLoading(false);
        }
      }
    };
    fetchData();
  }, [state, paperId]);

  // 🧾 Download Review as PDF
  const handleDownloadReviewPDF = async () => {
    if (!reviewRef.current) return;
    const canvas = await html2canvas(reviewRef.current);
    const imgData = canvas.toDataURL("image/png");
    const pdf = new jsPDF("p", "mm", "a4");

    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

    pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight);
    pdf.save(`${fileName}_Review.pdf`);
  };

  // 📄 Download Original Paper (from API)
  const handleDownloadOriginalPaper = async () => {
    if (!paperId) return alert("Paper ID not found.");
    try {
      const res = await fetch(`${BASE_URL}/literature/paper/${paperId}/download`, {
        method: "GET",
        headers: { accept: "application/json" },
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        alert(data?.detail || `Error: Paper ${paperId} not found.`);
        return;
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${fileName}.pdf`;
      link.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error("❌ Error downloading paper:", err);
      alert("Error downloading original paper.");
    }
  };

  // 🕓 Loading state
  if (loading) {
    return (
      <div className="pt-20 p-6 text-gray-500 flex items-center gap-2">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading review...
      </div>
    );
  }

  // ⚠️ No data
  if (!localAnalysis && !serverData) {
    return (
      <div className="pt-20 p-6 text-gray-500">
        No review data found. Please go back.
      </div>
    );
  }

  // ✅ UI (shared)
  return (
    <div className="pt-20 p-6 space-y-6">
      <button
        onClick={() => navigate(-1)}
        className="inline-flex items-center gap-2 px-3 py-2 border rounded text-sm hover:bg-gray-50"
      >
        <ArrowLeft className="h-4 w-4" /> Back
      </button>

      <div
        ref={reviewRef}
        className="bg-white rounded-lg shadow border p-6 space-y-6 max-w-5xl mx-auto"
      >
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center border-b pb-3 gap-4">
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-bold flex items-center gap-2">
              <FileText className="h-5 w-5 text-blue-600" /> {fileName}
            </h2>
            <span
              className={`text-sm font-medium ${
                source === "local" ? "text-green-600" : "text-blue-600"
              }`}
            >
              {source === "local" ? "Local Analysis" : "Gemini / DB Review"}
            </span>
          </div>

          {/* ✅ Buttons moved to header */}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={handleDownloadReviewPDF}
              className="inline-flex items-center gap-2 px-4 py-2 rounded text-sm bg-green-600 hover:bg-green-700 text-white"
            >
              <Download className="h-4 w-4" /> Download Review PDF
            </button>

            <button
              onClick={handleDownloadOriginalPaper}
              className="inline-flex items-center gap-2 px-4 py-2 rounded text-sm bg-blue-600 hover:bg-blue-700 text-white"
            >
              <Download className="h-4 w-4" /> Download Original Paper
            </button>
          </div>
        </div>

        {/* ===== LOCAL SOURCE ===== */}
        {source === "local" && localAnalysis && (
          <>
            {localAnalysis.Metadata && (
              <div className="p-4 rounded border bg-gray-50">
                <h4 className="font-semibold text-gray-800 mb-2">METADATA</h4>
                {Object.entries(localAnalysis.Metadata).map(([key, value]) => (
                  <p key={key} className="text-sm">
                    <strong>{key}:</strong> {value || "N/A"}
                  </p>
                ))}
              </div>
            )}

            {localAnalysis.Summary && (
              <div className="p-4 rounded border bg-gray-50">
                <h4 className="font-semibold text-gray-800 mb-2 flex items-center gap-2">
                  <BookOpen className="h-4 w-4 text-blue-700" /> SUMMARY
                </h4>
                <p className="text-sm text-gray-700 whitespace-pre-wrap">
                  {localAnalysis.Summary}
                </p>
              </div>
            )}

            {localAnalysis.Strengths && (
              <div className="p-4 rounded border bg-green-50">
                <h4 className="font-semibold text-green-700 mb-2">STRENGTHS</h4>
                <ul className="list-disc ml-5 text-sm text-gray-700">
                  {localAnalysis.Strengths.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ul>
              </div>
            )}

            {localAnalysis.Weaknesses && (
              <div className="p-4 rounded border bg-red-50">
                <h4 className="font-semibold text-red-700 mb-2">WEAKNESSES</h4>
                <ul className="list-disc ml-5 text-sm text-gray-700">
                  {localAnalysis.Weaknesses.map((w, i) => (
                    <li key={i}>{w}</li>
                  ))}
                </ul>
              </div>
            )}

            {localAnalysis["Research Gaps"] && (
              <div className="p-4 rounded border bg-yellow-50">
                <h4 className="font-semibold text-yellow-700 mb-2">
                  RESEARCH GAPS
                </h4>
                <ul className="list-disc ml-5 text-sm text-gray-700">
                  {localAnalysis["Research Gaps"].map((g, i) => (
                    <li key={i}>{g}</li>
                  ))}
                </ul>
              </div>
            )}

            {localAnalysis.Keywords && (
              <div className="p-4 rounded border bg-blue-50">
                <h4 className="font-semibold text-blue-700 mb-2 flex items-center gap-2">
                  <Key className="h-4 w-4 text-blue-600" /> KEYWORDS
                </h4>
                <div className="flex flex-wrap gap-2">
                  {localAnalysis.Keywords.map((k, i) => (
                    <span
                      key={i}
                      className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded-full"
                    >
                      {k}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* ===== SERVER SOURCE ===== */}
        {source === "db" && serverData && (
          <>
            {serverData.summary_text && (
              <div className="p-4 rounded border bg-gray-50">
                <h4 className="font-semibold text-gray-800 mb-2 flex items-center gap-2">
                  <BookOpen className="h-4 w-4 text-blue-700" /> SUMMARY
                </h4>
                <p className="text-sm text-gray-700 whitespace-pre-wrap">
                  {serverData.summary_text}
                </p>
              </div>
            )}

            <div className="p-4 rounded border bg-green-50">
              <h4 className="font-semibold text-green-700 mb-2">STRENGTHS</h4>
              <ul className="list-disc ml-5 text-sm text-gray-700">
                {serverData.strengths?.length ? (
                  serverData.strengths.map((s, i) => <li key={i}>{s}</li>)
                ) : (
                  <li>None specified.</li>
                )}
              </ul>
            </div>

            <div className="p-4 rounded border bg-red-50">
              <h4 className="font-semibold text-red-700 mb-2">WEAKNESSES</h4>
              <ul className="list-disc ml-5 text-sm text-gray-700">
                {serverData.weaknesses?.length ? (
                  serverData.weaknesses.map((w, i) => <li key={i}>{w}</li>)
                ) : (
                  <li>None specified.</li>
                )}
              </ul>
            </div>

            <div className="p-4 rounded border bg-yellow-50">
              <h4 className="font-semibold text-yellow-700 mb-2">
                RESEARCH GAPS
              </h4>
              <ul className="list-disc ml-5 text-sm text-gray-700">
                {serverData.gaps?.length ? (
                  serverData.gaps.map((g, i) => <li key={i}>{g}</li>)
                ) : (
                  <li>None specified.</li>
                )}
              </ul>
            </div>

            {serverData.semantic_patterns?.length > 0 && (
              <div className="p-4 rounded border bg-blue-50">
                <h4 className="font-semibold text-blue-700 mb-2 flex items-center gap-2">
                  <Key className="h-4 w-4 text-blue-600" /> SEMANTIC PATTERNS
                </h4>
                <div className="flex flex-wrap gap-2">
                  {serverData.semantic_patterns.map((p, i) => (
                    <span
                      key={i}
                      className="px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded-full"
                    >
                      {p}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="p-4 rounded border bg-gray-50">
              <h4 className="font-semibold text-gray-700 mb-2 flex items-center gap-2">
                <Brain className="h-4 w-4 text-purple-600" /> REVIEW METRICS
              </h4>
              <div className="grid sm:grid-cols-2 gap-2 text-sm text-gray-700">
                <p>
                  <strong>Critique Score:</strong>{" "}
                  {serverData.critique_score ?? "N/A"}
                </p>
                <p>
                  <strong>Sentiment Score:</strong>{" "}
                  {serverData.sentiment_score ?? "N/A"}
                </p>
                <p>
                  <strong>Tone:</strong> {serverData.tone || "N/A"}
                </p>
                <p>
                  <strong>Peer Reviewed:</strong>{" "}
                  {serverData.peer_reviewed === null
                    ? "Unknown"
                    : serverData.peer_reviewed
                    ? "Yes"
                    : "No"}
                </p>
                {serverData.created_at && (
                  <p className="flex items-center gap-1">
                    <Calendar className="h-4 w-4 text-gray-500" />{" "}
                    {new Date(serverData.created_at).toLocaleString()}
                  </p>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default LiteratureDetailPage;
