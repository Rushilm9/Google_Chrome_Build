// ---- LiteratureUploadPage.tsx ----

import React, { useState, useRef, useEffect } from "react";
import {
  Plus,
  FileText,
  ArrowLeft,
  Loader2,
  UploadCloud,
  Trash2,
  Eye,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { GlobalWorkerOptions, getDocument } from "pdfjs-dist";
import pdfjsWorker from "pdfjs-dist/build/pdf.worker?worker";

GlobalWorkerOptions.workerPort = new pdfjsWorker();

import { BASE_URL } from "../utils/constant";

// ✅ Upload + Review API inline
async function uploadAndReviewPaper(
  file: File,
  projectId: number
): Promise<
  {
    file_name: string;
    paper_id: number;
    analysis_id: number;
    metadata: { author?: string | null; title?: string | null; year?: string | null };
    message: string;
  }[]
> {
  return new Promise((resolve, reject) => {
    const formData = new FormData();
    formData.append("files", file, file.name);

    const xhr = new XMLHttpRequest();
    const endpoint = `${BASE_URL}/literature/project/${projectId}/upload-and-review`;

    xhr.open("POST", endpoint);
    xhr.setRequestHeader("accept", "application/json");

    xhr.onload = () => {
      if (xhr.status === 200) {
        try {
          const data = JSON.parse(xhr.responseText);
          const results = Array.isArray(data.results)
            ? data.results
            : data.results
            ? [data.results]
            : [];
          resolve(results);
        } catch {
          reject(new Error("Failed to parse server response"));
        }
      } else {
        reject(new Error(`Upload failed with status ${xhr.status}`));
      }
    };

    xhr.onerror = () => reject(new Error("Network error while uploading"));
    xhr.onabort = () => reject(new Error("Upload aborted"));
    xhr.send(formData);
  });
}

// ✅ Main Component
const LiteratureUploadPage: React.FC = () => {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [files, setFiles] = useState<
    { id: number; name: string; text?: string; analysis?: string; status: string }[]
  >([]);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");
  const [useChromeBuild, setUseChromeBuild] = useState(true);

  const [project, setProject] = useState<any>(null);
  const [alertMsg, setAlertMsg] = useState("");

  // 🧭 Load project info from localStorage
  useEffect(() => {
    const projectId = localStorage.getItem("selectedProjectId");
    const projects = JSON.parse(localStorage.getItem("projects") || "[]");
    const selected = projects.find((p: any) => p.project_id?.toString() === projectId);
    if (selected) {
      setProject(selected);
      setAlertMsg(`📁 Loaded project: ${selected.project_name}`);
    } else {
      if (projectId) {
        setProject({ project_id: Number(projectId), project_name: "Selected Project" });
        setAlertMsg("⚠️ Project found by ID only (no name info).");
      } else {
        setAlertMsg("⚠️ No project selected. Please select a project first.");
      }
    }
  }, []);

  // 📂 Handle file selection
  const handleFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files;
    if (!selectedFiles) return;
    const newEntries = Array.from(selectedFiles).map((f) => ({
      id: Date.now() + Math.random(),
      name: f.name,
      status: "📄 Pending",
    }));
    setFiles((prev) => [...prev, ...newEntries]);
    setStatus(`${selectedFiles.length} file(s) ready for analysis.`);
  };

  // 🗑️ Delete file
  const deleteFile = (id: number) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
    setStatus("🗑️ File removed.");
  };

  // 📘 Extract text from PDF/TXT
  const extractText = async (file: File): Promise<string> => {
    if (file.type.startsWith("text/") || file.name.endsWith(".txt")) {
      return await file.text();
    }
    if (file.name.endsWith(".pdf")) {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await getDocument({ data: new Uint8Array(arrayBuffer) }).promise;
      let text = "";
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        const pageText = content.items.map((item: any) => item.str).join(" ");
        text += pageText + "\n";
      }
      return text;
    }
    throw new Error("Unsupported file type");
  };

  // 📑 Split by major sections
  const splitBySection = (text: string) => {
    const sectionTitles = [
      "Abstract",
      "Introduction",
      "Background",
      "Literature Review",
      "Methodology",
      "Materials and Methods",
      "Results",
      "Discussion",
      "Conclusion",
    ];
    const regex = new RegExp(`(${sectionTitles.join("|")})`, "gi");
    const parts = text.split(regex).filter((p) => p.trim().length > 0);
    const sections: { title: string; content: string }[] = [];
    for (let i = 0; i < parts.length; i++) {
      const title = parts[i].trim();
      const next = parts[i + 1];
      if (sectionTitles.some((t) => title.toLowerCase().includes(t.toLowerCase()))) {
        sections.push({ title, content: next ? next.trim() : "" });
      }
    }
    return sections;
  };

  // 🧠 Local summarization (Chrome Build)
  const summarizeText = async (sectionText: string, sectionName: string) => {
    let summary = "";
    if ("ai" in self && (self as any).ai?.summarizer) {
      const summarizer = await (self as any).ai.summarizer.create({
        type: "key-points",
        format: "plain-text",
      });
      summary = await summarizer.summarize(sectionText.slice(0, 20000));
    } else if ("LanguageModel" in self) {
      const model = await (self as any).LanguageModel.create({
        expectedInputs: [{ type: "text", languages: ["en"] }],
        output: { type: "text", language: "en" },
      });
      const prompt = `
      You are an academic assistant. Summarize the following "${sectionName}" section.
      Focus on its core ideas for literature review writing (100–150 words).
      Text:
      """${sectionText.slice(0, 20000)}"""
      `;
      summary = await model.prompt(prompt);
    }
    return summary || "(No summary generated)";
  };

  // 🪄 Combine summaries
  const synthesizeSummary = async (allSummaries: string, fileName: string) => {
    if ("ai" in self && (self as any).ai?.prompt) {
      const session = await (self as any).ai.prompt.create({
        output: { type: "text", language: "en" },
      });
      return await session.prompt(`
      Combine these section summaries into one complete markdown literature review.
      Use headings like ### Introduction, ### Results, etc.
      """${allSummaries}"""
      `);
    }
    return allSummaries;
  };

  // 🧩 Analyze locally (Chrome Build)
  const analyzeWithChromeBuild = async () => {
    if (files.length === 0) return;
    setLoading(true);
    setStatus("🧠 Running Chrome Build locally...");

    const inputFiles = fileInputRef.current?.files;
    if (!inputFiles) return;

    const updatedFiles: typeof files = [];

    for (const f of files) {
      const match = Array.from(inputFiles).find((i) => i.name === f.name);
      if (!match) continue;

      try {
        setStatus(`⏳ Extracting text from ${f.name}...`);
        const text = await extractText(match);
        const sections = splitBySection(text);

        if (sections.length === 0) {
          updatedFiles.push({ ...f, text, status: "⚠️ No sections detected" });
          continue;
        }

        const summaries: string[] = [];
        for (const { title, content } of sections) {
          setStatus(`📑 Summarizing: ${title}...`);
          const summary = await summarizeText(content, title);
          summaries.push(`### ${title}\n${summary}`);
        }

        setStatus(`🧩 Combining summaries for ${f.name}...`);
        const finalSummary = await synthesizeSummary(summaries.join("\n\n"), f.name);

        updatedFiles.push({
          ...f,
          text,
          analysis: finalSummary,
          status: "✅ Completed (Chrome Build)",
        });
      } catch (err: any) {
        updatedFiles.push({ ...f, status: `❌ Error: ${err.message}` });
      }
    }

    localStorage.setItem("localAnalyzedPapers", JSON.stringify(updatedFiles));
    setFiles(updatedFiles);
    setLoading(false);
    setStatus("✅ All analyses complete!");
    navigate("/app/literature/local"); // ✅ Chrome Build → local page
  };

  // 🌐 Analyze via Gemini backend
  const analyzeWithGemini = async () => {
    if (files.length === 0) return;
    if (!project?.project_id) {
      setAlertMsg("⚠️ Please select a project before running Gemini analysis.");
      return;
    }
    setLoading(true);
    setStatus("🚀 Uploading to Gemini backend...");

    const inputFiles = fileInputRef.current?.files;
    if (!inputFiles) return;

    const updatedFiles: typeof files = [];

    for (const f of files) {
      const match = Array.from(inputFiles).find((i) => i.name === f.name);
      if (!match) continue;

      try {
        setStatus(`📤 Uploading ${f.name} for Gemini analysis...`);
        const result = await uploadAndReviewPaper(match, project.project_id);

        updatedFiles.push({
          ...f,
          analysis: result?.[0]?.message || "Analysis complete.",
          status: "✅ Completed (Gemini)",
        });
      } catch (err: any) {
        updatedFiles.push({ ...f, status: `❌ Gemini Error: ${err.message}` });
      }
    }

    localStorage.setItem("geminiAnalyzedPapers", JSON.stringify(updatedFiles));
    setFiles(updatedFiles);
    setLoading(false);
    setStatus("✅ Gemini analyses complete!");
    navigate("/app/literature"); // ✅ Gemini → main literature page
  };

  // 🔁 Unified handler
  const handleAnalyze = () => {
    if (useChromeBuild) analyzeWithChromeBuild();
    else analyzeWithGemini();
  };

  const goBack = () => navigate(-1);
  const viewAll = () => navigate(useChromeBuild ? "/app/literature/local" : "/app/literature");

  return (
    <div className="pt-20 p-6 space-y-6">
      <button
        onClick={goBack}
        className="inline-flex items-center gap-2 px-3 py-2 border rounded text-sm hover:bg-gray-50"
      >
        <ArrowLeft className="h-4 w-4" /> Back
      </button>

      {alertMsg && (
        <div
          className={`p-3 rounded text-sm ${
            alertMsg.includes("⚠️") ? "bg-yellow-50 text-yellow-800" : "bg-green-50 text-green-800"
          } border`}
        >
          {alertMsg}
        </div>
      )}

      <div className="bg-white p-6 rounded-lg shadow border max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <UploadCloud className="h-5 w-5 text-blue-600" />
            Upload & Analyze Papers ({useChromeBuild ? "Chrome Build" : "Gemini"})
          </h2>

          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-600">Chrome Build</span>
            <button
              onClick={() => setUseChromeBuild((p) => !p)}
              className={`relative w-12 h-6 flex items-center rounded-full transition ${
                useChromeBuild ? "bg-green-600" : "bg-gray-400"
              }`}
            >
              <span
                className={`absolute left-1 top-1 w-4 h-4 rounded-full bg-white transform transition ${
                  useChromeBuild ? "translate-x-6" : ""
                }`}
              />
            </button>
            <span className="text-sm text-gray-600">Gemini</span>
          </div>
        </div>

        <div className="border-dashed border-2 border-gray-300 p-6 text-center rounded-lg hover:border-blue-500 transition">
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.txt"
            multiple
            onChange={handleFiles}
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm"
          >
            <Plus className="h-4 w-4" /> Select Files
          </button>
          <p className="text-xs text-gray-500 mt-2">Supported: PDF, TXT</p>
        </div>

        {files.length > 0 && (
          <div className="mt-5 border rounded-lg bg-gray-50 p-3 max-h-[250px] overflow-auto">
            {files.map((f) => (
              <div
                key={f.id}
                className="flex items-center justify-between border-b last:border-none py-2"
              >
                <div className="flex items-center gap-2 text-sm">
                  <FileText className="h-4 w-4 text-blue-600" /> {f.name}
                </div>
                <div className="flex items-center gap-3">
                  <span
                    className={`text-xs ${
                      f.status.startsWith("✅")
                        ? "text-green-600"
                        : f.status.startsWith("❌")
                        ? "text-red-600"
                        : "text-gray-600"
                    }`}
                  >
                    {f.status}
                  </span>
                  <button
                    onClick={() => deleteFile(f.id)}
                    className="text-red-500 hover:text-red-700"
                    title="Delete file"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="flex flex-wrap gap-3 mt-5">
          <button
            onClick={handleAnalyze}
            disabled={loading || files.length === 0}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded text-white ${
              loading ? "bg-gray-400" : "bg-blue-600 hover:bg-blue-700"
            }`}
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {loading ? "Analyzing..." : "Analyze"}
          </button>

          <button
            onClick={viewAll}
            className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 hover:bg-gray-100 text-sm"
          >
            <Eye className="h-4 w-4 text-blue-600" /> Show All
          </button>
        </div>

        <p className="text-sm text-gray-600 mt-3">{status}</p>
      </div>
    </div>
  );
};

export default LiteratureUploadPage;
