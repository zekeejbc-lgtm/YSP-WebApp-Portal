import { useMemo, useState } from "react";
import { AlertCircle, Check, Copy, Languages, Loader2 } from "lucide-react";

type LanguageOption = {
  label: string;
  value: string;
};

type TranslatorApiResponse = {
  success?: boolean;
  translatedText?: string;
  data?: {
    translatedText?: string;
  };
  error?: string;
  code?: number;
};

const GAS_TRANSLATOR_API_URL =
  import.meta.env.VITE_GAS_TRANSLATOR_API_URL ||
  import.meta.env.VITE_GAS_SYSTEM_TOOLS_API_URL ||
  import.meta.env.VITE_GAS_LOGIN_API_URL ||
  "";
const DEFAULT_SOURCE_LANGUAGE = "eng_Latn";
const DEFAULT_TARGET_LANGUAGE = "tgl_Latn";

const LANGUAGE_OPTIONS: LanguageOption[] = [
  { label: "Filipino (Tagalog)", value: "tgl_Latn" },
  { label: "Cebuano", value: "ceb_Latn" },
  { label: "Ilocano", value: "ilo_Latn" },
  { label: "Hiligaynon", value: "hil_Latn" },
  { label: "Waray", value: "war_Latn" },
  { label: "Bikol", value: "bik_Latn" },
  { label: "Kapampangan", value: "pam_Latn" },
  { label: "Pangasinan", value: "pag_Latn" },
  { label: "Indonesian", value: "ind_Latn" },
  { label: "Malay", value: "msa_Latn" },
  { label: "Spanish", value: "spa_Latn" },
  { label: "French", value: "fra_Latn" },
  { label: "German", value: "deu_Latn" },
  { label: "Italian", value: "ita_Latn" },
  { label: "Portuguese", value: "por_Latn" },
  { label: "Dutch", value: "nld_Latn" },
  { label: "Russian", value: "rus_Cyrl" },
  { label: "Chinese (Simplified)", value: "zho_Hans" },
  { label: "Korean", value: "kor_Hang" },
  { label: "Hindi", value: "hin_Deva" },
  { label: "Thai", value: "tha_Thai" },
  { label: "Vietnamese", value: "vie_Latn" },
  { label: "Arabic", value: "ara_Arab" },
  { label: "Turkish", value: "tur_Latn" },
  { label: "Ukrainian", value: "ukr_Cyrl" },
  { label: "Japanese", value: "jpn_Jpan" },
];

export default function TranslatorTool() {
  const [inputText, setInputText] = useState("");
  const [targetLanguage, setTargetLanguage] = useState(DEFAULT_TARGET_LANGUAGE);
  const [translatedText, setTranslatedText] = useState("");
  const [isTranslating, setIsTranslating] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  const canTranslate = useMemo(() => {
    return inputText.trim().length > 0 && !isTranslating;
  }, [inputText, isTranslating]);

  async function handleTranslate() {
    setError("");
    setCopied(false);
    setTranslatedText("");

    var text = inputText.trim();
    if (!text) {
      setError("Please enter English text to translate.");
      return;
    }

    var endpoint = GAS_TRANSLATOR_API_URL.trim();
    if (!endpoint) {
      setError("Translator API URL is missing. Set VITE_GAS_SYSTEM_TOOLS_API_URL (or VITE_GAS_TRANSLATOR_API_URL) in your environment.");
      return;
    }

    setIsTranslating(true);
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "text/plain;charset=utf-8",
        },
        body: JSON.stringify({
          action: "translateText",
          text,
          sourceLanguage: DEFAULT_SOURCE_LANGUAGE,
          targetLanguage,
        }),
      });

      const raw = await response.text();
      let payload: TranslatorApiResponse = {};
      try {
        payload = JSON.parse(raw) as TranslatorApiResponse;
      } catch {
        throw new Error("Translator API returned a non-JSON response.");
      }

      if (!response.ok || payload.success === false) {
        throw new Error(payload.error || `Translation request failed (${response.status}).`);
      }

      const output = String(payload.translatedText || payload.data?.translatedText || "").trim();
      if (!output) {
        throw new Error("Translation response did not include translated text.");
      }

      setTranslatedText(output);
    } catch (translationError) {
      setError(
        translationError instanceof Error
          ? translationError.message
          : "Unable to translate right now."
      );
    } finally {
      setIsTranslating(false);
    }
  }

  async function handleCopy() {
    if (!translatedText.trim()) return;
    try {
      await navigator.clipboard.writeText(translatedText);
      setCopied(true);
      window.setTimeout(function () {
        setCopied(false);
      }, 1500);
    } catch {
      setError("Copy failed. Please copy the text manually.");
    }
  }

  return (
    <section className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
      <div className="rounded-2xl border border-orange-200/70 bg-white/90 p-4 shadow-lg backdrop-blur-sm sm:p-6">
        <div className="mb-5 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-orange-100 text-orange-700">
            <Languages className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900">AI Translator</h2>
            <p className="text-sm text-slate-600">
              English to NLLB-200 target language translation.
            </p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-[1fr_220px]">
          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-slate-700">English Input</span>
            <textarea
              value={inputText}
              onChange={(event) => setInputText(event.target.value)}
              placeholder="Type your English text here..."
              className="min-h-[180px] w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 shadow-sm outline-none transition focus:border-orange-400 focus:ring-2 focus:ring-orange-200"
            />
            <div className="mt-1 text-xs text-slate-500">{inputText.length} characters</div>
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-slate-700">Target Language</span>
            <select
              value={targetLanguage}
              onChange={(event) => setTargetLanguage(event.target.value)}
              className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 shadow-sm outline-none transition focus:border-orange-400 focus:ring-2 focus:ring-orange-200"
            >
              {LANGUAGE_OPTIONS.map((language) => (
                <option key={language.value} value={language.value}>
                  {language.label} ({language.value})
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={handleTranslate}
              disabled={!canTranslate}
              className="mt-3 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-linear-to-r from-orange-500 to-red-500 px-4 text-sm font-semibold text-white shadow-md transition hover:from-orange-600 hover:to-red-600 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isTranslating ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Translating...
                </>
              ) : (
                <>Translate</>
              )}
            </button>

            <p className="mt-2 text-xs text-slate-500">
              Request uses Content-Type: text/plain for Google Apps Script compatibility.
            </p>
          </label>
        </div>

        {error ? (
          <div className="mt-4 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        ) : null}

        <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50/80 p-4">
          <div className="mb-2 flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-slate-700">Translated Output</h3>
            <button
              type="button"
              onClick={handleCopy}
              disabled={!translatedText.trim()}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? "Copied" : "Copy"}
            </button>
          </div>

          <div className="min-h-[120px] whitespace-pre-wrap rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800">
            {translatedText || "Your translated text will appear here."}
          </div>
        </div>
      </div>
    </section>
  );
}
