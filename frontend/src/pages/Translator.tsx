import React, { useState } from "react";
import { Clipboard, Check } from "lucide-react";

interface TranslatorProps {
  text: string;
}

const Translator: React.FC<TranslatorProps> = ({ text }) => {
  const [inputLang, setInputLang] = useState("auto");
  const [outputLang, setOutputLang] = useState("en");
  const [mode, setMode] = useState<"translate" | "summarize">("translate");
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [timeTaken, setTimeTaken] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  const startTimer = () => performance.now();
  const stopTimer = (start: number) =>
    setTimeTaken(Number(((performance.now() - start) / 1000).toFixed(2)));

  // Progress bar simulation
  const simulateProgress = () => {
    setProgress(0);
    const interval = setInterval(() => {
      setProgress((p) => {
        if (p >= 90) {
          clearInterval(interval);
          return p;
        }
        return p + Math.random() * 10;
      });
    }, 200);
    return interval;
  };

  const handleRun = async () => {
    if (!text.trim()) {
      setError("⚠️ No text provided.");
      return;
    }

    setLoading(true);
    setError("");
    setResult("");
    setTimeTaken(null);
    setCopied(false);

    const startTime = startTimer();
    const progressInterval = simulateProgress();

    try {
      if (mode === "summarize") {
        if ("ai" in self && (self as any).ai?.summarizer) {
          const summarizer = await (self as any).ai.summarizer.create({
            expectedInputLanguages:
              inputLang === "auto" ? undefined : [inputLang],
            output: { type: "text", language: outputLang },
          });
          const res = await summarizer.summarize(text);
          setResult(res || "(No summary generated)");
        } else if ("LanguageModel" in self) {
          const model = await (self as any).LanguageModel.create({
            expectedInputs: [{ type: "text", languages: ["en"] }],
            output: { type: "text", language: outputLang },
          });
          const prompt = `Summarize the following text in ${outputLang}:\n\n${text}`;
          const res = await model.prompt(prompt);
          setResult(res);
        } else {
          setError("❌ Summarizer not supported in this Chrome version.");
        }
      } else {
        // translation mode
        if ("ai" in self && (self as any).ai?.translator) {
          const translator = await (self as any).ai.translator.create();
          const translated = await translator.translate(text, {
            targetLanguage: outputLang,
          });
          setResult(translated);
        } else if ("LanguageModel" in self) {
          const model = await (self as any).LanguageModel.create({
            expectedInputs: [{ type: "text", languages: ["en"] }],
            output: { type: "text", language: outputLang },
          });
          const sourceLang =
            inputLang === "auto" ? "auto-detect" : inputLang;
          const prompt = `Translate the following text from ${sourceLang} to ${outputLang}:\n\n${text}`;
          const res = await model.prompt(prompt);
          setResult(res);
        } else {
          setError("❌ Translator not supported in this Chrome version.");
        }
      }
    } catch (err: any) {
      console.error(err);
      setError("⚠️ " + err.message);
    } finally {
      clearInterval(progressInterval);
      setProgress(100);
      stopTimer(startTime);
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    if (!result) return;
    await navigator.clipboard.writeText(result);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-md mt-6">
      <div className="flex flex-wrap justify-between items-center mb-4">
        <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          {mode === "translate" ? "🌍 Translate" : "🧠 Summarize"} Abstract
        </h2>
        <div className="flex gap-2">
          <button
            onClick={() => setMode("translate")}
            className={`px-3 py-1 rounded-md text-sm font-medium transition ${
              mode === "translate"
                ? "bg-blue-600 text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            Translate
          </button>
          <button
            onClick={() => setMode("summarize")}
            className={`px-3 py-1 rounded-md text-sm font-medium transition ${
              mode === "summarize"
                ? "bg-purple-600 text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            Summarize
          </button>
        </div>
      </div>

      {/* Language selectors */}
      <div className="flex flex-wrap gap-4 mb-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Input Language
          </label>
          <select
            value={inputLang}
            onChange={(e) => setInputLang(e.target.value)}
            className="border border-gray-300 rounded-md p-2 text-sm"
          >
            <option value="auto">Auto Detect</option>
            <option value="en">English</option>
            <option value="es">Spanish</option>
            <option value="fr">French</option>
            <option value="de">German</option>
            <option value="hi">Hindi</option>
            <option value="ja">Japanese</option>
            <option value="ko">Korean</option>
            <option value="zh">Chinese</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Output Language
          </label>
          <select
            value={outputLang}
            onChange={(e) => setOutputLang(e.target.value)}
            className="border border-gray-300 rounded-md p-2 text-sm"
          >
            <option value="en">English</option>
            <option value="es">Spanish</option>
            <option value="fr">French</option>
            <option value="de">German</option>
            <option value="hi">Hindi</option>
            <option value="ja">Japanese</option>
            <option value="ko">Korean</option>
            <option value="zh">Chinese</option>
          </select>
        </div>
      </div>

      {/* Progress bar */}
      {loading && (
        <div className="w-full bg-gray-200 rounded-full h-2 mb-4">
          <div
            className="bg-blue-600 h-2 rounded-full transition-all"
            style={{ width: `${progress}%` }}
          ></div>
        </div>
      )}

      {/* Action button */}
      <button
        onClick={handleRun}
        disabled={loading}
        className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium shadow-sm transition ${
          loading
            ? "bg-gray-400 text-white"
            : mode === "translate"
            ? "bg-blue-600 hover:bg-blue-700 text-white"
            : "bg-purple-600 hover:bg-purple-700 text-white"
        }`}
      >
        {loading
          ? "Processing..."
          : mode === "translate"
          ? "Translate Text"
          : "Summarize Text"}
      </button>

      {/* Timer */}
      {timeTaken !== null && (
        <p className="mt-3 text-xs text-gray-500">
          ⏱️ Completed in {timeTaken}s
        </p>
      )}

      {/* Output */}
      <div className="mt-4 text-sm text-gray-700 whitespace-pre-wrap relative">
        {error && <p className="text-red-500">{error}</p>}

        {!error && result && (
          <div className="bg-gray-50 border border-gray-200 rounded-md p-3 max-h-96 overflow-y-auto relative">
            {/* Copy button */}
            <button
              onClick={handleCopy}
              className="absolute top-2 right-2 text-gray-500 hover:text-gray-800 transition"
              title="Copy text"
            >
              {copied ? (
                <Check className="h-4 w-4 text-green-600" />
              ) : (
                <Clipboard className="h-4 w-4" />
              )}
            </button>

            <strong className="block mb-2">
              {mode === "translate" ? "Translated Text:" : "Summary:"}
            </strong>
            <p className="text-gray-800 leading-relaxed">{result}</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Translator;
