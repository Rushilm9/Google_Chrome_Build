import React, { useEffect, useMemo, useState } from "react";
import {
  Loader2,
  RefreshCw,
  Download,
  Search,
  PlusCircle,
  Eye,
  Sparkles,
  X,
} from "lucide-react";
import { Link } from "react-router-dom";
import { BASE_URL } from "../utils/constant";

type FilterState = {
  search: string;
  year?: number | "all";
  journal?: string | "all";
  citations?: number;
  impact?: number;
};

const ShowPapersPage: React.FC = () => {
  const [projectId, setProjectId] = useState<number | null>(null);
  const [projectName, setProjectName] = useState<string>("Selected Project");
  const [papers, setPapers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string>("Idle");
  const [ingesting, setIngesting] = useState(false);

  const [filterState, setFilterState] = useState<FilterState>({
    search: "",
  });
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const papersPerPage = 10;

  useEffect(() => {
    const storedId = localStorage.getItem("selectedProjectId");
    const storedName = localStorage.getItem("selectedProjectName");
    if (storedId) setProjectId(parseInt(storedId, 10));
    if (storedName) setProjectName(storedName);
    else setStatusMsg("⚠️ No project selected in navbar.");
  }, []);

  const fetchPapers = async (id: number) => {
    try {
      setLoading(true);
      const res = await fetch(
        `${BASE_URL}/papers/project/${id}?limit=100&include_authors=true`,
        { headers: { accept: "application/json" } }
      );
      const data = await res.json();
      if (res.ok && (data?.papers?.length ?? 0) > 0) {
        setPapers(data.papers);
        setStatusMsg(
          `✅ Loaded ${data.paper_count ?? data.papers.length} papers.`
        );
      } else {
        setPapers([]);
        setStatusMsg("⚠️ No papers found.");
      }
    } catch (err) {
      console.error(err);
      setStatusMsg("❌ Failed to load papers.");
    } finally {
      setLoading(false);
    }
  };

  const fetchRecommendedPapers = async (id: number) => {
    try {
      setLoading(true);
      setStatusMsg("✨ Loading AI-recommended papers...");
      const res = await fetch(`${BASE_URL}/papers/recommended/${id}?limit=200`, {
        headers: { accept: "application/json" },
      });
      const data = await res.json();
      if (res.ok && (data?.recommended_papers?.length ?? 0) > 0) {
        setPapers(data.recommended_papers);
        setStatusMsg(
          `🤖 Loaded ${data.recommendation_count ?? data.recommended_papers.length
          } AI-recommended papers.`
        );
      } else {
        setPapers([]);
        setStatusMsg("⚠️ No recommendations found.");
      }
    } catch (err) {
      console.error(err);
      setStatusMsg("❌ Failed to load recommendations.");
    } finally {
      setLoading(false);
    }
  };

  const handleFetch = async () => {
    if (!projectId) return setStatusMsg("⚠️ Select a project first.");
    setIngesting(true);
    setStatusMsg("⚙️ Fetching papers...");
    try {
      await fetchPapers(projectId);
      setStatusMsg("✅ Papers fetched successfully.");
    } catch {
      setStatusMsg("❌ Fetch failed.");
    } finally {
      setIngesting(false);
    }
  };

  useEffect(() => {
    if (projectId) fetchPapers(projectId);
  }, [projectId]);

  const { yearsList, journalList } = useMemo(() => {
    const years = new Set<number>();
    const journals = new Set<string>();
    papers.forEach((p) => {
      if (p.publication_year) years.add(Number(p.publication_year));
      if (p.journal) journals.add(String(p.journal));
    });
    const yearsList = Array.from(years).sort((a, b) => b - a);
    const journalList = Array.from(journals).sort((a, b) =>
      a.localeCompare(b)
    );
    return { yearsList, journalList };
  }, [papers]);

  const filteredPapers = useMemo(() => {
    const { search, year, journal, citations, impact } = filterState;
    let list = [...papers];

    if (search?.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (p) =>
          p.title?.toLowerCase().includes(q) ||
          p.abstract?.toLowerCase().includes(q)
      );
    }
    if (year && year !== "all") {
      list = list.filter((p) => Number(p.publication_year) === Number(year));
    }
    if (journal && journal !== "all") {
      list = list.filter(
        (p) =>
          String(p.journal || "").toLowerCase() ===
          String(journal).toLowerCase()
      );
    }
    if (typeof citations === "number") {
      list = list.filter((p) => Number(p.citation_count || 0) >= citations);
    }
    if (typeof impact === "number") {
      list = list.filter((p) => Number(p.impact_factor || 0) >= impact);
    }

    return list;
  }, [papers, filterState]);

  const totalPages = Math.ceil(filteredPapers.length / papersPerPage) || 1;
  const currentPapers = filteredPapers.slice(
    (currentPage - 1) * papersPerPage,
    currentPage * papersPerPage
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [filterState]);

  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const availableFilters = [
    { key: "year", label: "📅 Year" },
    { key: "journal", label: "🧾 Journal" },
    { key: "citations", label: "📈 Citations (min)" },
    { key: "impact", label: "⭐ Impact Factor (min)" },
  ] as const;

  const handleAddFilter = (key: typeof availableFilters[number]["key"]) => {
    setFilterState((prev) => {
      if (key in prev) return prev;
      if (key === "year") return { ...prev, year: "all" };
      if (key === "journal") return { ...prev, journal: "all" };
      if (key === "citations") return { ...prev, citations: 0 };
      if (key === "impact") return { ...prev, impact: 0 };
      return prev;
    });
    setShowAddMenu(false);
  };

  const handleRemoveFilter = (key: keyof FilterState) => {
    setFilterState((prev) => {
      const copy: any = { ...prev };
      delete copy[key];
      return copy;
    });
  };

  return (
    <div className="p-6 space-y-8">
      {/* Header */}
      <div className="flex flex-wrap justify-between items-center mt-16 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">📄 {projectName}</h1>
          <p className="text-sm text-gray-500">{statusMsg}</p>
        </div>

        <button
          onClick={handleFetch}
          disabled={ingesting}
          className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-medium shadow-sm transition ${ingesting
            ? "bg-gray-300 text-gray-500 cursor-not-allowed"
            : "bg-blue-700 hover:bg-blue-800 text-white"
            }`}
        >
          {ingesting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          {ingesting ? "Fetching..." : "Fetch Papers"}
        </button>
      </div>

      {/* Filter Panel */}
      <div className="bg-white border border-gray-200 shadow-sm rounded-xl p-5 space-y-4">
        {/* Search + AI + Add Filter Row */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Search */}
          <div className="flex items-center bg-gray-100 rounded-lg px-3 py-2 flex-1 min-w-[250px]">
            <Search className="text-gray-500 h-4 w-4 mr-2" />
            <input
              type="text"
              placeholder="Search papers..."
              className="bg-transparent outline-none w-full text-sm text-gray-700"
              value={filterState.search}
              onChange={(e) =>
                setFilterState((p) => ({ ...p, search: e.target.value }))
              }
            />
          </div>

          {/* AI Button */}
          <button
            onClick={() =>
              projectId
                ? fetchRecommendedPapers(projectId)
                : setStatusMsg("⚠️ Select a project first.")
            }
            disabled={loading}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition ${loading
              ? "bg-purple-300 text-gray-200 cursor-not-allowed"
              : "bg-purple-600 hover:bg-purple-700 text-white"
              }`}
          >
            <Sparkles className="h-4 w-4" /> AI Recommendations
          </button>

          {/* Add Filter */}
          <div className="relative">
            <button
              onClick={() => setShowAddMenu((s) => !s)}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition"
            >
              <PlusCircle className="h-4 w-4" />
              Add Filter
            </button>

            {showAddMenu && (
              <div
                className="absolute right-0 mt-2 bg-white border border-gray-200 rounded-lg shadow-lg p-2 z-20 w-56"
                onMouseLeave={() => setShowAddMenu(false)}
              >
                {availableFilters.map((f) => {
                  const isAdded = (filterState as any)[f.key] !== undefined;
                  return (
                    <button
                      key={f.key}
                      onClick={() => handleAddFilter(f.key)}
                      disabled={isAdded}
                      className={`block w-full text-left px-3 py-1.5 text-sm rounded-md hover:bg-gray-100 ${isAdded
                        ? "text-gray-400 cursor-not-allowed"
                        : "text-gray-700"
                        }`}
                    >
                      {f.label}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Active Filters */}
        {Object.keys(filterState).some((k) =>
          ["year", "journal", "citations", "impact"].includes(k)
        ) && (
            <div className="flex flex-wrap items-center gap-3 border-t border-gray-200 pt-3">
              {"year" in filterState && (
                <FilterChip
                  label="Year"
                  value={filterState.year}
                  options={["all", ...yearsList]}
                  onChange={(v) =>
                    setFilterState((p) => ({
                      ...p,
                      year: v === "all" ? "all" : Number(v),
                    }))
                  }
                  onRemove={() => handleRemoveFilter("year")}
                />
              )}
              {"journal" in filterState && (
                <FilterChip
                  label="Journal"
                  value={filterState.journal}
                  options={["all", ...journalList]}
                  onChange={(v) =>
                    setFilterState((p) => ({ ...p, journal: v as any }))
                  }
                  onRemove={() => handleRemoveFilter("journal")}
                />
              )}
              {"citations" in filterState && (
                <InputFilterChip
                  label="Min Citations"
                  value={filterState.citations ?? 0}
                  onChange={(v) =>
                    setFilterState((p) => ({ ...p, citations: Number(v) }))
                  }
                  onRemove={() => handleRemoveFilter("citations")}
                />
              )}
              {"impact" in filterState && (
                <InputFilterChip
                  label="Min Impact"
                  value={filterState.impact ?? 0}
                  step="0.1"
                  onChange={(v) =>
                    setFilterState((p) => ({ ...p, impact: Number(v) }))
                  }
                  onRemove={() => handleRemoveFilter("impact")}
                />
              )}
            </div>
          )}
      </div>

      {/* Paper List */}
      {loading ? (
        <div className="flex justify-center items-center py-10 text-gray-500">
          <Loader2 className="h-5 w-5 animate-spin mr-2" />
          Loading papers...
        </div>
      ) : currentPapers.length > 0 ? (
        <>
          <div className="space-y-6">
            {currentPapers.map((paper) => (
              <div
                key={paper.paper_id}
                className="p-5 border border-gray-200 rounded-xl bg-white shadow-sm hover:shadow-md transition"
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1 pr-4">
                    <h3 className="font-semibold text-lg text-gray-900 mb-2">
                      {paper.title}
                    </h3>
                    {paper.abstract && (
                      <div className="text-gray-600 text-sm mb-4">
                        <p>{paper.abstract.slice(0, 350)}...</p>
                      </div>
                    )}
                    <hr className="border-t border-gray-200 my-3" />
                  </div>

                  <div className="text-sm text-gray-700 font-medium text-right min-w-[160px] space-y-1">
                    <p>📅 {paper.publication_year || "—"}</p>
                    <p>📈 {paper.citation_count || 0} Citations</p>
                    <p>⭐ {paper.impact_factor || "—"} Impact</p>
                    <p>🧾 {paper.journal || "—"}</p>
                  </div>
                </div>

                <div className="flex justify-between items-center mt-4">
                  {paper.oa_url && (
                    <a
                      href={paper.oa_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-blue-600 hover:text-blue-800 font-medium"
                    >
                      <Download className="h-4 w-4" /> Download
                    </a>
                  )}

                  <Link
                    to={`/app/papers/${paper.paper_id}`}
                    className="flex items-center gap-1 text-sm font-medium text-blue-700 hover:text-blue-900"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Eye className="h-4 w-4" />
                    View More
                  </Link>
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex justify-center items-center gap-2 mt-8 flex-wrap">
              <PaginationButton
                disabled={currentPage === 1}
                onClick={() => handlePageChange(currentPage - 1)}
                label="← Prev"
              />
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                <PaginationButton
                  key={p}
                  active={p === currentPage}
                  onClick={() => handlePageChange(p)}
                  label={String(p)}
                />
              ))}
              <PaginationButton
                disabled={currentPage === totalPages}
                onClick={() => handlePageChange(currentPage + 1)}
                label="Next →"
              />
            </div>
          )}
        </>
      ) : (
        <p className="text-gray-500 text-sm">No matching papers found.</p>
      )}
    </div>
  );
};

/** Small reusable filter chip components */
const FilterChip = ({ label, value, options, onChange, onRemove }: any) => (
  <div className="flex items-center gap-2 bg-gray-100 rounded-lg px-3 py-2 text-sm">
    <span className="font-medium text-gray-700">{label}</span>
    <select
      className="bg-transparent outline-none text-sm text-gray-700"
      value={String(value)}
      onChange={(e) => onChange(e.target.value)}
    >
      {options.map((o: any) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
    </select>
    <button
      onClick={onRemove}
      className="text-gray-500 hover:text-gray-700 transition"
    >
      <X className="h-4 w-4" />
    </button>
  </div>
);

const InputFilterChip = ({ label, value, onChange, onRemove, step }: any) => (
  <div className="flex items-center gap-2 bg-gray-100 rounded-lg px-3 py-2 text-sm">
    <span className="font-medium text-gray-700">{label}</span>
    <input
      type="number"
      value={value}
      min={0}
      step={step || 1}
      onChange={(e) => onChange(e.target.value)}
      className="w-20 bg-transparent outline-none text-gray-700 text-sm"
    />
    <button
      onClick={onRemove}
      className="text-gray-500 hover:text-gray-700 transition"
    >
      <X className="h-4 w-4" />
    </button>
  </div>
);

const PaginationButton = ({ active, disabled, label, onClick }: any) => (
  <button
    disabled={disabled}
    onClick={onClick}
    className={`px-3 py-2 text-sm rounded-lg border transition ${active
      ? "bg-blue-600 text-white border-blue-600"
      : disabled
        ? "text-gray-400 border-gray-200 cursor-not-allowed"
        : "text-blue-700 border-blue-300 hover:bg-blue-50"
      }`}
  >
    {label}
  </button>
);

export default ShowPapersPage;
