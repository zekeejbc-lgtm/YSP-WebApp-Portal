const FRONTEND_TRANSLATE_API_BASE = "https://translate.googleapis.com/translate_a/single";
const FRONTEND_TRANSLATION_DEBUG = import.meta.env.DEV;

function logFrontendTranslation_(message: string, details?: unknown): void {
  if (!FRONTEND_TRANSLATION_DEBUG) return;
  if (typeof details === "undefined") {
    console.warn(`[FrontendTranslation] ${message}`);
    return;
  }
  console.warn(`[FrontendTranslation] ${message}`, details);
}

function logFrontendTranslationError_(message: string, error?: unknown): void {
  if (!FRONTEND_TRANSLATION_DEBUG) return;
  console.error(`[FrontendTranslation] ${message}`, error);
}

const LANGUAGE_CODE_MAP: Record<string, string> = {
  eng_Latn: "en",
  tgl_Latn: "tl",
  ceb_Latn: "ceb",
  ilo_Latn: "ilo",
  hil_Latn: "tl",
  war_Latn: "tl",
  bik_Latn: "tl",
  pam_Latn: "tl",
  pag_Latn: "tl",
  ind_Latn: "id",
  msa_Latn: "ms",
  spa_Latn: "es",
  fra_Latn: "fr",
  deu_Latn: "de",
  ita_Latn: "it",
  por_Latn: "pt",
  nld_Latn: "nl",
  rus_Cyrl: "ru",
  zho_Hans: "zh-CN",
  kor_Hang: "ko",
  hin_Deva: "hi",
  tha_Thai: "th",
  vie_Latn: "vi",
  ara_Arab: "ar",
  arb_Arab: "ar",
  tur_Latn: "tr",
  ukr_Cyrl: "uk",
  jpn_Jpan: "ja",
};

const LANGUAGE_ALIAS_MAP: Record<string, string> = {
  english: "en",
  filipino: "tl",
  tagalog: "tl",
  cebuano: "ceb",
  ilocano: "ilo",
  hiligaynon: "tl",
  waray: "tl",
  bikol: "tl",
  kapampangan: "tl",
  pangasinan: "tl",
  spanish: "es",
  french: "fr",
  german: "de",
  italian: "it",
  portuguese: "pt",
  dutch: "nl",
  russian: "ru",
  chinese: "zh-CN",
  korean: "ko",
  indonesian: "id",
  malay: "ms",
  hindi: "hi",
  thai: "th",
  vietnamese: "vi",
  arabic: "ar",
  turkish: "tr",
  ukrainian: "uk",
  japanese: "ja",
};

export function resolveFrontendLanguageCode(value: string): string {
  const normalized = String(value || "").trim();
  if (!normalized) return "";

  if (LANGUAGE_CODE_MAP[normalized]) {
    return LANGUAGE_CODE_MAP[normalized];
  }

  const lowered = normalized.toLowerCase();
  if (LANGUAGE_ALIAS_MAP[lowered]) {
    return LANGUAGE_ALIAS_MAP[lowered];
  }

  if (/^[a-z]{2}(?:-[A-Za-z]{2})?$/.test(normalized)) {
    return normalized;
  }

  return "";
}

function extractGoogleTranslatedText(payload: unknown): string {
  if (!Array.isArray(payload) || payload.length === 0 || !Array.isArray(payload[0])) {
    return "";
  }

  const segments = payload[0] as Array<unknown>;
  const translated = segments
    .map((segment) => {
      if (!Array.isArray(segment) || segment.length === 0) return "";
      return String(segment[0] || "");
    })
    .join("");

  return translated.trim();
}

export async function translateTextInFrontend(
  text: string,
  targetLanguage: string,
  sourceLanguage: string = "eng_Latn"
): Promise<string> {
  const sourceText = String(text || "");
  if (!sourceText.trim()) return sourceText;

  const sourceCode = resolveFrontendLanguageCode(sourceLanguage) || "en";
  const targetCode = resolveFrontendLanguageCode(targetLanguage);

  logFrontendTranslation_("translateTextInFrontend called", {
    sourceLanguage,
    targetLanguage,
    sourceCode,
    targetCode,
    inputLength: sourceText.length,
    preview: sourceText.slice(0, 80),
  });

  if (!targetCode) {
    logFrontendTranslationError_("Unsupported target language", { targetLanguage });
    throw new Error(`Unsupported frontend target language: ${targetLanguage}`);
  }

  if (sourceCode.toLowerCase() === targetCode.toLowerCase()) {
    logFrontendTranslation_("Source and target language are equal; returning original text", {
      sourceCode,
      targetCode,
    });
    return sourceText;
  }

  const query = new URLSearchParams({
    client: "gtx",
    sl: sourceCode,
    tl: targetCode,
    dt: "t",
    q: sourceText,
  });

  const requestUrl = `${FRONTEND_TRANSLATE_API_BASE}?${query.toString()}`;
  logFrontendTranslation_("Sending frontend translation request", {
    requestUrl,
  });

  let response: Response;
  try {
    response = await fetch(requestUrl, {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
    });
  } catch (error) {
    logFrontendTranslationError_("Network error while requesting frontend translation", error);
    throw error;
  }

  logFrontendTranslation_("Frontend translation response received", {
    status: response.status,
    ok: response.ok,
  });

  if (!response.ok) {
    logFrontendTranslationError_("Frontend translation returned non-OK status", {
      status: response.status,
    });
    throw new Error(`Frontend translation failed (${response.status})`);
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch (error) {
    logFrontendTranslationError_("Failed to parse frontend translation JSON", error);
    throw error;
  }
  const translatedText = extractGoogleTranslatedText(payload);

  if (!translatedText) {
    logFrontendTranslationError_("Frontend translation returned empty text", {
      payload,
    });
    throw new Error("Frontend translation returned empty text.");
  }

  logFrontendTranslation_("Frontend translation succeeded", {
    outputLength: translatedText.length,
    preview: translatedText.slice(0, 80),
  });

  return translatedText;
}
