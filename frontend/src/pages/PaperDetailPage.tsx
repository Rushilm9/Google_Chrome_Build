import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import {
  Loader2,
  ArrowLeft,
  BookOpen,
  Calendar,
  Star,
  TrendingUp,
  FileText,
  Globe,
  Link2,
  Sparkles,
  ExternalLink,
} from "lucide-react";
import { BASE_URL } from "../utils/constant";
import Translator from "./Translator";

const PaperDetailPage: React.FC = () => {
  const { paperId } = useParams<{ paperId: string }>();
  const [paper, setPaper] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchPaperDetail = async () => {
      try {
        setLoading(true);
        const res = await fetch(`${BASE_URL}/papers/detail/${paperId}`, {
          headers: { accept: "application/json" },
        });
        const data = await res.json();
        if (res.ok && data) {
          setPaper(data);
        } else {
          setError("Paper not found.");
        }
      } catch (err) {
        console.error(err);
        setError("Failed to load paper details.");
      } finally {
        setLoading(false);
      }
    };
    fetchPaperDetail();
  }, [paperId]);

  if (loading)
    return (
      <div className="flex justify-center items-center py-20 text-gray-500">
        <Loader2 className="h-5 w-5 animate-spin mr-2" />
        Loading details...
      </div>
    );

  if (error)
    return (
      <div className="p-8 text-center text-red-600 font-medium">{error}</div>
    );

  if (!paper) return null;

  const {
    title,
    abstract,
    journal,
    publication_year,
    citation_count,
    impact_factor,
    doi,
    authors = [],
    oa_url,
    url,
    fetched_from,
    ingestion_date,
    recommendation,
  } = paper;

  return (
    <div className="max-w-5xl mx-auto p-8 space-y-8">
      {/* Back Button */}
      <div className="mt-6">
        <Link
          to="/app/papers"
          className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-800 transition"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Papers
        </Link>
      </div>

      {/* Header Card */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 relative">
        <h1 className="text-2xl font-bold text-gray-900 leading-snug">
          {title}
        </h1>
        <div className="mt-3 flex flex-wrap gap-4 text-sm text-gray-600">
          <div className="flex items-center gap-1">
            <Calendar className="h-4 w-4 text-gray-400" />
            {publication_year || "—"}
          </div>
          <div className="flex items-center gap-1">
            <BookOpen className="h-4 w-4 text-gray-400" />
            {journal || "—"}
          </div>
          <div className="flex items-center gap-1">
            <TrendingUp className="h-4 w-4 text-gray-400" />
            {citation_count || 0} Citations
          </div>
          <div className="flex items-center gap-1">
            <Star className="h-4 w-4 text-gray-400" />
            Impact: {impact_factor ?? "—"}
          </div>
        </div>

        {/* DOI + Links */}
        <div className="mt-4 flex flex-wrap gap-4 text-sm">
          {doi && (
            <a
              href={`https://doi.org/${doi}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-blue-600 hover:text-blue-800"
            >
              <Link2 className="h-4 w-4" /> DOI: {doi}
            </a>
          )}
          {url && (
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-blue-600 hover:text-blue-800"
            >
              <ExternalLink className="h-4 w-4" /> Full Text
            </a>
          )}
        </div>

        {/* Download Button */}
        {(oa_url || url) && (
          <div className="absolute bottom-6 right-6">
            <a
              href={oa_url || url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 bg-blue-700 hover:bg-blue-800 text-white px-5 py-2.5 rounded-lg text-sm font-medium shadow-sm transition"
            >
              <Globe className="h-4 w-4" /> View / Download Full Paper
            </a>
          </div>
        )}
      </div>

      {/* Abstract + Translator */}
      {abstract && (
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-2 flex items-center gap-2">
            <FileText className="h-5 w-5 text-gray-500" /> Abstract
          </h2>
          <p className="text-gray-700 leading-relaxed text-sm">{abstract}</p>

          {/* Translation Component */}
          <Translator text={abstract} />
        </div>
      )}

      {/* Authors */}
      {authors?.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-800 mb-3">Authors</h2>
          <ul className="divide-y divide-gray-100">
            {authors.map((a: any, idx: number) => (
              <li
                key={idx}
                className="py-2 flex flex-col sm:flex-row sm:justify-between"
              >
                <span className="font-medium text-gray-900">{a.name}</span>
                {a.affiliation && (
                  <span className="text-sm text-gray-600">{a.affiliation}</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Recommendation */}
      {recommendation && (
        <div className="bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-200 rounded-xl p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-purple-800 mb-3 flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-purple-600" />
            AI Recommendation
          </h2>

          <div className="grid sm:grid-cols-2 gap-4 text-sm text-gray-700">
            <p>
              <strong>Project ID:</strong> {recommendation.project_id}
            </p>
            <p>
              <strong>Relevance Score:</strong>{" "}
              {recommendation.relevance_score ?? "—"}
            </p>
            <p>
              <strong>Rank:</strong> {recommendation.overall_rank ?? "—"}
            </p>
            <p>
              <strong>Reason:</strong>{" "}
              {recommendation.recommended_reason ?? "—"}
            </p>
          </div>
          <p className="mt-3 text-xs text-gray-500">
            Added on:{" "}
            {new Date(recommendation.created_at).toLocaleString("en-US", {
              dateStyle: "medium",
              timeStyle: "short",
            })}
          </p>
        </div>
      )}

      {/* Metadata */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-800 mb-3">Metadata</h2>
        <div className="grid sm:grid-cols-2 gap-4 text-sm text-gray-700">
          <p>
            <strong>Fetched From:</strong> {fetched_from || "—"}
          </p>
          <p>
            <strong>Ingestion Date:</strong>{" "}
            {ingestion_date
              ? new Date(ingestion_date).toLocaleString()
              : "—"}
          </p>
          <p>
            <strong>Open Access:</strong>{" "}
            {paper.is_open_access ? "Yes" : "No"}
          </p>
          <p>
            <strong>SJR Quartile:</strong> {paper.sjr_quartile ?? "—"}
          </p>
          <p>
            <strong>H-Index:</strong> {paper.h_index ?? "—"}
          </p>
        </div>
      </div>
    </div>
  );
};

export default PaperDetailPage;
