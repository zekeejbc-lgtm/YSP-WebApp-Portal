import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Send, MessageSquare, X, Minimize2, Loader2, User } from "lucide-react";
import { openEmailApp } from "../utils/externalLinks";
import { getAllOfficers, searchOfficers, type DirectoryOfficer } from "../services/gasDirectoryService";
import { fetchEvents, formatEventDate } from "../services/gasEventsService";
import { fetchAllProjects, type Project } from "../services/projectsService";
import { getStoredUser, getSessionToken, fetchUserProfile, type UserProfile } from "../services/gasLoginService";
import type { AttendanceDashboardContext } from "./AttendanceDashboardPage";
import { orgConfig } from "../config/org.config";
import { translateTextInFrontend } from "../services/frontendTranslationService";

// API URL loaded from environment variable
const API_URL = import.meta.env.VITE_GAS_CHATBOT_API_URL || '';
const TRANSLATOR_API_URL =
  import.meta.env.VITE_GAS_TRANSLATOR_API_URL ||
  import.meta.env.VITE_GAS_SYSTEM_TOOLS_API_URL ||
  import.meta.env.VITE_GAS_LOGIN_API_URL ||
  '';

type Sender = "user" | "bot";
type KnowledgeSource = "database" | "mixed" | "gemini";
type ChatMode = "assistant" | "llm";

interface Message {
  id: number;
  text: string;
  originalText?: string;
  sender: Sender;
  image?: string;
  source?: KnowledgeSource;
}

interface YSPChatBotProps {
  userRole?: string;
  orgChartUrl?: string;
  onOfficerDirectorySearch?: (request: { query: string; idCode?: string }) => void;
  onRequestCacheClear?: () => void;
  currentPage?: string;
  hidden?: boolean;
  onTriggerEditMode?: () => void;
  attendanceDashboardContext?: AttendanceDashboardContext | null;
  isDark?: boolean;
}

// 👇 Add this new interface for the Knowledge Base
interface KBEntry {
  keywords: string[];
  answer: string;
  lookup?: string; // The name to search in the directory
}

// 💡 SUGGESTIONS: Quick reply chips
const BASE_SUGGESTIONS = [
  "/help",
  "/mode llm",
  "/mode assistant",
  "/translate list",
  "/translate filipino",
  "/translate off",
  "Who is the founder?",
  "What are the advocacy pillars?",
  "About YSP",
  "Mission statement",
  "Vision Statment",
  "How to join YSP?",
  "I forgot my password",
  "Who is the current Chapter President?",
  "Who are the Executive Board?",
  "What is YSP?",
  "How to contact developer?",
  "Report Portal Issues",
  "Events in December",
  "Show projects implemented",
  "@system clear cache",
  "@system hard refresh",
];

const ORG_LABEL = orgConfig.shortName;

const CHATBOT_TRANSLATION_STORAGE_KEY = "ysp_chatbot_translation_language";
const CHATBOT_TRANSLATION_DEFAULT_LANGUAGE = "eng_Latn";
const CHATBOT_TRANSLATION_EVENT_NAME = "ysp:chatbot-translation-language-changed";
const CHATBOT_TRANSLATION_DEBUG = import.meta.env.DEV;

function logChatbotTranslation_(message: string, details?: unknown): void {
  if (!CHATBOT_TRANSLATION_DEBUG) return;
  if (typeof details === "undefined") {
    console.warn(`[ChatbotTranslation] ${message}`);
    return;
  }
  console.warn(`[ChatbotTranslation] ${message}`, details);
}

function logChatbotTranslationError_(message: string, error?: unknown): void {
  if (!CHATBOT_TRANSLATION_DEBUG) return;
  console.error(`[ChatbotTranslation] ${message}`, error);
}

type ChatbotTranslationLanguage = {
  code: string;
  label: string;
  aliases: string[];
};

const CHATBOT_TRANSLATION_LANGUAGES: ChatbotTranslationLanguage[] = [
  { code: "eng_Latn", label: "English", aliases: ["english", "eng", "off", "none", "disable", "disabled"] },
  { code: "tgl_Latn", label: "Filipino (Tagalog)", aliases: ["filipino", "tagalog", "tl"] },
  { code: "ceb_Latn", label: "Cebuano", aliases: ["cebuano", "bisaya"] },
  { code: "ilo_Latn", label: "Ilocano", aliases: ["ilocano"] },
  { code: "hil_Latn", label: "Hiligaynon", aliases: ["hiligaynon", "ilonggo"] },
  { code: "war_Latn", label: "Waray", aliases: ["waray"] },
  { code: "bik_Latn", label: "Bikol", aliases: ["bikol", "bicolano", "bicol"] },
  { code: "pam_Latn", label: "Kapampangan", aliases: ["kapampangan", "kap"] },
  { code: "pag_Latn", label: "Pangasinan", aliases: ["pangasinan"] },
  { code: "spa_Latn", label: "Spanish", aliases: ["spanish", "espanol", "espa\u00f1ol"] },
  { code: "fra_Latn", label: "French", aliases: ["french", "francais", "fr"] },
  { code: "deu_Latn", label: "German", aliases: ["german", "deutsch", "de"] },
  { code: "ita_Latn", label: "Italian", aliases: ["italian", "italiano", "it"] },
  { code: "por_Latn", label: "Portuguese", aliases: ["portuguese", "portugues", "pt"] },
  { code: "nld_Latn", label: "Dutch", aliases: ["dutch", "nederlands", "nl"] },
  { code: "rus_Cyrl", label: "Russian", aliases: ["russian", "russki", "ru"] },
  { code: "zho_Hans", label: "Chinese (Simplified)", aliases: ["chinese", "mandarin", "zh", "zh-cn"] },
  { code: "kor_Hang", label: "Korean", aliases: ["korean", "hangul", "ko"] },
  { code: "ind_Latn", label: "Indonesian", aliases: ["indonesian", "bahasa"] },
  { code: "msa_Latn", label: "Malay", aliases: ["malay", "bahasa melayu", "ms"] },
  { code: "hin_Deva", label: "Hindi", aliases: ["hindi", "hi"] },
  { code: "tha_Thai", label: "Thai", aliases: ["thai", "th"] },
  { code: "vie_Latn", label: "Vietnamese", aliases: ["vietnamese", "tieng viet", "vi"] },
  { code: "ara_Arab", label: "Arabic", aliases: ["arabic", "ar"] },
  { code: "tur_Latn", label: "Turkish", aliases: ["turkish", "turkce", "tr"] },
  { code: "ukr_Cyrl", label: "Ukrainian", aliases: ["ukrainian", "ukrainska", "uk"] },
  { code: "jpn_Jpan", label: "Japanese", aliases: ["japanese", "nihongo"] },
];

function escapeRegExpForChatbot_(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeTranslationLanguage_(value: string): string {
  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized) return "";

  const direct = CHATBOT_TRANSLATION_LANGUAGES.find(
    (language) => language.code.toLowerCase() === normalized
  );
  if (direct) return direct.code;

  const alias = CHATBOT_TRANSLATION_LANGUAGES.find((language) =>
    language.aliases.some((entry) => entry.toLowerCase() === normalized)
  );
  return alias ? alias.code : "";
}

function getTranslationLanguageLabel_(code: string): string {
  const match = CHATBOT_TRANSLATION_LANGUAGES.find((language) => language.code === code);
  return match ? match.label : code;
}

function loadChatbotTranslationLanguage_(): string {
  try {
    const stored = localStorage.getItem(CHATBOT_TRANSLATION_STORAGE_KEY) || "";
    const normalized = normalizeTranslationLanguage_(stored);
    return normalized || CHATBOT_TRANSLATION_DEFAULT_LANGUAGE;
  } catch {
    return CHATBOT_TRANSLATION_DEFAULT_LANGUAGE;
  }
}

function saveChatbotTranslationLanguage_(language: string): void {
  try {
    localStorage.setItem(CHATBOT_TRANSLATION_STORAGE_KEY, language);
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent(CHATBOT_TRANSLATION_EVENT_NAME, {
          detail: { language },
        })
      );
    }
  } catch {
    // Ignore storage failures.
  }
}

function maskOrgNamesForTranslation_(text: string): { maskedText: string; tokens: Array<{ key: string; value: string }> } {
  const orgCandidates = Array.from(
    new Set([
      String(orgConfig.orgName || "").trim(),
      String(orgConfig.chapterName || "").trim(),
      String(orgConfig.shortName || "").trim(),
      String(orgConfig.fullName || "").trim(),
      String(orgConfig.portalName || "").trim(),
    ].filter(Boolean))
  ).sort((a, b) => b.length - a.length);

  let maskedText = String(text || "");
  const tokens: Array<{ key: string; value: string }> = [];

  for (const candidate of orgCandidates) {
    const regex = new RegExp(escapeRegExpForChatbot_(candidate), "gi");
    maskedText = maskedText.replace(regex, (matched) => {
      const key = `__ORG_NAME_TOKEN_${tokens.length}__`;
      tokens.push({ key, value: matched });
      return key;
    });
  }

  return { maskedText, tokens };
}

function unmaskOrgNamesForTranslation_(text: string, tokens: Array<{ key: string; value: string }>): string {
  let restored = String(text || "");
  for (const token of tokens) {
    restored = restored.split(token.key).join(token.value);
  }
  return restored;
}

function splitTranslationText_(text: string, maxLen: number): string[] {
  const source = String(text || "");
  if (!source.trim()) return [];
  if (source.length <= maxLen) return [source];

  const lines = source.split("\n");
  const chunks: string[] = [];
  let current = "";

  for (const line of lines) {
    const next = current ? `${current}\n${line}` : line;
    if (next.length <= maxLen) {
      current = next;
      continue;
    }
    if (current) {
      chunks.push(current);
      current = "";
    }

    if (line.length <= maxLen) {
      current = line;
      continue;
    }

    let start = 0;
    while (start < line.length) {
      chunks.push(line.slice(start, start + maxLen));
      start += maxLen;
    }
  }

  if (current) chunks.push(current);
  return chunks;
}

async function translateBotText_(text: string, targetLanguage: string): Promise<string> {
  if (!text.trim()) return text;
  if (targetLanguage === CHATBOT_TRANSLATION_DEFAULT_LANGUAGE) return text;

  logChatbotTranslation_("translateBotText_ called", {
    targetLanguage,
    inputLength: text.length,
    preview: text.slice(0, 80),
  });

  const masked = maskOrgNamesForTranslation_(text);
  const chunks = splitTranslationText_(masked.maskedText, 3800);
  if (!chunks.length) return text;

  logChatbotTranslation_("Text split into chunks", {
    chunkCount: chunks.length,
    targetLanguage,
  });

  const translatedChunks: string[] = [];

  for (const chunk of chunks) {
    try {
      logChatbotTranslation_("Trying frontend translation chunk", {
        targetLanguage,
        chunkLength: chunk.length,
        preview: chunk.slice(0, 80),
      });
      const frontendTranslated = await translateTextInFrontend(chunk, targetLanguage, "eng_Latn");
      if (frontendTranslated && frontendTranslated.trim()) {
        logChatbotTranslation_("Frontend chunk translation success", {
          translatedLength: frontendTranslated.length,
          preview: frontendTranslated.slice(0, 80),
        });
        translatedChunks.push(frontendTranslated);
        continue;
      }
    } catch (frontendError) {
      logChatbotTranslationError_("Frontend chunk translation failed; trying backend fallback", frontendError);
      // Fallback to backend route if frontend translation is unavailable.
    }

    if (!TRANSLATOR_API_URL.trim()) {
      logChatbotTranslationError_("No backend translation URL configured for fallback", {
        targetLanguage,
        preview: chunk.slice(0, 80),
      });
      throw new Error("Frontend translation is unavailable and backend route is not configured.");
    }

    logChatbotTranslation_("Trying backend translation chunk", {
      endpoint: TRANSLATOR_API_URL,
      targetLanguage,
      chunkLength: chunk.length,
    });

    const response = await fetch(TRANSLATOR_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "text/plain;charset=utf-8",
      },
      body: JSON.stringify({
        action: "translateText",
        text: chunk,
        sourceLanguage: "eng_Latn",
        targetLanguage,
      }),
    });

    const raw = await response.text();
    let parsed: {
      success?: boolean;
      translatedText?: string;
      error?: string;
      data?: {
        translatedText?: string;
      };
    } = {};
    try {
      parsed = JSON.parse(raw);
    } catch (jsonError) {
      logChatbotTranslationError_("Backend translation JSON parse failed", {
        jsonError,
        rawPreview: raw.slice(0, 160),
      });
      throw new Error("Translation service returned invalid JSON.");
    }

    if (!response.ok || parsed.success === false) {
      logChatbotTranslationError_("Backend translation response not OK", {
        status: response.status,
        parsed,
      });
      throw new Error(parsed.error || `Translation failed (${response.status}).`);
    }

    const translated = String(parsed.translatedText || parsed.data?.translatedText || "").trim();
    if (!translated) {
      logChatbotTranslationError_("Backend translation response missing translated text", {
        parsed,
      });
      throw new Error("Translation response did not include translated text.");
    }
    logChatbotTranslation_("Backend chunk translation success", {
      translatedLength: translated.length,
      preview: translated.slice(0, 80),
    });
    translatedChunks.push(translated);
  }

  const translatedMerged = translatedChunks.join("\n");
  logChatbotTranslation_("translateBotText_ success", {
    targetLanguage,
    outputLength: translatedMerged.length,
  });
  return unmaskOrgNamesForTranslation_(translatedMerged, masked.tokens);
}

// 📋 PROFILE KNOWLEDGE BASE: Answers for @profile command
const PROFILE_KNOWLEDGE_BASE = [
  {
    keywords: ["edit profile", "edit my profile"],
    answer: "✏️ **Edit Profile Mode**\n\nTo edit your profile, click the orange Edit button located above this chat bubble (bottom-right of screen).\n\nOnce in edit mode, you can modify:\n• Personal details (contact, birthday, gender)\n• Address information\n• Social media links\n• Emergency contacts\n\nClick 'Save Changes' when done!"
  },
  {
    keywords: ["my info", "my information", "my details", "show my", "what is my", "tell me my"],
    answer: "📋 **Your Profile Info**\n\nYour profile information is displayed on this page! Scroll to view:\n\n• **Personal Information** - Name, email, contact, birthday\n• **Identity** - ID code, civil status, religion, nationality\n• **Address** - Full address details\n• **YSP Information** - Chapter, committee, position, date joined\n• **Social Media** - Facebook, Instagram, Twitter\n• **Emergency Contact** - Contact person details\n• **Account** - Password settings\n\nTo edit any field, click the Edit button (bottom-right)."
  },
  {
    keywords: ["settings", "account settings", "preferences"],
    answer: "⚙️ **Profile Settings**\n\nOn this page you can manage:\n\n• **Change Password** - Scroll to Account section, click 'Change Password'\n• **Verify Email** - Add personal email and click 'Verify' button\n• **Update Contact Info** - Edit mode → change contact number\n• **Privacy** - Your profile is only visible to YSP members\n\nFor other app settings, use the sidebar menu."
  },
  {
    keywords: ["edit", "update", "change", "modify"],
    answer: "To edit your profile:\n1. Click the orange Edit button (above the chat, bottom-right)\n2. Make your changes in the editable fields\n3. Click 'Save Changes' when done\n\nYou can update: contact number, birthday, gender, pronouns, civil status, religion, address, and social media links."
  },
  {
    keywords: ["picture", "photo", "avatar", "image"],
    answer: "To change your profile picture:\n1. Click the Edit button to enter edit mode\n2. Click the camera icon on your profile photo\n3. Select an image (max 5MB, PNG/JPG/WebP)\n4. Click 'Save Changes' to upload\n\nThe image will be saved to the server when you save."
  },
  {
    keywords: ["password", "change password", "reset password"],
    answer: "To change your password:\n1. Scroll down to the 'Account' section\n2. Click 'Change Password' button\n3. Enter your current password for verification\n4. Enter and confirm your new password\n5. Click 'Change Password' to save\n\nPassword must be at least 8 characters."
  },
  {
    keywords: ["email", "verify", "verification", "otp"],
    answer: "To verify your personal email:\n1. Enter your personal email in the field\n2. Click the 'Verify' button next to it\n3. Check your inbox for the OTP code\n4. Enter the 6-digit code in the modal\n5. Once verified, you'll see a green checkmark\n\nVerification helps secure your account."
  },
  {
    keywords: ["save", "saving", "submit"],
    answer: "To save profile changes:\n1. Make sure you're in edit mode (orange buttons visible)\n2. Complete all your changes\n3. Click 'Save Changes' button (above chat bubble)\n4. Wait for the progress toast to complete\n\nNote: You must be in edit mode to save. Click 'Cancel' to discard changes."
  },
  {
    keywords: ["what", "which", "editable", "can i change", "allowed"],
    answer: "Editable profile fields:\n✏️ Personal: Contact number, Birthday, Gender, Pronouns\n✏️ Identity: Civil status, Religion\n✏️ Address: Full address, Barangay, City, Province, Zip code\n✏️ Social: Facebook, Instagram, Twitter\n✏️ Emergency: Contact name, relation, number\n\n🔒 Cannot edit: Full name, Username, ID Code, Chapter, Position, Role, Date joined"
  },
  {
    keywords: ["emergency", "contact", "emergency contact"],
    answer: "Emergency contact information:\n• Located in the 'Emergency Contact' section\n• Add a contact name, their relation to you, and phone number\n• This info is important for safety during YSP events\n• Make sure to keep this updated!"
  },
  {
    keywords: ["social", "facebook", "instagram", "twitter"],
    answer: "Social media links:\n• Found in the 'Social Media' section\n• Add your Facebook, Instagram, or Twitter profiles\n• Use full URLs (e.g., https://facebook.com/yourname)\n• These help other members connect with you"
  },
  {
    keywords: ["id", "code", "id code", "member id"],
    answer: "Your ID Code is a unique identifier assigned to you when you joined YSP. It cannot be changed as it's used for attendance tracking, records, and official documentation."
  },
  {
    keywords: ["status", "member status", "active", "inactive"],
    answer: "Member status is managed by administrators and reflects your current standing in YSP:\n• Active: Full participating member\n• Inactive: Temporarily not participating\n• Alumni: Former active member\n\nContact an admin if your status needs updating."
  },
  {
    keywords: ["name", "full name", "change name"],
    answer: "Your full name cannot be edited directly in the profile. If you need to update your name (e.g., due to legal name change), please contact an administrator or the developer."
  },
  {
    keywords: ["chapter", "committee", "position", "role"],
    answer: "Your YSP organizational details (chapter, committee, position, role) are managed by administrators. These reflect your official standing in the organization. Contact an admin if updates are needed."
  },
];

// Helper function to find profile answer
function findProfileAnswer(query: string): string | null {
  const lowerQuery = query.toLowerCase();
  for (const entry of PROFILE_KNOWLEDGE_BASE) {
    for (const keyword of entry.keywords) {
      if (lowerQuery.includes(keyword.toLowerCase())) {
        return entry.answer;
      }
    }
  }
  return null;
}

// 🆕 Helper function to generate a personalized introduction from real profile data
function generatePersonalIntroduction(profile: UserProfile): string {
  const name = profile.fullName || "Member";
  const position = profile.position || "";
  const committee = profile.committee || "";
  const chapter = profile.chapter || "YSP";
  const age = profile.age || 0;
  const gender = profile.gender || "";
  const pronouns = profile.pronouns || "";
  const city = profile.city || "";
  const province = profile.province || "";
  const dateJoined = profile.dateJoined || "";
  const status = profile.status || "";
  const membershipType = profile.membershipType || "";
  const civilStatus = profile.civilStatus || "";
  const nationality = profile.nationality || "";
  const religion = profile.religion || "";
  
  // Build location string
  let location = "";
  if (city && province) {
    location = `${city}, ${province}`;
  } else if (city || province) {
    location = city || province;
  }
  
  // Build greeting based on gender/pronouns
  const greeting = "👋 Allow me to introduce you!\n\n";
  
  // Main introduction
  let intro = `🌟 ${name}\n\n`;
  
  // Position and organization line
  if (position && committee) {
    intro += `You are the ${position} of the ${committee} in ${chapter}.\n\n`;
  } else if (position) {
    intro += `You serve as ${position} in ${chapter}.\n\n`;
  } else if (committee) {
    intro += `You're a proud member of the ${committee} in ${chapter}.\n\n`;
  } else {
    intro += `You're a valued member of ${chapter}.\n\n`;
  }
  
  // Personal details section
  let personalDetails = "About You:\n";
  const details: string[] = [];
  
  if (age > 0) {
    details.push(`• ${age} years old`);
  }
  if (gender) {
    details.push(`• ${gender}${pronouns ? ` (${pronouns})` : ""}`);
  }
  if (civilStatus) {
    details.push(`• ${civilStatus}`);
  }
  if (nationality) {
    details.push(`• ${nationality}`);
  }
  if (religion) {
    details.push(`• ${religion}`);
  }
  if (location) {
    details.push(`• From ${location}`);
  }
  
  if (details.length > 0) {
    personalDetails += details.join("\n") + "\n\n";
  } else {
    personalDetails = "";
  }
  
  // YSP Journey section
  let yspJourney = "Your YSP Journey:\n";
  const journeyDetails: string[] = [];
  
  if (dateJoined) {
    journeyDetails.push(`• Joined on ${dateJoined}`);
  }
  if (membershipType) {
    journeyDetails.push(`• ${membershipType} Member`);
  }
  if (status) {
    journeyDetails.push(`• Status: ${status}`);
  }
  
  if (journeyDetails.length > 0) {
    yspJourney += journeyDetails.join("\n") + "\n\n";
  } else {
    yspJourney = "";
  }
  
  // Inspirational closing
  const closings = [
    "Keep making a difference in your community! 🔥",
    "You're an integral part of the YSP family! 💛",
    "Thank you for your service to the youth! ⭐",
    "Together, we build a better nation! 🇵🇭",
    "Your dedication inspires others! ✨",
  ];
  const randomClosing = closings[Math.floor(Math.random() * closings.length)];
  
  return greeting + intro + personalDetails + yspJourney + randomClosing;
}

// 🗄️ EXTENSIVE LOCAL KNOWLEDGE BASE
// The bot checks this FIRST. If a match is found, it skips the API.
const LOCAL_KNOWLEDGE_BASE = [
  // --- LEADERSHIP & ABOUT ---
  {
    keywords: ["founder", "who created", "wacky", "father of ysp", "head"],
    answer: `The founder of ${ORG_LABEL} is Juanquine Carlo R. Castro, also known as 'Wacky Racho'.`
  },
  {
    keywords: ["chairman", "chapter president", "current leader"],
    answer: `The current Chapter President of ${ORG_LABEL} is Mr. Jhonas Untalan.`,
    lookup: "Jhonas Untalan"
  },
  {
    keywords: ["about ysp", "what is ysp", "history", "when started", "background"],
    answer: "Youth Service Philippines (YSP) is a non-stock, non-profit organization registered with the BIR and SEC. Started in 2016 by 10 high school students in Tagum City, we played a pivotal role in forming the LYDC and have since initiated 200+ projects across Luzon, Visayas, and Mindanao."
  },
  {
    keywords: ["mission", "goal", "purpose"],
    answer: "Our Mission: YSP empowers young leaders to drive sustainable community development, forging inclusive partnerships for positive transformative change."
  },
  {
    keywords: ["vision", "future", "dream"],
    answer: "Our Vision: YSP actively fosters civic engagement, collaboration, and capacity building to drive contextualized, community-led development initiatives through bridging leadership, co-creation, and the values of pakikipag-kapwa and damayan."
  },
  {
    keywords: ["developer", "ezequiel", "dev"],
    answer: `The developer of this Portal is Mr. Ezequiel John B. Crisostomo, the current Membership and Internal Affairs of ${ORG_LABEL}. You may contact him via facebook: https://www.facebook.com/ezequieljohn.bengilcrisostomo`,
    lookup: "Crisostomo, Ezequiel John B."
  },
  {
    keywords: ["partner", "sponsorship", "collaboration", "proposal"],
    answer: "For partnerships and proposals, please email us at: ysptagumchapter+partnerships@gmail.com"
  },
  {
    keywords: ["advocacy", "pillars", "core values", "focus", "what do you do"],
    answer: "YSP is guided by 4 Advocacy Pillars: 1) Global Citizenship and Governance, 2) Ecological and Livelihood Sustainability, 3) Learning and Development, and 4) Humanitarian Service."
  },
  {
    keywords: ["global citizenship", "governance", "pillar 1"],
    answer: "Pillar 1: Global Citizenship and Governance. We promote leadership skills and democratic values, encouraging active civic participation and informed decision-making."
  },
  {
    keywords: ["ecological", "livelihood", "sustainability", "environment", "agriculture", "pillar 2"],
    answer: "Pillar 2: Ecological and Livelihood Sustainability. We foster sustainable practices (like agriculture) that protect the environment while supporting local economies and stable livelihoods."
  },
  {
    keywords: ["learning", "education", "development", "pillar 3"],
    answer: "Pillar 3: Learning and Development. We focus on enhancing educational opportunities and personal growth to empower individuals for personal success and lifelong learning."
  },
  {
    keywords: ["humanitarian", "service", "disaster", "relief", "aid", "pillar 4"],
    answer: "Pillar 4: Humanitarian Service. We are dedicated to providing aid, supporting health programs, and assisting in disaster recovery to alleviate suffering and promote human dignity."
  },

  // --- CURRENT OFFICERS (2025-2026) ---
  {
    keywords: ["officers", "leaders", "team", "board", "council"],
    answer: `Current ${ORG_LABEL} Officers:\n• Chapter President: Jhonas Untalan\n• Membership and Internal Affairs Officer: Ezequiel John B. Crisostomo\n• External Relations Officer: Ian Ghabriel L. Navarro\n• Secretary and Documentation Officer: Yhana Bea Baliwan\n• Finance and Treasury Officer: Crystal Nice P. Tano\n• Communications and Marketing Officer: Russel T. Obreque\n• Program Development Officer: Valerie B. Cabualan`
  },
  {
    keywords: ["president", "chairman", "head of ysp"],
    answer: "The Chapter President is Jhonas Untalan.",
        lookup: "Jhonas Untalan"
  },
  {
    keywords: ["membership officer", "recruitment officer", "miao", "ezequiel", "eznh", "zeke", "internal affairs"],
    answer: "The Membership and Internal Affairs Officer is Ezequiel John B. Crisostomo.",
    lookup: "Crisostomo, Ezequiel John B."
  },
  {
    keywords: ["external relations", "partnerships officer", "liaison", "ian", "ghabriel"],
    answer: "The External Relations Officer is Ian Ghabriel L. Navarro.",
    lookup: "Navarro, Ian Ghabriel L."
  },
  {
    keywords: ["secretary", "scribe", "documentation"],
    answer: "The Secretary and Documentation Officer is Yhana Bea Baliwan.",
    lookup: "Yhana Bea Baliwan"
  },
  {
    keywords: ["finance", "treasurer", "budget"],
    answer: "The Finance and Treasury Officer is Crystal Nice P. Tano.",
    lookup: "Tano, Crystal Nice, P."
  },
  {
    keywords: ["communications", "marketing", "comms"],
    answer: "The Communications and Marketing Officer is Russel T. Obreque.",
    lookup: "Obreque, Russel T."
  },
  {
    keywords: ["program development", "program dev", "prog dev"],
    answer: "The Program Development Officer is Valerie B. Cabualan.",
    lookup: "Cabualan, Valerie B."
  },

  // --- COMMITTEES ---
  {
    keywords: ["external relations committee", "partnerships", "liaison"],
    answer: "The External Relations Committee is handled by Ian Ghabriel L. Navarro.",
    lookup: "Navarro, Ian Ghabriel L."
  },

  {
    keywords: ["Membership and Internal Affairs Committee"],
    answer: "The Membership and Internal Affairs Committee is handled by Ezequiel John B. Crisostomo.",
    lookup: "Crisostomo, Ezequiel John B."
  },
  {
    keywords: ["Secretariat and Documentation Committee"],
    answer: "The Secretariat and Documentation Committee is handled by Yhana Bea Baliwan.",
    lookup: "Yhana Bea Baliwan"
  },
  {
    keywords: ["Finance and Treasury Committee"],
    answer: "The Finance and Treasury Committee is handled by Crystal Nice P. Tano.",
    lookup: "Tano, Crystal Nice, P."
  },
  {
    keywords: ["Communications and Marketing Committee"],
    answer: "The Communications and Marketing Committee is handled by Russel T. Obreque.",
    lookup: "Obreque, Russel T."
  },
  {
    keywords: ["Project Development Committee"],
    answer: "The Project Development Committee is handled by Valerie B. Cabualan.",
    lookup: "Cabualan, Valerie B."
  },

  
  
  // --- MEMBERSHIP ---
  {
    keywords: ["how to join", "register", "sign up", "application", "requirements"],
    answer: "Membership is open for ALL youth in Tagum City. To join, click the 'Opportunities!' button on the home page."
  },
  {
    keywords: ["approval", "how long", "pending", "status"],
    answer: "Please note that approval for Membership Applications or Project Uploads typically takes weeks of deliberation by the committee."
  },
  {
    keywords: ["benefits", "why join", "advantage"],
    answer: "As a member, you become part of one of the leading youth organizations nationally, gain access to exclusive conferences, leadership training, and much more."
  },
  {
    keywords: ["renew", "renewal", "expire"],
    answer: "Yes, membership renewal occurs periodically to ensure active status within the organization."
  },
  {
    keywords: ["fee", "payment", "cost", "how much", "free"],
    answer: "There is no membership fee to join YSP. We are committed to keeping our organization accessible to all youth."
  },
  {
    keywords: ["id", "identification", "card"],
    answer: "Once you are an official member, you can generate your digital ID and QR code from the 'My QR' page of this app."
  },

  // --- APP FEATURES (Based on your file names) ---
  {
    keywords: ["qr code", "scan", "attendance"],
    answer: "For members, you can view your personal QR code in the 'My QR ID' page. This is used for scanning attendance at YSP events."
  },
  {
    keywords: ["download", "offline", "install"],
    answer: "This is a Progressive Web App (PWA). You can install it on your phone by tapping 'Add to Home Screen' in your browser settings for easier access."
  },
  {
    keywords: ["announcement", "news", "update"],
    answer: "Check the 'Announcements' tab on the dashboard for the latest news, upcoming events, and official memos."
  },
  {
    keywords: ["dark mode", "theme", "light mode"],
    answer: "You can toggle between Dark Mode and Light Mode in the Settings page (look for the gear icon)."
  },

  // --- TROUBLESHOOTING ---
  {
    keywords: ["portal issue", "bug", "error", "glitch", "website problem"],
    answer: "For portal issues, please email: ysptagumchapter+portal@gmail.com"
  },
  {
    keywords: ["forgot password", "reset password", "cant login", "login issue"],
    answer: "If you forgot your password, please contact the system administrator or use the 'Forgot Password' link on the login screen to request a reset."
  },
  {
    keywords: ["bug", "error", "not working", "glitch"],
    answer: "If you encounter a bug, please take a screenshot and report it to the technical team or use the 'Feedback' feature in the settings."
  },
  {
    keywords: ["contact", "email", "phone", "support"],
    answer: "You can contact us via email at YSPTagumChapter@gmail.com or message our official Facebook page."
  },
  {
    keywords: ["slow", "loading"],
    answer: "The app might be slow due to your internet connection. Try refreshing the page or checking your Wi-Fi/Data signal."
  }
];

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const MONTH_ALIASES: Record<string, number> = {
  jan: 0,
  january: 0,
  feb: 1,
  february: 1,
  mar: 2,
  march: 2,
  apr: 3,
  april: 3,
  may: 4,
  jun: 5,
  june: 5,
  jul: 6,
  july: 6,
  aug: 7,
  august: 7,
  sep: 8,
  sept: 8,
  september: 8,
  oct: 9,
  october: 9,
  nov: 10,
  november: 10,
  dec: 11,
  december: 11,
};

const ORG_QUERY_BLOCKLIST = ["ysp", "chapter", "organization", "portal", "developer", "founder"];
const GENERIC_DIRECTORY_TARGETS = [
  "officer",
  "officers",
  "member",
  "members",
  "executive board",
  "board",
  "committee",
  "team",
];

const CLARIFYING_FALLBACK =
  "I want to make sure I understand. Can you clarify your question or share more details?";

function buildErrorMessage(code?: string | number): string {
  const errorCode = code ? String(code) : "500";
  return `Service temporarily unavailable (code ${errorCode}). Please try again in a moment.`;
}

function isExecutiveBoardQuery(query: string): boolean {
  return (
    /\bexecutive board\b/.test(query) ||
    /\bexecutive committee\b/.test(query) ||
    /\borg chart\b/.test(query) ||
    /\borganizational chart\b/.test(query) ||
    /\borganization chart\b/.test(query)
  );
}

function isProjectsQuery(query: string): boolean {
  const hasProjects = /\bprojects\b/.test(query);
  const hasProjectImplemented =
    /\bproject\b/.test(query) &&
    /\bimplemented|implementation|accomplished|completed|done\b/.test(query);
  return hasProjects || hasProjectImplemented;
}

function parseRelativeMonth(query: string): { monthIndex: number; year: number; label: string } | null {
  const now = new Date();
  if (/\bthis month\b/.test(query)) {
    return {
      monthIndex: now.getMonth(),
      year: now.getFullYear(),
      label: "this month",
    };
  }
  if (/\bnext month\b/.test(query)) {
    const next = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    return {
      monthIndex: next.getMonth(),
      year: next.getFullYear(),
      label: "next month",
    };
  }
  if (/\blast month\b/.test(query)) {
    const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    return {
      monthIndex: prev.getMonth(),
      year: prev.getFullYear(),
      label: "last month",
    };
  }
  return null;
}

function extractMonthQuery(query: string): { monthIndex: number; year?: number } | null {
  const monthRegex = new RegExp(`\\b(${Object.keys(MONTH_ALIASES).join("|")})\\b`, "i");
  const match = query.match(monthRegex);
  if (!match) return null;
  const monthIndex = MONTH_ALIASES[match[1].toLowerCase()];
  if (monthIndex === undefined) return null;
  const yearMatch = query.match(/\b(20\d{2}|19\d{2})\b/);
  const year = yearMatch ? parseInt(yearMatch[1], 10) : undefined;
  return { monthIndex, year };
}

function parseEventQuery(
  query: string
): { monthIndex?: number; year?: number; label: string; needsClarification?: boolean } | null {
  const hasEventKeyword = /\b(event|events|activity|activities|schedule|scheduled|calendar)\b/.test(query);
  if (!hasEventKeyword) return null;

  const relative = parseRelativeMonth(query);
  if (relative) {
    return {
      monthIndex: relative.monthIndex,
      year: relative.year,
      label: relative.label,
    };
  }

  const monthMatch = extractMonthQuery(query);
  if (monthMatch) {
    const monthLabel = MONTH_NAMES[monthMatch.monthIndex];
    const label = monthMatch.year ? `${monthLabel} ${monthMatch.year}` : monthLabel;
    return { monthIndex: monthMatch.monthIndex, year: monthMatch.year, label };
  }

  return { label: "a specific month", needsClarification: true };
}

function isDirectoryIntent(query: string): boolean {
  if (ORG_QUERY_BLOCKLIST.some((term) => query.includes(term))) {
    return false;
  }
  return /\b(info|information|contact|details|profile|directory|email|phone|id code|birthdate|birthday|age|gender|sex|status|position|committee|role|nationality|religion)\b/.test(query);
}

function extractDirectoryTarget(text: string): string | null {
  const patterns = [
    /\b(?:info|information)\s+(?:about|of)?\s*(.+)/i,
    /\b(?:contact|details|profile)\s+(?:for|of)?\s*(.+)/i,
    /\bwhen\s+is\s+(.+?)\s+birth(?:day|date)\b/i,
    /\bdirectory\s+(?:lookup|for|of)?\s*(.+)/i,
    /\bsearch\s+(?:for\s+)?(?:officer|member|person)?\s*(.+)/i,
    /\bfind\s+(?:officer|member|person)?\s*(.+)/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      const candidate = match[1].trim();
      if (candidate) return candidate;
    }
  }

  return null;
}

function isGenericDirectoryTarget(target: string): boolean {
  const normalized = target.toLowerCase();
  return GENERIC_DIRECTORY_TARGETS.some(
    (term) => normalized === term || normalized === `the ${term}`
  );
}

function normalizeDirectoryTarget(target: string): string {
  return target
    .replace(/\b(surname|last name|lastname|first name|firstname|middle name|middlename)\b/gi, " ")
    .replace(/\b(mr|mrs|ms|miss|sir|maam|madam|dr|engr|atty|prof)\b\.?/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractRequestedDirectoryField(query: string): string | null {
  const fieldMap: Array<{ key: string; pattern: RegExp }> = [
    { key: "email", pattern: /\b(email|email address)\b/ },
    { key: "contactNumber", pattern: /\b(contact|contact number|phone|mobile|tel)\b/ },
    { key: "birthday", pattern: /\b(birthdate|birthday|date of birth)\b/ },
    { key: "age", pattern: /\b(age)\b/ },
    { key: "committee", pattern: /\b(committee)\b/ },
    { key: "position", pattern: /\b(position|title)\b/ },
    { key: "role", pattern: /\b(role)\b/ },
    { key: "status", pattern: /\b(status)\b/ },
    { key: "idCode", pattern: /\b(id code|id)\b/ },
    { key: "gender", pattern: /\b(gender|sex)\b/ },
    { key: "nationality", pattern: /\b(nationality)\b/ },
    { key: "religion", pattern: /\b(religion)\b/ },
  ];

  for (const entry of fieldMap) {
    if (entry.pattern.test(query)) return entry.key;
  }
  return null;
}

function getDirectoryFieldValue(
  officer: DirectoryOfficer,
  fieldKey: string
): { label: string; value?: string | number } {
  const label = fieldKey.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase());
  const formatBirthday = (raw?: string) => {
    if (!raw) return undefined;
    const date = new Date(raw);
    if (Number.isNaN(date.getTime())) return raw;
    const formatted = date.toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });
    return `${raw} (${formatted})`;
  };
  const valueMap: Record<string, string | number | undefined> = {
    email: officer.email,
    contactNumber: officer.contactNumber,
    birthday: formatBirthday(officer.birthday),
    age: officer.age,
    committee: officer.committee,
    position: officer.position,
    role: officer.role,
    status: officer.status,
    idCode: officer.idCode,
    gender: officer.gender,
    nationality: officer.nationality,
    religion: officer.religion,
    chapter: officer.chapter,
  };
  return { label, value: valueMap[fieldKey] };
}

function parseGenderFilter(query: string): "female" | "male" | null {
  if (/\b(female|females|women|woman|girls)\b/.test(query)) return "female";
  if (/\b(male|males|men|man|boys)\b/.test(query)) return "male";
  return null;
}

function normalizeGenderValue(value: string): "female" | "male" | null {
  const normalized = String(value || "").toLowerCase().trim();
  if (!normalized) return null;
  if (normalized === "f") return "female";
  if (normalized === "m") return "male";
  if (
    normalized.includes("female") ||
    normalized === "woman" ||
    normalized === "women" ||
    normalized === "girl" ||
    normalized === "girls" ||
    normalized.includes("feminine")
  ) {
    return "female";
  }
  if (
    normalized.includes("male") ||
    normalized === "man" ||
    normalized === "men" ||
    normalized === "boy" ||
    normalized === "boys" ||
    normalized.includes("masculine")
  ) {
    return "male";
  }
  return null;
}

function matchesGenderFilter(value: string, target: "female" | "male"): boolean {
  return normalizeGenderValue(value) === target;
}

function normalizeKnowledgeSource(value: unknown): KnowledgeSource | null {
  const raw = String(value || "").toLowerCase().trim();
  if (raw === "database") return "database";
  if (raw === "mixed") return "mixed";
  if (raw === "gemini") return "gemini";
  return null;
}

function getBotMessageGlowStyle(source: KnowledgeSource, isDark?: boolean): React.CSSProperties {
  if (source === "gemini") {
    return {
      border: "1px solid rgba(239, 68, 68, 0.45)",
      boxShadow: isDark
        ? "0 0 14px rgba(239, 68, 68, 0.35), 0 0 4px rgba(239, 68, 68, 0.5)"
        : "0 0 12px rgba(239, 68, 68, 0.2), 0 0 3px rgba(239, 68, 68, 0.35)",
    };
  }
  if (source === "mixed") {
    return {
      border: "1px solid rgba(168, 85, 247, 0.45)",
      boxShadow: isDark
        ? "0 0 14px rgba(168, 85, 247, 0.35), 0 0 4px rgba(250, 204, 21, 0.3)"
        : "0 0 12px rgba(168, 85, 247, 0.2), 0 0 3px rgba(250, 204, 21, 0.22)",
    };
  }
  return {
    border: "1px solid rgba(250, 204, 21, 0.5)",
    boxShadow: isDark
      ? "0 0 14px rgba(250, 204, 21, 0.3), 0 0 4px rgba(250, 204, 21, 0.42)"
      : "0 0 12px rgba(250, 204, 21, 0.18), 0 0 3px rgba(250, 204, 21, 0.28)",
  };
}

function sanitizeBotText(text: string): string {
  return String(text || "")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/__(.*?)__/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\*\*/g, "")
    .replace(/__/g, "");
}

function isCountQuery(query: string): boolean {
  return /\b(how many|count|number of|total)\b/.test(query);
}

function parseBirthdayMonthQuery(query: string): { monthIndex: number; label: string } | null {
  const relative = parseRelativeMonth(query);
  if (relative) {
    return { monthIndex: relative.monthIndex, label: relative.label };
  }
  const monthMatch = extractMonthQuery(query);
  if (!monthMatch) return null;
  const monthLabel = MONTH_NAMES[monthMatch.monthIndex];
  const label = monthMatch.year ? `${monthLabel} ${monthMatch.year}` : monthLabel;
  return { monthIndex: monthMatch.monthIndex, label };
}

function isUnverifiedEmailQuery(query: string): boolean {
  return (
    /\b(unverified|not verified|unverified email|email not verified|email unverified)\b/.test(query) ||
    /\b(not|does not|doesn't|dont|do not)\b.*\b(email|emails)\b.*\b(verified|verify)\b/.test(query)
  );
}

function parseDirectoryAnalyticsQuery(query: string): {
  type: "gender" | "birthdays" | "unverifiedEmail";
  gender?: "female" | "male";
  monthIndex?: number;
  label?: string;
} | null {
  const gender = parseGenderFilter(query);
  if (gender && (/\b(officer|officers|members|people)\b/.test(query) || isCountQuery(query))) {
    return { type: "gender", gender };
  }

  if (/\b(birthday|birthdays|born)\b/.test(query)) {
    const month = parseBirthdayMonthQuery(query);
    if (month) {
      return { type: "birthdays", monthIndex: month.monthIndex, label: month.label };
    }
  }

  if (isUnverifiedEmailQuery(query)) {
    return { type: "unverifiedEmail" };
  }

  return null;
}

function parseDirectoryRoleScope(query: string): "members" | "officers" | "all" {
  if (/\bmember|members\b/.test(query)) return "members";
  if (/\bofficer|officers\b/.test(query)) return "officers";
  return "all";
}

function extractScopeFilters(query: string, officers: DirectoryOfficer[]): {
  committee?: string;
  role?: string;
  position?: string;
  isExecutiveBoard?: boolean;
} {
  const normalizedQuery = normalizeDirectoryTarget(query).toLowerCase();
  const committeeSet = new Set<string>();
  const roleSet = new Set<string>();
  const positionSet = new Set<string>();

  officers.forEach((officer) => {
    if (officer.committee) committeeSet.add(officer.committee.toLowerCase());
    if (officer.role) roleSet.add(officer.role.toLowerCase());
    if (officer.position) positionSet.add(officer.position.toLowerCase());
  });

  const committeeMatch = Array.from(committeeSet).find((committee) =>
    normalizedQuery.includes(committee)
  );
  const roleMatch = Array.from(roleSet).find((role) => normalizedQuery.includes(role));
  const positionMatch = Array.from(positionSet).find((position) =>
    normalizedQuery.includes(position)
  );
  const isExecutiveBoard = /\bexecutive board\b/.test(normalizedQuery);

  return {
    committee: committeeMatch,
    role: roleMatch,
    position: positionMatch,
    isExecutiveBoard,
  };
}

function stripMembersCommandPrefix(text: string): string {
  return text.replace(/^@members\b[:\s]*/i, "").trim();
}

function extractPossessiveTarget(text: string): string | null {
  const match = text.match(/([A-Za-z][A-Za-z\s.'-]+?)(?:'s|s')\b/i);
  if (match && match[1]) return match[1].trim();
  const plainMatch = text.match(/\b([A-Za-z][A-Za-z\s.-]+?)s\b\s+birth(?:day|date)\b/i);
  if (plainMatch && plainMatch[1]) return plainMatch[1].trim();
  return null;
}

function extractMembersCommandTarget(text: string): string | null {
  const whoMatch = text.match(/\bwho(?:'s| is)\s+(.+)/i);
  if (whoMatch && whoMatch[1]) {
    return whoMatch[1].trim();
  }

  const birthdayMatch = text.match(/\bwhen\s+is\s+(.+?)\s+birth(?:day|date)\b/i);
  if (birthdayMatch && birthdayMatch[1]) {
    return birthdayMatch[1].trim();
  }

  const possessive = extractPossessiveTarget(text);
  if (possessive) return possessive;

  const infoMatch =
    extractDirectoryTarget(text) ||
    (text.match(/\b(?:find|search for|search)\s+(.+)/i)?.[1] || "").trim();
  return infoMatch || null;
}

function extractMembersTargets(text: string): string[] {
  const target = extractMembersCommandTarget(text);
  if (!target) return [];
  return target
    .split(/\s+and\s+|,/i)
    .map((item) => item.trim())
    .filter(Boolean);
}

function formatOfficerSummary(officer: DirectoryOfficer): string {
  const lines: string[] = [];
  const addLine = (label: string, value?: string | number) => {
    const cleaned = value !== undefined && value !== null ? String(value).trim() : "";
    lines.push(`${label}: ${cleaned || "N/A"}`);
  };

  addLine("Full Name", officer.fullName);
  addLine("Age", officer.age ? `${officer.age}` : "");
  addLine("Contacts", officer.contactNumber);
  addLine("Email", officer.email);
  addLine("ID Code", officer.idCode);
  addLine("Position", officer.position);
  addLine("Chapter", officer.chapter);
  addLine("Committee", officer.committee);
  addLine("Profile Picture", officer.profilePicture ? "Shown above" : "Not available");

  return lines.join("\n");
}

function isOfficerEmailVerified(officer: DirectoryOfficer): boolean {
  if (officer.emailVerified) {
    if (officer.verifiedEmail && officer.email) {
      return officer.verifiedEmail.toLowerCase() === officer.email.toLowerCase();
    }
    return true;
  }
  return false;
}

function isFullDirectoryReply(text: string): boolean {
  return /\b(yes|y|yeah|yep|sure|ok|okay|full|show full|open|go ahead|please)\b/i.test(text.trim());
}

const YSPChatBot: React.FC<YSPChatBotProps> = ({
  userRole = "guest",
  orgChartUrl = "",
  onOfficerDirectorySearch,
  onRequestCacheClear,
  currentPage = "",
  hidden = false,
  onTriggerEditMode,
  attendanceDashboardContext,
  isDark = false,
}) => {
  const [mounted, setMounted] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { id: 1, text: "Hello! I'm the YSP Assistant. How can I help you?", sender: "bot" },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0); // Display number
  const [pendingProjectSummary, setPendingProjectSummary] = useState<Project[] | null>(null);
  const [isProjectDetailsPending, setIsProjectDetailsPending] = useState(false);
  const [pendingDirectoryLookup, setPendingDirectoryLookup] = useState<{
    query: string;
    idCode?: string;
  } | null>(null);
  const [isDirectoryDetailsPending, setIsDirectoryDetailsPending] = useState(false);
  const [lastDirectoryOfficer, setLastDirectoryOfficer] = useState<DirectoryOfficer | null>(null);
  const [membersCommandActive, setMembersCommandActive] = useState(false);
  const [fullImageUrl, setFullImageUrl] = useState<string | null>(null);
  const [, setLastKnowledgeSource] = useState<KnowledgeSource>("database");
  const [chatMode, setChatMode] = useState<ChatMode>("llm");
  const [chatTargetLanguage, setChatTargetLanguage] = useState<string>(loadChatbotTranslationLanguage_);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const directoryAnalyticsCacheRef = useRef<{ timestamp: number; officers: DirectoryOfficer[] } | null>(null);
  const cooldownEndRef = useRef<number>(0); // 👈 Tracks real time
  const translatedMessageKeysRef = useRef<Set<string>>(new Set());
  const translatingMessageIdsRef = useRef<Set<number>>(new Set());
  const previousTargetLanguageRef = useRef<string>(chatTargetLanguage);

  // 📊 ATTENDANCE DASHBOARD KNOWLEDGE BASE
  const generateAttendanceContextResponse = (query: string): string | null => {
    if (!attendanceDashboardContext) return null;
    
    const lowerQuery = query.toLowerCase();
    const ctx = attendanceDashboardContext;
    const stats = ctx.statistics;
    
    // Check if asking about attendance stats
    if (/\b(attendance|statistics|stats|summary|overview|how many|count|total)\b/.test(lowerQuery)) {
      // Overall attendance summary
      if (/\b(overall|summary|total|all|how is|statistics|stats)\b/.test(lowerQuery)) {
        const eventNames = ctx.eventDetails.map(e => e.title).join(', ');
        return `📊 **Attendance Dashboard Summary**\n\n` +
          `**Selection:** ${ctx.mode === 'single' ? '1 event' : ctx.mode === 'all' ? 'All events' : `${ctx.selectedEvents.length} events`}\n` +
          `${ctx.eventDetails.length === 1 ? `**Event:** ${ctx.eventDetails[0].title}` : `**Events:** ${eventNames}`}\n\n` +
          `**Statistics:**\n` +
          `• ✅ Present: ${stats.present}\n` +
          `• ⏰ Late: ${stats.late}\n` +
          `• 📋 Excused: ${stats.excused}\n` +
          `• ❌ Absent: ${stats.absent}\n` +
          `• ❓ Not Recorded: ${stats.notRecorded}\n\n` +
          `**Attendance Rate:** ${stats.attendanceRate}%\n` +
          `**Total Records:** ${stats.totalRecords}\n\n` +
          `💡 Recommended chart: **${ctx.recommendedChartType}** chart`;
      }
      
      // Present count
      if (/\b(present|on time|attended)\b/.test(lowerQuery)) {
        return `✅ **Present Members**\n\n` +
          `There are **${stats.present}** members marked as Present.\n\n` +
          `This represents ${stats.totalRecords > 0 ? Math.round((stats.present / stats.totalRecords) * 100) : 0}% of all recorded attendance.`;
      }
      
      // Late count
      if (/\b(late|tardy)\b/.test(lowerQuery)) {
        return `⏰ **Late Members**\n\n` +
          `There are **${stats.late}** members marked as Late.\n\n` +
          `This represents ${stats.totalRecords > 0 ? Math.round((stats.late / stats.totalRecords) * 100) : 0}% of all recorded attendance.`;
      }
      
      // Excused count
      if (/\b(excused|excuse)\b/.test(lowerQuery)) {
        return `📋 **Excused Members**\n\n` +
          `There are **${stats.excused}** members marked as Excused.\n\n` +
          `This represents ${stats.totalRecords > 0 ? Math.round((stats.excused / stats.totalRecords) * 100) : 0}% of all recorded attendance.`;
      }
      
      // Absent count
      if (/\b(absent|missing|didn't attend|did not attend)\b/.test(lowerQuery)) {
        return `❌ **Absent Members**\n\n` +
          `There are **${stats.absent}** members marked as Absent.\n\n` +
          `This represents ${stats.totalRecords > 0 ? Math.round((stats.absent / stats.totalRecords) * 100) : 0}% of all recorded attendance.`;
      }
      
      // Not recorded count
      if (/\b(not recorded|unrecorded|no record|missing record)\b/.test(lowerQuery)) {
        return `❓ **Not Recorded Members**\n\n` +
          `There are **${stats.notRecorded}** members in the member list who have no attendance record.\n\n` +
          `These members may not have attended or their attendance wasn't captured in the system.`;
      }
      
      // Attendance rate
      if (/\b(rate|percentage|percent)\b/.test(lowerQuery)) {
        return `📈 **Attendance Rate**\n\n` +
          `The current attendance rate is **${stats.attendanceRate}%**.\n\n` +
          `This is calculated based on members who were Present or Late (${stats.present + stats.late}) out of total members.`;
      }
    }
    
    // Check if asking about events
    if (/\b(event|events|which event|what event|current event)\b/.test(lowerQuery)) {
      if (ctx.eventDetails.length === 0) {
        return "No events are currently selected in the Attendance Dashboard. Select an event to see its statistics.";
      }
      
      if (ctx.eventDetails.length === 1) {
        const e = ctx.eventDetails[0];
        return `📅 **Current Event**\n\n` +
          `**${e.title}**\n` +
          `• Date: ${e.date}\n` +
          `• Status: ${e.status}\n\n` +
          `**Attendance Breakdown:**\n` +
          `• ✅ Present: ${e.present}\n` +
          `• ⏰ Late: ${e.late}\n` +
          `• 📋 Excused: ${e.excused}\n` +
          `• ❌ Absent: ${e.absent}`;
      }
      
      // Multiple events
      let response = `📅 **Selected Events (${ctx.eventDetails.length})**\n\n`;
      ctx.eventDetails.forEach((e, i) => {
        response += `**${i + 1}. ${e.title}**\n`;
        response += `   Date: ${e.date} | Status: ${e.status}\n`;
        response += `   ✅ ${e.present} | ⏰ ${e.late} | 📋 ${e.excused} | ❌ ${e.absent}\n\n`;
      });
      return response;
    }
    
    // Check if asking about chart recommendation
    if (/\b(chart|graph|recommend|best|which chart|what chart)\b/.test(lowerQuery)) {
      const chartDescriptions: Record<string, string> = {
        'pie': 'shows overall status distribution as a circle',
        'donut': 'shows distribution with a hollow center for emphasis',
        'column': 'compares status counts vertically - great for single events',
        'bar': 'compares across committees or events horizontally',
        'line': 'shows trends across multiple events over time',
      };
      
      return `📊 **Chart Recommendation**\n\n` +
        `Based on your current selection (${ctx.selectedEvents.length} event${ctx.selectedEvents.length !== 1 ? 's' : ''}), ` +
        `I recommend using a **${ctx.recommendedChartType}** chart.\n\n` +
        `This chart ${chartDescriptions[ctx.recommendedChartType] || 'works well for your data'}.\n\n` +
        `**Available Charts:**\n` +
        Object.entries(chartDescriptions).map(([name, desc]) => 
          `• **${name.charAt(0).toUpperCase() + name.slice(1)}**: ${desc}`
        ).join('\n');
    }
    
    return null;
  };

  // ⏱️ ROBUST TIMER: Uses Date.now() so it never gets stuck
  useEffect(() => {
    if (cooldown === 0) return;

    const interval = window.setInterval(() => {
      const now = Date.now();
      const remaining = Math.ceil((cooldownEndRef.current - now) / 1000);

      if (remaining <= 0) {
        setCooldown(0);
        window.clearInterval(interval);
      } else {
        setCooldown(remaining);
      }
    }, 500); // Check twice a second for smoothness

    return () => window.clearInterval(interval);
  }, [cooldown]);

  useEffect(() => setMounted(true), []);

  // Auto-scroll to bottom
  useEffect(() => {
    if (!isOpen) return;
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isOpen]);

  // Auto-focus input when opening
  useEffect(() => {
    if (isOpen) {
      const t = setTimeout(() => inputRef.current?.focus(), 50);
      return () => clearTimeout(t);
    }
  }, [isOpen]);

  useEffect(() => {
    if (previousTargetLanguageRef.current === chatTargetLanguage) return;
    previousTargetLanguageRef.current = chatTargetLanguage;
    translatedMessageKeysRef.current = new Set();
    translatingMessageIdsRef.current.clear();

    if (chatTargetLanguage === CHATBOT_TRANSLATION_DEFAULT_LANGUAGE) {
      setMessages((prev) =>
        prev.map((message) =>
          message.sender === "bot" && message.originalText
            ? { ...message, text: message.originalText }
            : message
        )
      );
    }
  }, [chatTargetLanguage]);

  useEffect(() => {
    if (chatTargetLanguage === CHATBOT_TRANSLATION_DEFAULT_LANGUAGE) return;

    const candidate = messages.find((message) => {
      if (message.sender !== "bot") return false;
      const sourceText = String(message.originalText || message.text || "").trim();
      if (!sourceText) return false;
      const cacheKey = `${chatTargetLanguage}:${message.id}`;
      if (translatedMessageKeysRef.current.has(cacheKey)) return false;
      if (translatingMessageIdsRef.current.has(message.id)) return false;
      return true;
    });

    if (!candidate) return;

    const cacheKey = `${chatTargetLanguage}:${candidate.id}`;
    const sourceText = candidate.originalText || candidate.text;
    translatingMessageIdsRef.current.add(candidate.id);

    void translateBotText_(sourceText, chatTargetLanguage)
      .then((translated) => {
        translatedMessageKeysRef.current.add(cacheKey);
        setMessages((prev) =>
          prev.map((message) => {
            if (message.id !== candidate.id) return message;
            if (message.sender !== "bot") return message;

            const baseText = message.originalText || sourceText;
            const nextText = translated && translated.trim() ? translated : baseText;
            return {
              ...message,
              originalText: baseText,
              text: nextText,
            };
          })
        );
      })
      .catch(() => {
        translatedMessageKeysRef.current.add(cacheKey);
      })
      .finally(() => {
        translatingMessageIdsRef.current.delete(candidate.id);
      });
  }, [messages, chatTargetLanguage]);

  // 🔍 Helper: Check Local DB with Smart Matching (Best Match & Word Boundaries)
  const findLocalAnswer = (query: string): KBEntry | null => {
    const lowerQuery = query.toLowerCase();
    let bestMatch: KBEntry | null = null;
    let maxMatchLength = 0;

    for (const entry of LOCAL_KNOWLEDGE_BASE) {
      for (const keyword of entry.keywords) {
        const lowerKeyword = keyword.toLowerCase();
        
        // 1. Use Regex for "Whole Word" matching
        // This prevents "id" from triggering when someone types "president" or "valid"
        const escapedKeyword = lowerKeyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`\\b${escapedKeyword}\\b`, 'i');

        if (regex.test(lowerQuery)) {
          // 2. Score by Length: The longest matched keyword wins
          // Example: "Membership Officer" (longer) will overwrite "Officer" (shorter)
          if (lowerKeyword.length > maxMatchLength) {
            maxMatchLength = lowerKeyword.length;
            bestMatch = entry;
          }
        }
      }
    }
    return bestMatch;
  };

  const parseProjectSelection = (text: string, projects: Project[]) => {
    const trimmed = text.trim().toLowerCase();
    if (!trimmed) return null;

    if (trimmed === "all" || trimmed === "show all" || trimmed === "all projects") {
      return projects;
    }

    const ordinalWordMap: Record<string, number> = {
      first: 1,
      second: 2,
      third: 3,
      fourth: 4,
      fifth: 5,
      sixth: 6,
      seventh: 7,
      eighth: 8,
      ninth: 9,
      tenth: 10,
      eleventh: 11,
      twelfth: 12,
    };

    const ordinalWord = Object.keys(ordinalWordMap).find((word) => trimmed.includes(word));
    if (ordinalWord) {
      const ordinalIndex = ordinalWordMap[ordinalWord] - 1;
      if (ordinalIndex >= 0 && ordinalIndex < projects.length) {
        return [projects[ordinalIndex]];
      }
    }

    const ordinalMatch = trimmed.match(/\b(\d+)(st|nd|rd|th)\b/);
    if (ordinalMatch) {
      const ordinalIndex = parseInt(ordinalMatch[1], 10) - 1;
      if (ordinalIndex >= 0 && ordinalIndex < projects.length) {
        return [projects[ordinalIndex]];
      }
    }

    const indexMatch = trimmed.match(/\b(\d+)\b/);
    if (indexMatch) {
      const index = parseInt(indexMatch[1], 10) - 1;
      if (index >= 0 && index < projects.length) {
        return [projects[index]];
      }
    }

    const matchedByTitle = projects.filter((project) =>
      project.title.toLowerCase().includes(trimmed)
    );
    if (matchedByTitle.length > 0) {
      return matchedByTitle;
    }

    return null;
  };

  const getCachedSearchResults = (query: string): DirectoryOfficer[] | null => {
    const key = `ysp_directory_cache_search_${query.toLowerCase().trim()}`;
    const storages = [sessionStorage, localStorage];

    for (const storage of storages) {
      try {
        const raw = storage.getItem(key);
        if (!raw) continue;
        const parsed = JSON.parse(raw) as { data?: { officers?: DirectoryOfficer[] } };
        if (parsed.data?.officers) {
          return parsed.data.officers;
        }
      } catch {
        // Ignore cache errors
      }
    }

    return null;
  };

  const searchDirectoryWithCache = async (query: string) => {
    const cached = getCachedSearchResults(query);
    if (cached) {
      return { success: true, officers: cached, total: cached.length };
    }
    return searchOfficers(query);
  };

  const buildHelpMessage = (pageValue: string, roleValue: string, loggedIn: boolean): string => {
    const page = pageValue.toLowerCase().trim();
    const role = roleValue.toLowerCase().trim();
    const isPrivileged = role === "auditor" || role === "admin";
    const lines: string[] = [];

    lines.push("Available commands for this page:");
    lines.push("- /help: Show available commands for the current page");
    lines.push("- /mode llm: LLM-first chat mode");
    lines.push("- /mode assistant: Rule/feature-first assistant mode");
    lines.push("- /translate [language]: Translate bot replies (ex: /translate japanese)");
    lines.push("- /translate off: Disable chatbot translation");
    lines.push("- @clear chat history: Reset chat conversation");

    if (loggedIn && (page === "my-profile" || page === "profile")) {
      lines.push("- @profile [question]: Profile help and guidance");
      lines.push("- @profile who am I");
      lines.push("- @profile introduce me");
      lines.push("- @profile edit profile");
      lines.push("- @profile verify email");
    }

    if (loggedIn && (page === "officer-directory" || page === "manage-members")) {
      if (isPrivileged) {
        lines.push("- @members [query]: Search members and analytics");
        lines.push("- /@members: Enable members mode");
        lines.push("- /@members off: Disable members mode");
        lines.push("- @members who is [name]");
        lines.push("- @members how many members are females");
      } else {
        lines.push("- @members is available for auditors/admins only");
      }
    }

    if (loggedIn && page.indexOf("system") !== -1) {
      lines.push("- @system clear cache");
      lines.push("- @system hard refresh");
      if (isPrivileged) {
        lines.push("- @review unknowns");
      }
    }

    if (page === "attendance-dashboard" || page === "attendancedashboard") {
      lines.push("- Ask attendance questions (summary, present/late/absent, rate)");
    }

    if (!loggedIn) {
      lines.push("Login required for protected commands like @profile, @members, @system, and @review unknowns.");
    }

    return lines.join("\n");
  };

  const loadAllOfficersForAnalytics = async (): Promise<DirectoryOfficer[]> => {
    const cache = directoryAnalyticsCacheRef.current;
    const cacheMs = 2 * 60 * 1000;
    if (cache && Date.now() - cache.timestamp < cacheMs) {
      return cache.officers;
    }

    const officers: DirectoryOfficer[] = [];
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      const response = await getAllOfficers(page, 100);
      if (!response.success || !response.officers) {
        throw new Error(response.error || "Failed to fetch officer list.");
      }
      officers.push(...response.officers);
      hasMore = Boolean(response.pagination?.hasMore);
      page += 1;
    }

    directoryAnalyticsCacheRef.current = { timestamp: Date.now(), officers };
    return officers;
  };

  // Reusable function to handle sending messages
  const handleSend = async (text: string) => {
    if (!text.trim() || isLoading || cooldown > 0) return;

    const COOLDOWN_SECONDS = 10;
    cooldownEndRef.current = Date.now() + (COOLDOWN_SECONDS * 1000);
    setCooldown(COOLDOWN_SECONDS);

    const userMsg: Message = { id: Date.now(), text, sender: "user" };
    setMessages((prev) => [...prev, userMsg]);
    setIsLoading(true);

    let workingText = text.trim();
    let normalized = workingText.toLowerCase();
    const role = userRole.toLowerCase();
    const isPrivileged = role === "auditor" || role === "admin";
    const pageKey = currentPage.toLowerCase();
    const isLoggedIn = Boolean(getStoredUser()?.username);
    const shouldUseAssistantHeuristics = chatMode === "assistant";
    const isMembersCommandAllowed =
      pageKey === "officer-directory" || pageKey === "manage-members";

    const maybeTranslateBotText_ = async (sourceText: string): Promise<{ text: string; originalText?: string }> => {
      const normalizedSource = String(sourceText || "");
      if (!normalizedSource.trim()) return { text: normalizedSource };
      if (chatTargetLanguage === CHATBOT_TRANSLATION_DEFAULT_LANGUAGE) return { text: normalizedSource };

      logChatbotTranslation_("maybeTranslateBotText_ invoked", {
        targetLanguage: chatTargetLanguage,
        inputLength: normalizedSource.length,
        preview: normalizedSource.slice(0, 80),
      });

      try {
        const translated = await translateBotText_(normalizedSource, chatTargetLanguage);
        const finalText = translated && translated.trim() ? translated : normalizedSource;
        if (finalText.trim() === normalizedSource.trim()) {
          logChatbotTranslation_("maybeTranslateBotText_ returned original text", {
            targetLanguage: chatTargetLanguage,
          });
          return { text: normalizedSource };
        }
        logChatbotTranslation_("maybeTranslateBotText_ translated successfully", {
          targetLanguage: chatTargetLanguage,
          outputLength: finalText.length,
        });
        return {
          text: finalText,
          originalText: normalizedSource,
        };
      } catch (error) {
        logChatbotTranslationError_("maybeTranslateBotText_ failed; using original text", error);
        return { text: normalizedSource };
      }
    };

    if (/^\/(translate|lang|language)\b/i.test(workingText)) {
      const commandValue = workingText.replace(/^\/(translate|lang|language)\b[:\s]*/i, "").trim();
      logChatbotTranslation_("Translate command received", {
        commandValue,
        currentLanguage: chatTargetLanguage,
      });

      if (!commandValue || /^status$/i.test(commandValue)) {
        const currentLabel = getTranslationLanguageLabel_(chatTargetLanguage);
        setMessages((prev) => [
          ...prev,
          {
            id: Date.now() + 1,
            text:
              `Current translation language: ${currentLabel}\n` +
              "Use /translate list to see available options, or /translate off to disable.",
            sender: "bot",
          },
        ]);
        setIsLoading(false);
        return;
      }

      if (/^(list|languages|options)$/i.test(commandValue)) {
        logChatbotTranslation_("Translate command list requested", {
          currentLanguage: chatTargetLanguage,
        });
        const list = CHATBOT_TRANSLATION_LANGUAGES
          .filter((language) => language.code !== CHATBOT_TRANSLATION_DEFAULT_LANGUAGE)
          .map((language) => `- ${language.label}`)
          .join("\n");

        setMessages((prev) => [
          ...prev,
          {
            id: Date.now() + 1,
            text:
              "Available translation languages:\n" +
              `${list}\n` +
              "Use /translate [language name] (example: /translate japanese).",
            sender: "bot",
          },
        ]);
        setIsLoading(false);
        return;
      }

      const resolvedLanguage = normalizeTranslationLanguage_(commandValue);
      logChatbotTranslation_("Resolved language from command", {
        commandValue,
        resolvedLanguage,
      });
      if (!resolvedLanguage) {
        setMessages((prev) => [
          ...prev,
          {
            id: Date.now() + 1,
            text:
              "Unknown language option. Try /translate list, /translate filipino, /translate japanese, or /translate off.",
            sender: "bot",
          },
        ]);
        setIsLoading(false);
        return;
      }

      if (resolvedLanguage !== CHATBOT_TRANSLATION_DEFAULT_LANGUAGE) {
        try {
          await translateBotText_("Translation service health check.", resolvedLanguage);
        } catch (translationError) {
          logChatbotTranslationError_("Health check failed", {
            resolvedLanguage,
            error: translationError,
          });
          const errorMessage =
            translationError instanceof Error && translationError.message
              ? translationError.message
              : "Translation service is currently unavailable.";

          setMessages((prev) => [
            ...prev,
            {
              id: Date.now() + 1,
              text: `Cannot enable translation yet: ${errorMessage}`,
              sender: "bot",
            },
          ]);
          setIsLoading(false);
          return;
        }
      }

      setChatTargetLanguage(resolvedLanguage);
      saveChatbotTranslationLanguage_(resolvedLanguage);
      logChatbotTranslation_("Language selected", {
        resolvedLanguage,
        resolvedLabel: getTranslationLanguageLabel_(resolvedLanguage),
      });

      const resolvedLabel = getTranslationLanguageLabel_(resolvedLanguage);
      const statusText =
        resolvedLanguage === CHATBOT_TRANSLATION_DEFAULT_LANGUAGE
          ? "Translation disabled. Homepage and bot replies will stay in English."
          : `Translation enabled: ${resolvedLabel}. I will translate homepage content and bot replies while keeping the organization name unchanged.`;

      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 1,
          text: statusText,
          sender: "bot",
        },
      ]);
      setIsLoading(false);
      return;
    }

    if (/^@clear\b/i.test(workingText) || /^@clear chat history\b/i.test(workingText)) {
      setMessages([{ id: Date.now(), text: "Hello! I'm the YSP Assistant. How can I help you?", sender: "bot" }]);
      setLastKnowledgeSource("database");
      setIsLoading(false);
      setMembersCommandActive(false);
      setPendingProjectSummary(null);
      setIsProjectDetailsPending(false);
      setPendingDirectoryLookup(null);
      setIsDirectoryDetailsPending(false);
      setLastDirectoryOfficer(null);
      setInput("");
      return;
    }

    if (/^\/help(?:\s+.*)?$/i.test(workingText) || /^help$/i.test(workingText)) {
      setLastKnowledgeSource("database");
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 1,
          text: buildHelpMessage(pageKey, role, isLoggedIn),
          sender: "bot",
        },
      ]);
      setIsLoading(false);
      return;
    }

    if (/^\/mode\s+llm$/i.test(workingText)) {
      setChatMode("llm");
      setMembersCommandActive(false);
      setLastKnowledgeSource("gemini");
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 1,
          text: "LLM mode enabled. KaagapAI will prioritize Gemini for normal chat. Members mode is now off.",
          sender: "bot",
        },
      ]);
      setIsLoading(false);
      return;
    }

    if (/^\/mode\s+assistant$/i.test(workingText)) {
      setChatMode("assistant");
      setLastKnowledgeSource("database");
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 1,
          text: "Assistant mode enabled. KaagapAI will prioritize built-in commands and local handlers.",
          sender: "bot",
        },
      ]);
      setIsLoading(false);
      return;
    }

    // 📋 @profile command: Answer profile-related questions
    if (/^\/?@profile\b/i.test(workingText)) {
      const questionText = workingText.replace(/^\/?@profile\b[:\s]*/i, "").trim();
      
      if (!questionText) {
        setMessages((prev) => [
          ...prev,
          {
            id: Date.now() + 1,
            text: "📋 **Profile Help**\n\nAsk me anything about your profile! Try:\n• @profile who am I\n• @profile introduce me\n• @profile edit profile\n• @profile my info\n• @profile settings\n• @profile change picture\n• @profile change password\n• @profile verify email\n• @profile what can I edit",
            sender: "bot",
          },
        ]);
        setIsLoading(false);
        return;
      }

      // Check if user wants to edit profile - trigger edit mode
      if (/^(edit\s*profile|edit\s*my\s*profile)$/i.test(questionText)) {
        if (onTriggerEditMode) {
          setMessages((prev) => [
            ...prev,
            { id: Date.now() + 1, text: "✏️ **Edit Mode Activated**\n\nI've enabled edit mode for your profile. Make your changes and click 'Save Changes' when done!\n\n*Tip: I'll be hidden while you edit to give you more space.*", sender: "bot" },
          ]);
          // Small delay to let the message appear, then trigger edit mode
          setTimeout(() => {
            onTriggerEditMode();
            setIsOpen(false); // Close chat
          }, 800);
          setIsLoading(false);
          return;
        }
      }

      // 🆕 "Who am I?" / "Introduce me" command - fetches real profile data
      if (/^(who\s*am\s*i|introduce\s*me|tell\s*me\s*about\s*myself|my\s*introduction)$/i.test(questionText)) {
        const storedUser = getStoredUser();
        if (!storedUser?.username) {
          setMessages((prev) => [
            ...prev,
            { id: Date.now() + 1, text: "❌ **Not Logged In**\n\nI can't introduce you because you're not logged in. Please log in first to see your personalized introduction!", sender: "bot" },
          ]);
          setIsLoading(false);
          return;
        }

        // Show loading message
        setMessages((prev) => [
          ...prev,
          { id: Date.now() + 1, text: "🔄 Fetching your profile from the backend...", sender: "bot" },
        ]);

        try {
          const response = await fetchUserProfile(storedUser.username);
          
          if (response.success && response.profile) {
            const p = response.profile;
            
            // Build a personalized introduction using real data
            const introduction = generatePersonalIntroduction(p);
            
            // Remove loading message and add introduction
            setMessages((prev) => {
              const filtered = prev.filter(m => !m.text.includes("Fetching your profile"));
              return [
                ...filtered,
                { 
                  id: Date.now() + 1, 
                  text: introduction, 
                  sender: "bot",
                  image: p.profilePictureURL || undefined
                },
              ];
            });
          } else {
            setMessages((prev) => {
              const filtered = prev.filter(m => !m.text.includes("Fetching your profile"));
              return [
                ...filtered,
                { id: Date.now() + 1, text: "❌ **Could not load profile**\n\nI wasn't able to fetch your profile data. Please try again later.", sender: "bot" },
              ];
            });
          }
        } catch (error) {
          console.error("Error fetching profile for introduction:", error);
          setMessages((prev) => {
            const filtered = prev.filter(m => !m.text.includes("Fetching your profile"));
            return [
              ...filtered,
              { id: Date.now() + 1, text: "❌ **Error**\n\nSomething went wrong while fetching your profile. Please try again.", sender: "bot" },
            ];
          });
        }
        
        setIsLoading(false);
        return;
      }

      const profileAnswer = findProfileAnswer(questionText);
      if (profileAnswer) {
        setMessages((prev) => [
          ...prev,
          { id: Date.now() + 1, text: profileAnswer, sender: "bot" },
        ]);
        setIsLoading(false);
        return;
      }

      // Default response for unrecognized profile questions
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 1,
          text: "I couldn't find a specific answer for that profile question. Try asking about:\n• Editing profile\n• Changing profile picture\n• Password changes\n• Email verification\n• Editable fields\n• Emergency contacts\n• Social media links",
          sender: "bot",
        },
      ]);
      setIsLoading(false);
      return;
    }

    if (/^\/@members\b/i.test(workingText)) {
      const remainder = workingText.replace(/^\/@members\b[:\s]*/i, "").trim();
      if (/^(off|disable|stop|exit)$/i.test(remainder)) {
        setMembersCommandActive(false);
        setMessages((prev) => [
          ...prev,
          { id: Date.now() + 1, text: "Members mode is now off.", sender: "bot" },
        ]);
        setIsLoading(false);
        return;
      }

      setMembersCommandActive(true);
      if (!remainder) {
        setMessages((prev) => [
          ...prev,
          { id: Date.now() + 1, text: "Members mode is now on. Ask your next question.", sender: "bot" },
        ]);
        setIsLoading(false);
        return;
      }
      workingText = `@members ${remainder}`;
      normalized = workingText.toLowerCase();
    }

    if (/^\/?@system\b/i.test(workingText)) {
      const commandText = workingText.replace(/^\/?@system\b[:\s]*/i, "").trim();
      const normalizedCommand = commandText.replace(/\s+/g, " ").toLowerCase();

      if (!normalizedCommand) {
        setMessages((prev) => [
          ...prev,
          {
            id: Date.now() + 1,
            text: "Try: @system clear cache or @system hard refresh.",
            sender: "bot",
          },
        ]);
        setIsLoading(false);
        return;
      }

      if (normalizedCommand === "clear cache" || normalizedCommand === "hard refresh") {
        if (onRequestCacheClear) {
          onRequestCacheClear();
          setMessages((prev) => [
            ...prev,
            {
              id: Date.now() + 1,
              text: "Opening the hard refresh panel. Confirm to clear local app data and reload.",
              sender: "bot",
            },
          ]);
        } else {
          setMessages((prev) => [
            ...prev,
            {
              id: Date.now() + 1,
              text: "Hard refresh is not available from this view.",
              sender: "bot",
            },
          ]);
        }
        setIsLoading(false);
        return;
      }

      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 1,
          text: "Unknown @system command. Try: @system clear cache or @system hard refresh.",
          sender: "bot",
        },
      ]);
      setIsLoading(false);
      return;
    }

    if (shouldUseAssistantHeuristics && membersCommandActive && !/^@members\b/i.test(workingText)) {
      if (!isMembersCommandAllowed) {
        setMembersCommandActive(false);
        setMessages((prev) => [
          ...prev,
          {
            id: Date.now() + 1,
            text: "Members mode is only available in Officer Directory or Manage Members.",
            sender: "bot",
          },
        ]);
        setIsLoading(false);
        return;
      }
      workingText = `@members ${workingText}`;
      normalized = workingText.toLowerCase();
    }

    if (/^@members\b/i.test(workingText)) {
      if (!isMembersCommandAllowed) {
        setMessages((prev) => [
          ...prev,
          {
            id: Date.now() + 1,
            text: "The @members command only works in Officer Directory or Manage Members.",
            sender: "bot",
          },
        ]);
        setIsLoading(false);
        return;
      }

      if (!isPrivileged) {
        setMessages((prev) => [
          ...prev,
          {
            id: Date.now() + 1,
            text: "No access. Only auditors and admins can use @members.",
            sender: "bot",
          },
        ]);
        setIsLoading(false);
        return;
      }

      const commandText = stripMembersCommandPrefix(workingText);
      if (!commandText) {
        setMessages((prev) => [
          ...prev,
          {
            id: Date.now() + 1,
            text: "Try: @members who is [name] or @members how many are females.",
            sender: "bot",
          },
        ]);
        setIsLoading(false);
        return;
      }

      const analyticsQuery = parseDirectoryAnalyticsQuery(commandText.toLowerCase());
      if (analyticsQuery) {
        try {
          setLastKnowledgeSource("database");
          const officers = await loadAllOfficersForAnalytics();
          const scope = parseDirectoryRoleScope(commandText.toLowerCase());
          const formatScopeLabel = (value: string) =>
            value.replace(/\b\w/g, (char) => char.toUpperCase());
          let scopeLabel = scope === "officers" ? "officer" : "member";
          const filters = extractScopeFilters(commandText.toLowerCase(), officers);
          if (filters.isExecutiveBoard) {
            scopeLabel = "executive board member";
          } else if (filters.committee) {
            scopeLabel = `${filters.committee} member`;
          } else if (filters.role) {
            scopeLabel = filters.role;
          } else if (filters.position) {
            scopeLabel = filters.position;
          }
          scopeLabel = formatScopeLabel(scopeLabel);
          const scopedOfficers = officers.filter((officer) => {
            const roleValue = (officer.role || "").toLowerCase();
            if (scope === "members") return roleValue === "member";
            if (scope === "officers") return roleValue !== "member";
            return true;
          });
          const filteredOfficers = scopedOfficers.filter((officer) => {
            if (filters.isExecutiveBoard) {
              const committeeValue = (officer.committee || "").toLowerCase();
              const positionValue = (officer.position || "").toLowerCase();
              if (!committeeValue.includes("executive board") && !positionValue.includes("executive board")) {
                return false;
              }
            }
            if (filters.committee) {
              const committeeValue = (officer.committee || "").toLowerCase();
              if (committeeValue !== filters.committee) return false;
            }
            if (filters.role) {
              const roleValue = (officer.role || "").toLowerCase();
              if (roleValue !== filters.role) return false;
            }
            if (filters.position) {
              const positionValue = (officer.position || "").toLowerCase();
              if (positionValue !== filters.position) return false;
            }
            return true;
          });

          if (analyticsQuery.type === "gender" && analyticsQuery.gender) {
            const genderKey = analyticsQuery.gender;
            const matches = filteredOfficers.filter((officer) => {
              return matchesGenderFilter(officer.gender || "", genderKey);
            });
            const count = matches.length;
            setMessages((prev) => [
              ...prev,
              {
                id: Date.now() + 1,
                text: `I found ${count} ${genderKey} ${scopeLabel}${count === 1 ? "" : "s"}.`,
                sender: "bot",
              },
            ]);
          } else if (analyticsQuery.type === "birthdays" && analyticsQuery.monthIndex !== undefined) {
            const monthIndex = analyticsQuery.monthIndex;
            const label = analyticsQuery.label || "that month";
            const matches = filteredOfficers.filter((officer) => {
              if (!officer.birthday) return false;
              const date = new Date(officer.birthday);
              if (Number.isNaN(date.getTime())) return false;
              return date.getMonth() === monthIndex;
            });
            const count = matches.length;
            if (isCountQuery(commandText.toLowerCase())) {
              setMessages((prev) => [
                ...prev,
                {
                  id: Date.now() + 1,
                  text: `There ${count === 1 ? "is" : "are"} ${count} ${scopeLabel}${count === 1 ? "" : "s"} with birthdays in ${label}.`,
                  sender: "bot",
                },
              ]);
            } else {
              const list = matches.slice(0, 10).map((officer) => `- ${officer.fullName}`).join("\n");
              const more = count > 10 ? `\n- ...and ${count - 10} more` : "";
              setMessages((prev) => [
                ...prev,
                {
                  id: Date.now() + 1,
                  text: count
                    ? `Birthdays in ${label} (${count}):\n${list}${more}`
                    : `No ${scopeLabel} birthdays found in ${label}.`,
                  sender: "bot",
                },
              ]);
            }
          } else if (analyticsQuery.type === "unverifiedEmail") {
            const matches = filteredOfficers.filter((officer) => !isOfficerEmailVerified(officer));
            const count = matches.length;
            if (isCountQuery(commandText.toLowerCase())) {
              setMessages((prev) => [
                ...prev,
                {
                  id: Date.now() + 1,
                  text: `There ${count === 1 ? "is" : "are"} ${count} ${scopeLabel}${count === 1 ? "" : "s"} with unverified emails.`,
                  sender: "bot",
                },
              ]);
            } else {
              const list = matches.slice(0, 10).map((officer) => `- ${officer.fullName}`).join("\n");
              const more = count > 10 ? `\n- ...and ${count - 10} more` : "";
              setMessages((prev) => [
                ...prev,
                {
                  id: Date.now() + 1,
                  text: count
                    ? `Unverified emails (${count}):\n${list}${more}`
                    : `All ${scopeLabel} emails appear verified.`,
                  sender: "bot",
                },
              ]);
            }
          }
        } catch (err) {
          console.error("Directory analytics error:", err);
          setMessages((prev) => [
            ...prev,
            { id: Date.now() + 1, text: buildErrorMessage("500"), sender: "bot" },
          ]);
        } finally {
          setIsLoading(false);
        }
        return;
      }

      const fieldRequest = extractRequestedDirectoryField(commandText.toLowerCase());
      const targets = extractMembersTargets(commandText);

      if (!targets.length && fieldRequest && lastDirectoryOfficer) {
        const { label, value } = getDirectoryFieldValue(lastDirectoryOfficer, fieldRequest);
        const responseText = value
          ? `${label} for ${lastDirectoryOfficer.fullName}: ${value}`
          : `I could not find ${label.toLowerCase()} for ${lastDirectoryOfficer.fullName}.`;
        setMessages((prev) => [
          ...prev,
          { id: Date.now() + 1, text: responseText, sender: "bot" },
        ]);
        setIsLoading(false);
        return;
      }

      if (!targets.length && lastDirectoryOfficer) {
        const detailText = formatOfficerSummary(lastDirectoryOfficer);
        setMessages((prev) => [
          ...prev,
          {
            id: Date.now() + 1,
            text: `${detailText}\n\nWould you like the full profile? Reply "yes" and I will open the Officer Directory.`,
            sender: "bot",
            image: lastDirectoryOfficer.profilePicture || undefined,
          },
        ]);
        setPendingDirectoryLookup({
          query: lastDirectoryOfficer.fullName,
          idCode: lastDirectoryOfficer.idCode || undefined,
        });
        setIsDirectoryDetailsPending(true);
        setIsLoading(false);
        return;
      }

      if (!targets.length) {
        setMessages((prev) => [
          ...prev,
          {
            id: Date.now() + 1,
            text: "Please include a name, e.g. @members who is [name].",
            sender: "bot",
          },
        ]);
        setIsLoading(false);
        return;
      }

      const normalizedTargets = targets.map((t) => normalizeDirectoryTarget(t)).filter(Boolean);

      try {
        if (normalizedTargets.length > 1 && fieldRequest) {
          const lines: string[] = [];
          for (const target of normalizedTargets) {
            const result = await searchDirectoryWithCache(target);
            if (result.success && result.officers && result.officers.length === 1) {
              const officer = result.officers[0];
              const { label, value } = getDirectoryFieldValue(officer, fieldRequest);
              lines.push(
                value
                  ? `${officer.fullName} - ${label}: ${value}`
                  : `${officer.fullName} - ${label}: N/A`
              );
              setLastDirectoryOfficer(officer);
            } else if (result.success && result.officers && result.officers.length > 1) {
              lines.push(`${target} - Multiple matches found`);
            } else {
              lines.push(`${target} - Not found`);
            }
          }

          setMessages((prev) => [
            ...prev,
            { id: Date.now() + 1, text: lines.join("\n"), sender: "bot" },
          ]);
          setIsLoading(false);
          return;
        }

        if (normalizedTargets.length > 1 && !fieldRequest) {
          setMessages((prev) => [
            ...prev,
            {
              id: Date.now() + 1,
              text: "I can look up one member at a time. Please ask about a single name.",
              sender: "bot",
            },
          ]);
          setIsLoading(false);
          return;
        }

        const target = normalizedTargets[0];
        const result = await searchDirectoryWithCache(target);
        if (result.success && result.officers && result.officers.length > 1) {
          const list = result.officers
            .slice(0, 5)
            .map((officer) => {
              const roleLabel = officer.position || officer.committee || officer.role;
              return `- ${officer.fullName}${roleLabel ? " - " + roleLabel : ""}`;
            })
            .join("\n");
          const more = result.officers.length > 5 ? "\n- ...and more" : "";
          setMessages((prev) => [
            ...prev,
            {
              id: Date.now() + 1,
              text: `I found multiple matches. Which one do you mean?\n${list}${more}`,
              sender: "bot",
            },
          ]);
        } else if (result.success && result.officers && result.officers.length === 1) {
          const officer = result.officers[0];
          setLastDirectoryOfficer(officer);
          if (fieldRequest) {
            const { label, value } = getDirectoryFieldValue(officer, fieldRequest);
            const responseText = value
              ? `${label} for ${officer.fullName}: ${value}`
              : `I could not find ${label.toLowerCase()} for ${officer.fullName}.`;
            setMessages((prev) => [
              ...prev,
              {
                id: Date.now() + 1,
                text: responseText,
                sender: "bot",
                image: officer.profilePicture || undefined,
              },
            ]);
            setIsLoading(false);
            return;
          }

          const detailText = formatOfficerSummary(officer);
          setMessages((prev) => [
            ...prev,
            {
              id: Date.now() + 1,
              text: `${detailText}\n\nWould you like the full profile? Reply "yes" and I will open the Officer Directory.`,
              sender: "bot",
              image: officer.profilePicture || undefined,
            },
          ]);
          setPendingDirectoryLookup({
            query: officer.fullName || target,
            idCode: officer.idCode || undefined,
          });
          setIsDirectoryDetailsPending(true);
        } else {
          setMessages((prev) => [
            ...prev,
            {
              id: Date.now() + 1,
              text: "I could not find that person. Please check the name and try again.",
              sender: "bot",
            },
          ]);
        }
      } catch (err) {
        console.error("Directory lookup error:", err);
        setMessages((prev) => [
          ...prev,
          { id: Date.now() + 1, text: buildErrorMessage("500"), sender: "bot" },
        ]);
      } finally {
        setIsLoading(false);
      }
      return;
    }

    if (isDirectoryDetailsPending && pendingDirectoryLookup) {
      const followUpField = extractRequestedDirectoryField(normalized);
      if (followUpField && lastDirectoryOfficer) {
        const { label, value } = getDirectoryFieldValue(lastDirectoryOfficer, followUpField);
        const responseText = value
          ? `${label} for ${lastDirectoryOfficer.fullName}: ${value}`
          : `I could not find ${label.toLowerCase()} for ${lastDirectoryOfficer.fullName}.`;
        setMessages((prev) => [
          ...prev,
          { id: Date.now() + 1, text: responseText, sender: "bot" },
        ]);
        setIsLoading(false);
        return;
      }

      if (isFullDirectoryReply(text)) {
        if (onOfficerDirectorySearch) {
          onOfficerDirectorySearch(pendingDirectoryLookup);
          setMessages((prev) => [
            ...prev,
            {
              id: Date.now() + 1,
              text: `Opening the Officer Directory for ${pendingDirectoryLookup.query}.`,
              sender: "bot",
            },
          ]);
        } else {
          setMessages((prev) => [
            ...prev,
            {
              id: Date.now() + 1,
              text: "I can share the summary here, but I cannot open the directory from this view.",
              sender: "bot",
            },
          ]);
        }
      } else if (/^(no|n|not now|later)$/i.test(text.trim())) {
        setMessages((prev) => [
          ...prev,
          { id: Date.now() + 1, text: "Okay! Let me know if you want the full profile.", sender: "bot" },
        ]);
      } else {
        setMessages((prev) => [
          ...prev,
          {
            id: Date.now() + 1,
            text: "Reply 'yes' to open the full profile in the Officer Directory, or 'no' to keep the summary.",
            sender: "bot",
          },
        ]);
        setIsLoading(false);
        return;
      }

      setIsLoading(false);
      setIsDirectoryDetailsPending(false);
      setPendingDirectoryLookup(null);
      return;
    }

    if (isProjectDetailsPending && pendingProjectSummary) {
      const selected = parseProjectSelection(text, pendingProjectSummary);
      if (!selected) {
        setMessages((prev) => [
          ...prev,
          {
            id: Date.now() + 1,
            text: "Please reply with a project number, the project title, or say 'all'.",
            sender: "bot",
          },
        ]);
        setIsLoading(false);
        return;
      }

      const baseId = Date.now() + 1;
      const projectMessages: Message[] = selected.map((project, index) => {
        const parts = [project.title, project.description].filter(Boolean);
        if (project.link) {
          const linkLabel = project.linkText || "Learn more";
          parts.push(`${linkLabel}: ${project.link}`);
        }
        return {
          id: baseId + index,
          text: parts.join("\n"),
          sender: "bot",
          image: project.imageUrl || undefined,
        };
      });

      setMessages((prev) => [...prev, ...projectMessages]);
      setIsLoading(false);
      setIsProjectDetailsPending(false);
      setPendingProjectSummary(null);
      return;
    }

    const analyticsQuery = parseDirectoryAnalyticsQuery(normalized);
    if (shouldUseAssistantHeuristics && analyticsQuery) {
      if (!isPrivileged) {
        setMessages((prev) => [
          ...prev,
          {
            id: Date.now() + 1,
            text: "No access. Only auditors and admins can view directory analytics.",
            sender: "bot",
          },
        ]);
        setIsLoading(false);
        return;
      }

      try {
        setLastKnowledgeSource("database");
        const officers = await loadAllOfficersForAnalytics();

        if (analyticsQuery.type === "gender" && analyticsQuery.gender) {
          const genderKey = analyticsQuery.gender;
          const matches = officers.filter((officer) => {
            return matchesGenderFilter(officer.gender || "", genderKey);
          });
          const count = matches.length;
          setMessages((prev) => [
            ...prev,
            {
              id: Date.now() + 1,
              text: `I found ${count} ${genderKey} officer${count === 1 ? "" : "s"}.`,
              sender: "bot",
            },
          ]);
        } else if (analyticsQuery.type === "birthdays" && analyticsQuery.monthIndex !== undefined) {
          const monthIndex = analyticsQuery.monthIndex;
          const label = analyticsQuery.label || "that month";
          const matches = officers.filter((officer) => {
            if (!officer.birthday) return false;
            const date = new Date(officer.birthday);
            if (Number.isNaN(date.getTime())) return false;
            return date.getMonth() === monthIndex;
          });
          const count = matches.length;
          if (isCountQuery(normalized)) {
            setMessages((prev) => [
              ...prev,
              {
                id: Date.now() + 1,
                text: `There ${count === 1 ? "is" : "are"} ${count} officer${count === 1 ? "" : "s"} with birthdays in ${label}.`,
                sender: "bot",
              },
            ]);
          } else {
            const list = matches.slice(0, 10).map((officer) => `- ${officer.fullName}`).join("\n");
            const more = count > 10 ? `\n- ...and ${count - 10} more` : "";
            setMessages((prev) => [
              ...prev,
              {
                id: Date.now() + 1,
                text: count
                  ? `Birthdays in ${label} (${count}):\n${list}${more}`
                  : `No officer birthdays found in ${label}.`,
                sender: "bot",
              },
            ]);
          }
        } else if (analyticsQuery.type === "unverifiedEmail") {
          const matches = officers.filter((officer) => !isOfficerEmailVerified(officer));
          const count = matches.length;
          if (isCountQuery(normalized)) {
            setMessages((prev) => [
              ...prev,
              {
                id: Date.now() + 1,
                text: `There ${count === 1 ? "is" : "are"} ${count} officer${count === 1 ? "" : "s"} with unverified emails.`,
                sender: "bot",
              },
            ]);
          } else {
            const list = matches.slice(0, 10).map((officer) => `- ${officer.fullName}`).join("\n");
            const more = count > 10 ? `\n- ...and ${count - 10} more` : "";
            setMessages((prev) => [
              ...prev,
              {
                id: Date.now() + 1,
                text: count
                  ? `Unverified emails (${count}):\n${list}${more}`
                  : "All officer emails appear verified.",
                sender: "bot",
              },
            ]);
          }
        }
      } catch (err) {
        console.error("Directory analytics error:", err);
        setMessages((prev) => [
          ...prev,
          { id: Date.now() + 1, text: buildErrorMessage("500"), sender: "bot" },
        ]);
      } finally {
        setIsLoading(false);
      }
      return;
    }

    if (shouldUseAssistantHeuristics && isExecutiveBoardQuery(normalized)) {
      const responseText = orgChartUrl
        ? "Here is the organizational chart for the Executive Board."
        : "The organizational chart is not available yet. Please check back later.";
      const botMsg: Message = {
        id: Date.now() + 1,
        text: responseText,
        sender: "bot",
        image: orgChartUrl || undefined,
      };
      setMessages((prev) => [...prev, botMsg]);
      setIsLoading(false);
      return;
    }

    if (shouldUseAssistantHeuristics && isDirectoryIntent(normalized)) {
      const rawTarget =
        extractDirectoryTarget(workingText) || extractPossessiveTarget(workingText) || "";
      const target = normalizeDirectoryTarget(rawTarget);
      const fieldRequest = extractRequestedDirectoryField(normalized);
      if ((!target || isGenericDirectoryTarget(target)) && fieldRequest && lastDirectoryOfficer) {
        const { label, value } = getDirectoryFieldValue(lastDirectoryOfficer, fieldRequest);
        const responseText = value
          ? `${label} for ${lastDirectoryOfficer.fullName}: ${value}`
          : `I could not find ${label.toLowerCase()} for ${lastDirectoryOfficer.fullName}.`;
        setMessages((prev) => [
          ...prev,
          { id: Date.now() + 1, text: responseText, sender: "bot" },
        ]);
        setIsLoading(false);
        return;
      }
      if (!target || isGenericDirectoryTarget(target)) {
        setMessages((prev) => [
          ...prev,
          {
            id: Date.now() + 1,
            text: "Which person's info do you need? Please include a full name.",
            sender: "bot",
          },
        ]);
        setIsLoading(false);
        return;
      }

      if (!isPrivileged) {
        setMessages((prev) => [
          ...prev,
          {
            id: Date.now() + 1,
            text: "No access. Only auditors and admins can view personal info.",
            sender: "bot",
          },
        ]);
        setIsLoading(false);
        return;
      }

      try {
        const result = await searchDirectoryWithCache(target);
        if (result.success && result.officers && result.officers.length > 1) {
          const list = result.officers
            .slice(0, 5)
            .map((officer) => {
              const roleLabel = officer.position || officer.committee || officer.role;
              return `- ${officer.fullName}${roleLabel ? " - " + roleLabel : ""}`;
            })
            .join("\n");
          const more = result.officers.length > 5 ? "\n- ...and more" : "";
          const botMsg: Message = {
            id: Date.now() + 1,
            text: `I found multiple matches. Which one do you mean?\n${list}${more}`,
            sender: "bot",
          };
          setMessages((prev) => [...prev, botMsg]);
        } else if (result.success && result.officers && result.officers.length === 1) {
          const officer = result.officers[0];
          setLastDirectoryOfficer(officer);
          if (fieldRequest) {
            const { label, value } = getDirectoryFieldValue(officer, fieldRequest);
            const responseText = value
              ? `${label} for ${officer.fullName}: ${value}`
              : `I could not find ${label.toLowerCase()} for ${officer.fullName}.`;
            setMessages((prev) => [
              ...prev,
              {
                id: Date.now() + 1,
                text: responseText,
                sender: "bot",
                image: officer.profilePicture || undefined,
              },
            ]);
            setIsLoading(false);
            return;
          }

          const detailText = formatOfficerSummary(officer);
          const botMsg: Message = {
            id: Date.now() + 1,
            text: `${detailText}\n\nWould you like the full profile? Reply "yes" and I will open the Officer Directory.`,
            sender: "bot",
            image: officer.profilePicture || undefined,
          };
          setMessages((prev) => [...prev, botMsg]);
          setPendingDirectoryLookup({
            query: officer.fullName || target,
            idCode: officer.idCode || undefined,
          });
          setIsDirectoryDetailsPending(true);
        } else {
          setMessages((prev) => [
            ...prev,
            {
              id: Date.now() + 1,
              text: "I could not find that person. Please check the name and try again.",
              sender: "bot",
            },
          ]);
        }
      } catch (err) {
        console.error("Directory lookup error:", err);
        setMessages((prev) => [
          ...prev,
          { id: Date.now() + 1, text: buildErrorMessage("500"), sender: "bot" },
        ]);
      } finally {
        setIsLoading(false);
      }
      return;
    }

    const eventQuery = parseEventQuery(normalized);
    if (shouldUseAssistantHeuristics && eventQuery) {
      if (eventQuery.needsClarification) {
        setMessages((prev) => [
          ...prev,
          { id: Date.now() + 1, text: "Which month should I check for events?", sender: "bot" },
        ]);
        setIsLoading(false);
        return;
      }

      try {
        const events = await fetchEvents();
        const filteredEvents = events.filter((event) => {
          const startDate = new Date(event.StartDate);
          const endDate = event.EndDate ? new Date(event.EndDate) : startDate;

          const startMatches =
            !Number.isNaN(startDate.getTime()) &&
            startDate.getMonth() === eventQuery.monthIndex &&
            (eventQuery.year ? startDate.getFullYear() === eventQuery.year : true);

          const endMatches =
            !Number.isNaN(endDate.getTime()) &&
            endDate.getMonth() === eventQuery.monthIndex &&
            (eventQuery.year ? endDate.getFullYear() === eventQuery.year : true);

          return startMatches || endMatches;
        });

        const sortedEvents = [...filteredEvents].sort((a, b) => {
          const aDate = new Date(a.StartDate).getTime();
          const bDate = new Date(b.StartDate).getTime();
          return aDate - bDate;
        });

        if (sortedEvents.length === 0) {
          setMessages((prev) => [
            ...prev,
            {
              id: Date.now() + 1,
              text: `No events found for ${eventQuery.label}.`,
              sender: "bot",
            },
          ]);
        } else {
          const lines = sortedEvents.map((event) => {
            const dateLabel = formatEventDate(event.StartDate);
            const timeLabel = event.StartTime ? ` ${event.StartTime}` : "";
            const locationLabel = event.LocationName ? ` @ ${event.LocationName}` : "";
            const statusLabel = event.Status ? ` (${event.Status})` : "";
            return `- ${event.Title} - ${dateLabel}${timeLabel}${locationLabel}${statusLabel}`;
          });
          const header = `Events in ${eventQuery.label} (${sortedEvents.length}):`;
          setMessages((prev) => [
            ...prev,
            { id: Date.now() + 1, text: `${header}\n${lines.join("\n")}`, sender: "bot" },
          ]);
        }
      } catch (err) {
        console.error("Events lookup error:", err);
        setMessages((prev) => [
          ...prev,
          { id: Date.now() + 1, text: buildErrorMessage("500"), sender: "bot" },
        ]);
      } finally {
        setIsLoading(false);
      }
      return;
    }

    if (shouldUseAssistantHeuristics && isProjectsQuery(normalized)) {
      try {
        const result = await fetchAllProjects();
        if (result.error) {
          setMessages((prev) => [
            ...prev,
            { id: Date.now() + 1, text: buildErrorMessage("500"), sender: "bot" },
          ]);
        } else {
          const projects = result.projects || [];
          const activeProjects = projects.filter((project) => project.status === "Active");
          const list = activeProjects.length > 0 ? activeProjects : projects;

          if (list.length === 0) {
            setMessages((prev) => [
              ...prev,
              { id: Date.now() + 1, text: "No projects found yet.", sender: "bot" },
            ]);
          } else {
            const listText = list
              .map((project, index) => `${index + 1}. ${project.title}`)
              .join("\n");
            const summary: Message = {
              id: Date.now() + 1,
              text: `I found ${list.length} projects. Here is a quick summary:\n${listText}\n\nReply with a project number, the title, or say 'all' to see full details and photos.`,
              sender: "bot",
            };
            setMessages((prev) => [...prev, summary]);
            setPendingProjectSummary(list);
            setIsProjectDetailsPending(true);
          }
        }
      } catch (err) {
        console.error("Projects lookup error:", err);
        setMessages((prev) => [
          ...prev,
          { id: Date.now() + 1, text: buildErrorMessage("500"), sender: "bot" },
        ]);
      } finally {
        setIsLoading(false);
      }
      return;
    }

    // 📊 Check for attendance dashboard context queries
    if (shouldUseAssistantHeuristics && (currentPage === 'attendance-dashboard' || currentPage === 'AttendanceDashboard')) {
      const attendanceResponse = generateAttendanceContextResponse(text);
      if (attendanceResponse) {
        const translatedAttendance = await maybeTranslateBotText_(attendanceResponse);
        setTimeout(() => {
          const botMsg: Message = {
            id: Date.now() + 1,
            text: translatedAttendance.text,
            originalText: translatedAttendance.originalText,
            sender: "bot",
          };
          setMessages((prev) => [...prev, botMsg]);
          setIsLoading(false);
        }, 600);
        return;
      }
    }

    const localMatch = findLocalAnswer(text);
    const storedUser = getStoredUser();
    const sessionToken = getSessionToken();
    const canUseLocalFallback = shouldUseAssistantHeuristics || !sessionToken;

    if (localMatch && canUseLocalFallback) {
      setLastKnowledgeSource("database");
      let imageUrl: string | undefined = undefined;

      if (localMatch.lookup) {
        try {
          const result = await searchOfficers(localMatch.lookup);
          if (result.success && result.officers && result.officers.length > 0) {
            imageUrl = result.officers[0].profilePicture;
          }
        } catch (err) {
          console.error("Error fetching officer image:", err);
        }
      }

      const translatedLocal = await maybeTranslateBotText_(localMatch.answer);

      setTimeout(() => {
        const botMsg: Message = {
          id: Date.now() + 1,
          text: translatedLocal.text,
          originalText: translatedLocal.originalText,
          sender: "bot",
          image: imageUrl,
        };
        setMessages((prev) => [...prev, botMsg]);
        setIsLoading(false);
      }, imageUrl ? 1000 : 600);

      return;
    }

    if (!sessionToken) {
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 1,
          text: "Guest mode supports homepage FAQs. Use /mode assistant for local answers, or log in to use LLM chat.",
          sender: "bot",
        },
      ]);
      setIsLoading(false);
      return;
    }

    try {
      const recentHistory = messages.slice(-8).map((m) => ({
        role: m.sender === "bot" ? "assistant" : "user",
        text: m.text,
      }));

      const contextParts: string[] = [];
      if (currentPage) contextParts.push(`Current page: ${currentPage}`);
      contextParts.push(`Chat mode: ${chatMode}`);
      contextParts.push(`Translation language: ${chatTargetLanguage}`);
      if (attendanceDashboardContext) {
        contextParts.push(
          `Attendance mode: ${attendanceDashboardContext.mode}, records: ${attendanceDashboardContext.statistics.totalRecords}`
        );
      }

      const res = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({
          message: text,
          contextPage: currentPage || "",
          currentUrl: typeof window !== "undefined" ? window.location.href : "",
          context: contextParts.join(" | "),
          username: storedUser?.username || "",
          email: storedUser?.email || "",
          userRole: storedUser?.role || userRole || "",
          idCode: storedUser?.id || "",
          sessionToken,
          history: recentHistory,
        }),
      });

      const raw = await res.text();
      let reply = "";
      let source: KnowledgeSource = "gemini";
      let replyCode: string | number | undefined;
      try {
        const parsed = JSON.parse(raw);
        reply = typeof parsed?.reply === "string" ? parsed.reply : "";
        replyCode = parsed?.code;
        const parsedSource = normalizeKnowledgeSource(parsed?.source);
        if (parsedSource) source = parsedSource;
      } catch {
        reply = raw;
      }

      if (!res.ok) {
        throw new Error(reply || buildErrorMessage(replyCode || res.status));
      }

      if (!reply.trim()) reply = CLARIFYING_FALLBACK;
      const translatedReply = await maybeTranslateBotText_(reply);

      setLastKnowledgeSource(source);
      const botMsg: Message = {
        id: Date.now() + 1,
        text: translatedReply.text,
        originalText: translatedReply.originalText,
        sender: "bot",
        source,
      };
      setMessages((prev) => [...prev, botMsg]);
    } catch (err) {
      console.error("Chatbot API error:", err);
      const message = err instanceof Error && err.message ? err.message : buildErrorMessage("500");
      setMessages((prev) => [
        ...prev,
        { id: Date.now() + 1, text: message, sender: "bot" },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  // Modified form handler
  const sendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    handleSend(input.trim());
    setInput(""); 
  };

// 🔗 Helper: Format text to make URLs and Emails clickable
  const formatMessage = (text: string, isUser: boolean) => {
    const safeText = isUser ? text : sanitizeBotText(text);
    // Split text by URLs or Emails (including + signs)
    const regex = /((?:https?:\/\/[^\s]+)|(?:[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}))/g;

    return safeText.split(regex).map((part, i) => {
      // Check if it's a URL
      if (part.match(/^https?:\/\//)) {
        return (
          <a
            key={i}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              color: isUser ? "#ffffff" : "#ea580c", // Orange for Bot, White for User
              textDecoration: "underline",
              fontWeight: 600,
            }}
          >
            {part}
          </a>
        );
      }
      // Check if it's an Email
      if (part.match(/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/)) {
        return (
          <a
            key={i}
            href={`mailto:${part.replace(/\+/g, '%2B')}`}
            onClick={(e) => {
              e.preventDefault();
              console.warn('[Email Debug] ChatBot email link clicked:', part);
              openEmailApp(part);
            }}
            style={{
              color: isUser ? "#ffffff" : "#ea580c", // Orange for Bot, White for User
              textDecoration: "underline",
              fontWeight: 600,
            }}
          >
            {part}
          </a>
        );
      }
      // Return normal text
      return part;
    });
  };

  const suggestionList = useMemo(() => {
    const list = [...BASE_SUGGESTIONS];
    const pageKey = currentPage.toLowerCase();
    const isMembersPage = pageKey === "officer-directory" || pageKey === "manage-members";
    const isProfilePage = pageKey === "my-profile" || pageKey === "profile";
    const role = userRole.toLowerCase();
    const isPrivileged = role === "auditor" || role === "admin";

    // Add profile suggestions when on profile page
    if (isProfilePage) {
      list.unshift(
        "@profile who am I",
        "@profile introduce me",
        "@profile edit profile",
        "@profile my info",
        "@profile settings",
        "@profile change picture",
        "@profile change password",
        "@profile verify email",
        "@profile what can I edit"
      );
    }

    if (isMembersPage && isPrivileged) {
      list.unshift(
        "@clear chat history",
        "@members who is [name]",
        "@members how many members are females",
        "@members birthdays in March",
        "/@members"
      );
    }

    return list;
  }, [currentPage, userRole]);

  // 🌙 Dark mode color scheme
  const colors = {
    // Backgrounds
    chatWindowBg: isDark ? "#1f2937" : "#ffffff",
    messageAreaBg: isDark ? "#111827" : "#f9fafb",
    inputAreaBg: isDark ? "#1f2937" : "#ffffff",
    suggestionBg: isDark ? "#1f2937" : "#ffffff",
    suggestionHoverBg: isDark ? "#374151" : "#f3f4f6",
    botMessageBg: isDark ? "#374151" : "#ffffff",
    inputBg: isDark ? "#374151" : "#f9fafb",
    inputBgCooldown: isDark ? "#1f2937" : "#f3f4f6",
    botAvatarBg: isDark ? "#374151" : "#ffffff",
    imageBg: isDark ? "#374151" : "#f3f4f6",
    // Borders
    border: isDark ? "#4b5563" : "#e5e7eb",
    borderLight: isDark ? "#374151" : "#e5e7eb",
    inputBorderFocus: "#ea580c",
    // Text
    textPrimary: isDark ? "#f9fafb" : "#1f2937",
    textSecondary: isDark ? "#d1d5db" : "#6b7280",
    textMuted: isDark ? "#9ca3af" : "#4b5563",
    // Shadows
    chatWindowShadow: isDark ? "0 10px 40px -10px rgba(0,0,0,0.5)" : "0 10px 40px -10px rgba(0,0,0,0.2)",
  };

  const ui = (
      <div
        className="font-sans ysp-chatbot-root"
        style={{
          position: "fixed",
          bottom: "20px",
          right: "20px",
          zIndex: 9000,
          pointerEvents: "none",
          display: "flex",
          flexDirection: "column",
          alignItems: "flex-end",
          gap: "12px",
        }}
      >
        {/* ✅ Chat Window */}
        <div
          style={{
            display: isOpen ? "flex" : "none",
            flexDirection: "column",
            width: "min(380px, calc(100vw - 32px))",
            height: "min(600px, calc(100vh - 120px))",
            backgroundColor: colors.chatWindowBg,
            border: `1px solid ${colors.border}`,
            borderRadius: "16px",
            overflow: "hidden",
            boxShadow: colors.chatWindowShadow,
            pointerEvents: "auto",
            transformOrigin: "bottom right",
            animation: isOpen ? "scaleIn 0.2s ease-out" : "none",
          }}
        >
          {/* Header */}
          <div
            style={{
              background: "linear-gradient(135deg, #f6421f 0%, #ee8724 100%)",
              color: "#ffffff",
              padding: "16px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
            }}
          >
            <div
              style={{
                width: "32px",
                height: "32px",
                borderRadius: "50%",
                overflow: "hidden",
                border: "2px solid rgba(255,255,255,0.3)",
                display: "flex",
                flexShrink: 0,
              }}
            >
              <img 
                src="/icons/ysp-icon-1024.png" 
                alt="YSP Logo" 
                style={{ width: "100%", height: "100%", objectFit: "cover" }} 
              />
            </div>

            {/* ✅ TITLE & TAGLINE */}
            <div style={{ display: "flex", flexDirection: "column", marginLeft: "12px", flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <span style={{ fontWeight: "bold", fontSize: "16px", lineHeight: "1.2" }}>
                  KaagapAI
                </span>
                {/* 🟢 ONLINE DOT */}
                <div style={{
                  width: "8px",
                  height: "8px",
                  borderRadius: "50%",
                  backgroundColor: "#4ade80", // Bright Green
                  boxShadow: "0 0 6px #4ade80"
                }} />
              </div>
              <span style={{ fontSize: "11px", opacity: 0.9, fontWeight: "400" }}>
                Katuwang ng Kabataang Tagumeño.
              </span>
              <div style={{ marginTop: "6px", display: "flex", alignItems: "center", gap: "6px" }}>
                <span
                  style={{
                    fontSize: "10px",
                    fontWeight: 700,
                    padding: "2px 8px",
                    borderRadius: "999px",
                    backgroundColor: chatMode === "llm" ? "rgba(239, 68, 68, 0.22)" : "rgba(250, 204, 21, 0.22)",
                    border: chatMode === "llm" ? "1px solid rgba(239, 68, 68, 0.55)" : "1px solid rgba(250, 204, 21, 0.55)",
                    color: "#fff",
                    letterSpacing: "0.2px",
                  }}
                >
                  Mode: {chatMode === "llm" ? "LLM" : "Assistant"}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsOpen(false)}
              style={{
                background: "transparent",
                border: "none",
                cursor: "pointer",
                color: "#fff",
                opacity: 0.9,
                display: "flex",
                paddingLeft: "8px",
              }}
            >
              <Minimize2 size={20} />
            </button>
          </div>

          {/* Messages Area */}
          <div
            style={{
              flex: 1,
              overflowY: "auto",
              overflowX: "hidden",
              padding: "16px",
              backgroundColor: colors.messageAreaBg,
              display: "flex",
              flexDirection: "column",
              gap: "16px",
            }}
          >
            {messages.map((msg) => {
              const isUser = msg.sender === "user";
              const botSource: KnowledgeSource = msg.source || "database";
              const botGlowStyle = isUser ? null : getBotMessageGlowStyle(botSource, isDark);
              return (
                <div
                  key={msg.id}
                  style={{
                    display: "flex",
                    justifyContent: isUser ? "flex-end" : "flex-start",
                    alignItems: "flex-end",
                    gap: "8px",
                  }}
                >
                  {/* 🤖 Bot Avatar */}
                  {!isUser && (
                    <div
                      style={{
                        width: "28px",
                        height: "28px",
                        borderRadius: "50%",
                        overflow: "hidden",
                        backgroundColor: colors.botAvatarBg,
                        flexShrink: 0,
                        border: `1px solid ${colors.border}`,
                      }}
                    >
                      <img 
                        src="/icons/ysp-icon-1024.png" 
                        alt="AI" 
                        style={{ width: "100%", height: "100%", objectFit: "cover" }} 
                      />
                    </div>
                  )}

                  {/* Message Bubble Container (Holds Image + Text) */}
                  <div style={{ maxWidth: "75%", display: "flex", flexDirection: "column", gap: "4px" }}>
                    
                    {/* 📸 IMAGE DISPLAY (Only shows if msg.image exists) */}
                    {msg.image && (
                      <div style={{
                        width: "100%",
                        height: "150px", // Fixed height for consistency
                        borderRadius: "12px",
                        overflow: "hidden",
                        backgroundColor: colors.imageBg,
                        border: `1px solid ${colors.border}`,
                        marginBottom: "4px"
                      }}>
                        <img 
                          src={msg.image} 
                          alt="Attachment" 
                          style={{ width: "100%", height: "100%", objectFit: "cover", cursor: "pointer" }}
                          onClick={() => setFullImageUrl(msg.image || null)}
                        />
                      </div>
                    )}

                    {/* Text Bubble */}
                    <div
                      style={{
                        padding: "12px 16px",
                        borderRadius: "18px",
                        borderBottomRightRadius: isUser ? "4px" : "18px",
                        borderTopLeftRadius: isUser ? "18px" : "4px",
                        fontSize: "14px",
                        lineHeight: "1.5",
                        backgroundColor: isUser ? "#ea580c" : colors.botMessageBg,
                        color: isUser ? "#ffffff" : colors.textPrimary,
                        border: isUser ? "none" : `1px solid ${colors.border}`,
                        boxShadow: isDark ? "0 1px 2px rgba(0,0,0,0.2)" : "0 1px 2px rgba(0,0,0,0.05)",
                        wordBreak: "break-word",
                        overflowWrap: "anywhere",
                        whiteSpace: "pre-wrap",
                        ...(botGlowStyle || {}),
                      }}
                    >
                      {formatMessage(msg.text, isUser)}
                    </div>
                  </div>

                  {/* 👤 User Avatar */}
                  {isUser && (
                    <div
                      style={{
                        width: "28px",
                        height: "28px",
                        borderRadius: "50%",
                        backgroundColor: "#ea580c",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                        opacity: 0.8,
                      }}
                    >
                      <User size={16} color="white" />
                    </div>
                  )}
                </div>
              );
            })}

            {isLoading && (
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <div
                  style={{
                    width: "28px",
                    height: "28px",
                    borderRadius: "50%",
                    overflow: "hidden",
                    backgroundColor: colors.botAvatarBg,
                    border: `1px solid ${colors.border}`,
                  }}
                >
                  <img 
                    src="/icons/ysp-icon-1024.png" 
                    alt="AI" 
                    style={{ width: "100%", height: "100%", objectFit: "cover" }} 
                  />
                </div>
                <div
                  style={{
                    backgroundColor: colors.botMessageBg,
                    border: `1px solid ${colors.border}`,
                    padding: "10px 14px",
                    borderRadius: "18px",
                    borderTopLeftRadius: "4px",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                  }}
                >
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-orange-600" />
                  <span style={{ fontSize: "12px", color: colors.textSecondary }}>Thinking...</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* 💡 Suggestions Area (Just above the type bar) */}
          {input.trim().length > 0 && (
            <div
              className="ysp-no-scrollbar"
              style={{
                padding: "0 16px 12px 16px",
                display: "flex",
                gap: "8px",
                overflowX: "auto",
                backgroundColor: colors.messageAreaBg, // matches message area bg
              }}
            >
            {suggestionList
              .filter((suggestion) => {
                const trimmed = input.trim().toLowerCase();
                if (!trimmed) return false;
                const isCommand = suggestion.startsWith("@") || suggestion.startsWith("/@");
                const isCommandInput = trimmed.startsWith("@") || trimmed.startsWith("/@");
                if (isCommand && !isCommandInput) return false;
                return suggestion.toLowerCase().includes(trimmed);
              })
              .map((suggestion, idx) => (
              <button
                key={idx}
                onClick={() => {
                  setInput(suggestion);
                  inputRef.current?.focus();
                }}
                disabled={isLoading}
                style={{
                  whiteSpace: "nowrap",
                  padding: "8px 14px",
                  borderRadius: "20px",
                  border: `1px solid ${colors.border}`,
                  backgroundColor: colors.suggestionBg,
                  color: colors.textMuted,
                  fontSize: "12px",
                  fontWeight: "500",
                  cursor: isLoading ? "default" : "pointer",
                  transition: "all 0.2s",
                  boxShadow: isDark ? "0 1px 2px rgba(0,0,0,0.2)" : "0 1px 2px rgba(0,0,0,0.05)",
                  flexShrink: 0,
                }}
                onMouseEnter={(e) => {
                   if (!isLoading) {
                     e.currentTarget.style.backgroundColor = colors.suggestionHoverBg;
                     e.currentTarget.style.borderColor = isDark ? "#6b7280" : "#d1d5db";
                   }
                }}
                onMouseLeave={(e) => {
                   if (!isLoading) {
                     e.currentTarget.style.backgroundColor = colors.suggestionBg;
                     e.currentTarget.style.borderColor = colors.border;
                   }
                }}
              >
                {suggestion}
              </button>
            ))}
            </div>
          )}

          {/* Input Area */}
          <form
            onSubmit={sendMessage}
            style={{
              display: "flex",
              gap: "10px",
              padding: "12px 16px",
              borderTop: `1px solid ${colors.border}`,
              backgroundColor: colors.inputAreaBg,
            }}
          >
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={isLoading || cooldown > 0} // 👈 Disable input
              placeholder={
                cooldown > 0 
                  ? `Please wait ${cooldown}s...` 
                  : "Ask YSP something..."
              }
              style={{
                flex: 1,
                border: `1px solid ${colors.border}`,
                borderRadius: "24px",
                padding: "10px 16px",
                outline: "none",
                fontSize: "14px",
                color: colors.textPrimary,
                // Change background if cooling down
                backgroundColor: cooldown > 0 ? colors.inputBgCooldown : colors.inputBg, 
                transition: "all 0.2s",
                cursor: cooldown > 0 ? "not-allowed" : "text"
              }}
              onFocus={(e) => {
                if (cooldown === 0) e.target.style.borderColor = "#ea580c";
              }}
              onBlur={(e) => (e.target.style.borderColor = colors.border)}
            />
            <button
              type="submit"
              disabled={isLoading || cooldown > 0}
              style={{
                width: "42px",
                height: "42px",
                borderRadius: "50%",
                border: "none",
                // 🎨 Change color to Grey if disabled
                backgroundColor: (isLoading || cooldown > 0) ? "#9ca3af" : "#ea580c",
                cursor: (isLoading || cooldown > 0) ? "default" : "pointer",
                color: "#ffffff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                transition: "all 0.2s",
              }}
            >
              {/* Show Number if cooling down, else show Icon */}
              {cooldown > 0 ? (
                <span style={{ fontSize: "12px", fontWeight: "bold" }}>{cooldown}</span>
              ) : (
                <Send size={18} />
              )}
            </button>
          </form>
        </div>

        {/* ✅ Floating Button */}
        <button
          type="button"
          onClick={() => setIsOpen((v) => !v)}
          style={{
            width: "60px",
            height: "60px",
            borderRadius: "50%",
            border: "2px solid rgba(255, 255, 255, 0.75)",
            cursor: "pointer",
            background: "linear-gradient(135deg, #f6421f 0%, #ee8724 100%)",
            color: "#ffffff",
            boxShadow: "0 10px 22px rgba(234, 88, 12, 0.35)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            pointerEvents: "auto",
            transition: "transform 0.2s, box-shadow 0.2s",
            animation: "chatBubblePulse 2.2s ease-in-out infinite",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = "scale(1.05)";
            e.currentTarget.style.boxShadow = "0 14px 28px rgba(234, 88, 12, 0.45)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = "scale(1)";
            e.currentTarget.style.boxShadow = "0 10px 22px rgba(234, 88, 12, 0.35)";
          }}
        >
          {isOpen ? <X size={28} /> : <MessageSquare size={28} />}
        </button>

        {fullImageUrl && (
          <div
            onClick={() => setFullImageUrl(null)}
            style={{
              position: "fixed",
              inset: 0,
              background:
                "radial-gradient(circle at 20% 20%, rgba(249, 115, 22, 0.16), transparent 45%), rgba(15, 23, 42, 0.8)",
              backdropFilter: "blur(4px)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 9000,
              padding: "24px",
              pointerEvents: "auto",
            }}
          >
            <div
              onClick={(event) => event.stopPropagation()}
              style={{
                position: "relative",
                maxWidth: "min(980px, 92vw)",
                maxHeight: "min(90vh, 760px)",
                width: "100%",
                height: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "16px",
                background: "linear-gradient(135deg, #0f172a 0%, #111827 100%)",
                borderRadius: "18px",
                boxShadow: "0 25px 60px rgba(15, 23, 42, 0.45)",
                border: "1px solid rgba(148, 163, 184, 0.12)",
              }}
            >
              <button
                type="button"
                onClick={() => setFullImageUrl(null)}
                style={{
                  position: "absolute",
                  top: "12px",
                  right: "12px",
                  width: "38px",
                  height: "38px",
                  borderRadius: "12px",
                  border: "1px solid rgba(248, 250, 252, 0.2)",
                  backgroundColor: "rgba(15, 23, 42, 0.75)",
                  color: "#ffffff",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
                aria-label="Close image preview"
              >
                <X size={18} />
              </button>
              <img
                src={fullImageUrl}
                alt="Preview"
                style={{
                  maxWidth: "100%",
                  maxHeight: "100%",
                  objectFit: "contain",
                  borderRadius: "14px",
                  boxShadow: "0 18px 40px rgba(15, 23, 42, 0.35)",
                  backgroundColor: "#0b1120",
                }}
              />
            </div>
          </div>
        )}

        {/* Animations & Custom Scrollbar Hiding */}
        <style>{`
          @keyframes scaleIn {
            from { opacity: 0; transform: scale(0.95) translateY(10px); }
            to { opacity: 1; transform: scale(1) translateY(0); }
          }
          @keyframes chatBubblePulse {
            0% { transform: scale(1); }
            50% { transform: scale(1.03); }
            100% { transform: scale(1); }
          }
          /* Hide scrollbar for Chrome, Safari and Opera */
          .ysp-no-scrollbar::-webkit-scrollbar {
            display: none;
          }
          /* Hide scrollbar for IE, Edge and Firefox */
          .ysp-no-scrollbar {
            -ms-overflow-style: none;  /* IE and Edge */
            scrollbar-width: none;  /* Firefox */
          }
        `}</style>
      </div>
    );

  if (!mounted) return null;
  if (hidden) return null; // Hide chatbot when in edit mode
  return createPortal(ui, document.body);
};

export default YSPChatBot;



