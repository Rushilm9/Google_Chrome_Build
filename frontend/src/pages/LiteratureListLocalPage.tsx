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
  Eye,
  Trash2,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { jsPDF } from "jspdf";
import html2canvas from "html2canvas";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

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

type LocalAnalysis = {
  id: number;
  name: string;
  status: string;
  analysis?: string;
  text?: string;
};

const LiteratureListLocalPage: React.FC = () => {
  const navigate = useNavigate();
  const [papers, setPapers] = useState<LocalAnalysis[]>([]);
  const [loading, setLoading] = useState(true);

  // 🧩 Load local papers
  useEffect(() => {
    const stored = localStorage.getItem("localAnalyzedPapers");
    if (stored) {
      try {
        setPapers(JSON.parse(stored));
      } catch {
        setPapers([]);
      }
    }
    setLoading(false);
  }, []);

  // ✅ Parse Chrome JSON or detect markdown
  const parseLocalAnalysis = (data: any): LocalAnalysisData | null => {
    if (!data) return null;
    try {
      if (typeof data === "object") return data;
      const jsonMatch = data.match(/\{[\s\S]*\}/);
      if (!jsonMatch) return null;
      let parsed = JSON.parse(jsonMatch[0]);
      if (typeof parsed === "string") parsed = JSON.parse(parsed);
      return parsed;
    } catch {
      return null;
    }
  };

  // 📄 Download review as PDF
  const downloadReviewPDF = async (paper: LocalAnalysis) => {
    const element = document.getElementById(`review-${paper.id}`);
    if (!element) return;
    const canvas = await html2canvas(element);
    const imgData = canvas.toDataURL("image/png");
    const pdf = new jsPDF("p", "mm", "a4");
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
    pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight);
    pdf.save(`${paper.name}_Review.pdf`);
  };

  // 📘 Download original text
  const downloadOriginal = (paper: LocalAnalysis) => {
    if (!paper.text) return alert("Original text not available.");
    const blob = new Blob([paper.text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = paper.name || "Original_Paper.txt";
    a.click();
    URL.revokeObjectURL(url);
  };

  // 🗑️ Delete paper
  const handleDelete = (id: number) => {
    const updated = papers.filter((p) => p.id !== id);
    setPapers(updated);
    localStorage.setItem("localAnalyzedPapers", JSON.stringify(updated));
  };

  const goBack = () => navigate(-1);
  const handleViewReview = (paper: LocalAnalysis) => {
    navigate(`/literature/local/${paper.id}`, { state: paper });
  };

  if (loading) {
    return (
      <div className="pt-20 p-6 text-gray-500 flex items-center gap-2">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading local reviews...
      </div>
    );
  }

  if (papers.length === 0) {
    return (
      <div className="pt-20 p-6 text-gray-500 text-center">
        No local analyses found. Upload and analyze papers first.
      </div>
    );
  }

  return (
    <div className="pt-20 p-6 space-y-6 max-w-5xl mx-auto">
      <button
        onClick={goBack}
        className="inline-flex items-center gap-2 px-3 py-2 border rounded text-sm hover:bg-gray-50"
      >
        <ArrowLeft className="h-4 w-4" /> Back
      </button>

      <h2 className="text-2xl font-bold flex items-center gap-2">
        <FileText className="h-5 w-5 text-blue-600" /> Local Literature Reviews
      </h2>

      {papers.map((p) => {
        const parsed = parseLocalAnalysis(p.analysis);
        const isMarkdown = !parsed && p.analysis;

        return (
          <div
            key={p.id}
            id={`review-${p.id}`}
            className="bg-white rounded-lg shadow border p-6 space-y-6 transition hover:shadow-md"
          >
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center border-b pb-3 gap-4">
              <div className="flex items-center gap-2">
                <h3 className="text-xl font-semibold flex items-center gap-2 text-gray-800">
                  <FileText className="h-5 w-5 text-blue-600" /> {p.name}
                </h3>
                <span
                  className={`text-sm font-medium ${
                    p.status.includes("✅") || p.status === "completed"
                      ? "text-green-600"
                      : "text-yellow-600"
                  }`}
                >
                  {p.status}
                </span>
              </div>

              <div className="flex flex-wrap gap-2">
                {/* <button
                  onClick={() => handleViewReview(p)}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded text-sm bg-blue-600 hover:bg-blue-700 text-white"
                >
                  <Eye className="h-4 w-4" /> View Review
                </button> */}
                <button
                  onClick={() => downloadReviewPDF(p)}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded text-sm bg-green-600 hover:bg-green-700 text-white"
                >
                  <Download className="h-4 w-4" /> Review PDF
                </button>
                {/* <button
                  onClick={() => downloadOriginal(p)}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded text-sm bg-gray-800 hover:bg-gray-900 text-white"
                >
                  <Download className="h-4 w-4" /> Original
                </button> */}
                <button
                  onClick={() => handleDelete(p.id)}
                  className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 hover:bg-gray-100 text-sm text-red-600"
                >
                  <Trash2 className="h-4 w-4" /> Delete
                </button>
              </div>
            </div>

            {/* Content */}
            {parsed ? (
              <>
                {parsed.Summary && (
                  <div className="p-4 rounded border bg-gray-50">
                    <h4 className="font-semibold text-gray-800 mb-2 flex items-center gap-2">
                      <BookOpen className="h-4 w-4 text-blue-700" /> SUMMARY
                    </h4>
                    <p className="text-sm text-gray-700 whitespace-pre-wrap">
                      {parsed.Summary}
                    </p>
                  </div>
                )}

                {parsed.Strengths && (
                  <div className="p-4 rounded border bg-green-50">
                    <h4 className="font-semibold text-green-700 mb-2">STRENGTHS</h4>
                    <ul className="list-disc ml-5 text-sm text-gray-700">
                      {parsed.Strengths.map((s, i) => (
                        <li key={i}>{s}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {parsed.Weaknesses && (
                  <div className="p-4 rounded border bg-red-50">
                    <h4 className="font-semibold text-red-700 mb-2">WEAKNESSES</h4>
                    <ul className="list-disc ml-5 text-sm text-gray-700">
                      {parsed.Weaknesses.map((w, i) => (
                        <li key={i}>{w}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {parsed["Research Gaps"] && (
                  <div className="p-4 rounded border bg-yellow-50">
                    <h4 className="font-semibold text-yellow-700 mb-2">
                      RESEARCH GAPS
                    </h4>
                    <ul className="list-disc ml-5 text-sm text-gray-700">
                      {parsed["Research Gaps"].map((g, i) => (
                        <li key={i}>{g}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {parsed.Keywords && (
                  <div className="p-4 rounded border bg-blue-50">
                    <h4 className="font-semibold text-blue-700 mb-2 flex items-center gap-2">
                      <Key className="h-4 w-4 text-blue-600" /> SEMANTIC PATTERNS
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {parsed.Keywords.map((k, i) => (
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
            ) : isMarkdown ? (
              <div className="prose max-w-none">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {p.analysis || ""}
                </ReactMarkdown>
              </div>
            ) : (
              <pre className="bg-gray-100 text-xs rounded p-3 overflow-auto text-gray-700">
                {p.analysis}
              </pre>
            )}

            {/* Footer */}
            <div className="p-4 rounded border bg-gray-50">
              <h4 className="font-semibold text-gray-700 mb-2 flex items-center gap-2">
                <Brain className="h-4 w-4 text-purple-600" /> REVIEW METRICS
              </h4>
              <div className="grid sm:grid-cols-2 gap-2 text-sm text-gray-700">
                <p>
                  <strong>Critique Score:</strong> N/A
                </p>
                <p>
                  <strong>Sentiment Score:</strong> N/A
                </p>
                <p>
                  <strong>Tone:</strong> Neutral
                </p>
                <p>
                  <strong>Peer Reviewed:</strong> Local AI
                </p>
                <p className="flex items-center gap-1 text-gray-600">
                  <Calendar className="h-4 w-4" /> {new Date().toLocaleString()}
                </p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default LiteratureListLocalPage;
