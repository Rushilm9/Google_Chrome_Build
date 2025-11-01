import React, { useState } from "react";
import {
  ArrowLeft,
  Loader2,
  Languages,
  FileText,
  Download,
  Clipboard,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { jsPDF } from "jspdf";

const ChromeTranslatorPage: React.FC = () => {
  const navigate = useNavigate();

  const [inputText, setInputText] = useState("");
  const [outputText, setOutputText] = useState("");
  const [inputLang, setInputLang] = useState("auto");
  const [outputLang, setOutputLang] = useState("es");
  const [loading, setLoading] = useState<"translate" | "summarize" | null>(null);

  const languages = [
    { code: "auto", name: "Auto Detect" },
    { code: "en", name: "English" },
    { code: "es", name: "Spanish" },
    { code: "fr", name: "French" },
    { code: "de", name: "German" },
    { code: "hi", name: "Hindi" },
    { code: "ar", name: "Arabic" },
    { code: "zh", name: "Chinese" },
    { code: "ja", name: "Japanese" },
    { code: "ko", name: "Korean" },
  ];

  const summarizeText = async () => {
    const text = inputText.trim();
    if (!text) return setOutputText("⚠️ Please enter some text.");
    setLoading("summarize");
    setOutputText("🧠 Summarizing...");

    try {
      if ("ai" in self && (self as any).ai?.summarizer) {
        const summarizer = await (self as any).ai.summarizer.create({
          expectedInputLanguages:
            inputLang === "auto" ? undefined : [inputLang],
          output: { type: "text", language: outputLang },
        });
        const result = await summarizer.summarize(text);
        setOutputText(result || "(No response)");
      } else if ("LanguageModel" in self) {
        const model = await (self as any).LanguageModel.create({
          expectedInputs: [{ type: "text", languages: [inputLang] }],
          output: { type: "text", language: outputLang },
        });
        const prompt = `Summarize the following text in ${outputLang}:\n\n${text}`;
        const result = await model.prompt(prompt);
        setOutputText(result);
      } else {
        setOutputText("❌ Summarizer not supported in this Chrome version.");
      }
    } catch (err: any) {
      console.error(err);
      setOutputText("⚠️ Error: " + err.message);
    } finally {
      setLoading(null);
    }
  };

  const translateText = async () => {
    const text = inputText.trim();
    if (!text) return setOutputText("⚠️ Please enter some text.");
    setLoading("translate");
    setOutputText("🌍 Translating...");

    try {
      if ("ai" in self && (self as any).ai?.translator) {
        const translator = await (self as any).ai.translator.create();
        const translated = await translator.translate(text, {
          targetLanguage: outputLang,
        });
        setOutputText(translated);
      } else if ("LanguageModel" in self) {
        const model = await (self as any).LanguageModel.create({
          expectedInputs: [{ type: "text", languages: ["en"] }],
          output: { type: "text", language: outputLang },
        });

        const srcText =
          inputLang === "auto"
            ? "auto-detect the language"
            : languages.find((l) => l.code === inputLang)?.name || "English";

        const targetText =
          languages.find((l) => l.code === outputLang)?.name || "Spanish";

        const prompt = `Translate the following text from ${srcText} to ${targetText}:\n\n${text}`;
        const result = await model.prompt(prompt);
        setOutputText(result);
      } else {
        setOutputText("❌ Neither Translator nor LanguageModel API available.");
      }
    } catch (err: any) {
      console.error(err);
      setOutputText("⚠️ Error: " + err.message);
    } finally {
      setLoading(null);
    }
  };

  const handleCopy = () => {
    if (!outputText) return;
    navigator.clipboard.writeText(outputText);
    alert("✅ Translation copied to clipboard!");
  };

  const handleDownload = () => {
    if (!outputText) return;
    const blob = new Blob([outputText], { type: "text/plain" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "translated_text.txt";
    link.click();
  };

  const handleDownloadPDF = () => {
    if (!outputText) return;
    const doc = new jsPDF();
    const lines = doc.splitTextToSize(outputText, 180);
    doc.text(lines, 10, 10);
    doc.save("translation.pdf");
  };

  const goBack = () => navigate(-1);

  return (
    <div className="pt-20 p-6 max-w-4xl mx-auto space-y-6">
      <button
        onClick={goBack}
        className="inline-flex items-center gap-2 px-3 py-2 border rounded text-sm hover:bg-gray-50"
      >
        <ArrowLeft className="h-4 w-4" /> Back
      </button>

      <div className="bg-white shadow border rounded-lg p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between border-b pb-3">
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Languages className="h-5 w-5 text-blue-600" />
            Chrome AI Translator & Summarizer
          </h2>
        </div>

        {/* Language Selectors */}
        <div className="flex flex-wrap gap-4">
          <div className="flex flex-col">
            <label className="text-sm font-medium text-gray-700">
              Input Language
            </label>
            <select
              value={inputLang}
              onChange={(e) => setInputLang(e.target.value)}
              className="border rounded p-2 text-sm"
            >
              {languages.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col">
            <label className="text-sm font-medium text-gray-700">
              Output Language
            </label>
            <select
              value={outputLang}
              onChange={(e) => setOutputLang(e.target.value)}
              className="border rounded p-2 text-sm"
            >
              {languages.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Input Text Area */}
        <div>
          <label className="text-sm font-medium text-gray-700 mb-2 block">
            Enter Text
          </label>
          <textarea
            className="w-full h-48 border rounded p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Paste or type your text here..."
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
          />
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-3">
          <button
            onClick={translateText}
            disabled={loading === "translate"}
            className="inline-flex items-center gap-2 px-4 py-2 rounded text-sm bg-blue-600 hover:bg-blue-700 text-white"
          >
            {loading === "translate" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Languages className="h-4 w-4" />
            )}
            Translate
          </button>

          <button
            onClick={summarizeText}
            disabled={loading === "summarize"}
            className="inline-flex items-center gap-2 px-4 py-2 rounded text-sm bg-green-600 hover:bg-green-700 text-white"
          >
            {loading === "summarize" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <FileText className="h-4 w-4" />
            )}
            Summarize
          </button>
        </div>

        {/* Output */}
        <div>
          <label className="text-sm font-medium text-gray-700 mb-2 block">
            Output
          </label>
          <textarea
            readOnly
            className="w-full h-60 border rounded p-3 text-sm bg-gray-50"
            value={outputText}
          />
        </div>

        {/* Copy / Download */}
        <div className="flex flex-wrap gap-3 justify-end">
          <button
            onClick={handleCopy}
            className="inline-flex items-center gap-2 px-4 py-2 rounded text-sm bg-gray-600 hover:bg-gray-700 text-white"
          >
            <Clipboard className="h-4 w-4" /> Copy Output
          </button>
          <button
            onClick={handleDownload}
            className="inline-flex items-center gap-2 px-4 py-2 rounded text-sm bg-blue-600 hover:bg-blue-700 text-white"
          >
            <Download className="h-4 w-4" /> Download as Text
          </button>
          <button
            onClick={handleDownloadPDF}
            className="inline-flex items-center gap-2 px-4 py-2 rounded text-sm bg-green-600 hover:bg-green-700 text-white"
          >
            <Download className="h-4 w-4" /> Download as PDF
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChromeTranslatorPage;
