import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Send, MessageSquare, X, Minimize2, Loader2, User } from "lucide-react";
import { getAllOfficers, searchOfficers, type DirectoryOfficer } from "../services/gasDirectoryService";
import { fetchEvents, formatEventDate } from "../services/gasEventsService";
import { fetchAllProjects } from "../services/projectsService";
// ✅ YOUR API KEY
const API_URL =
  "https://script.google.com/macros/s/AKfycbxBc_bEYUCdt71zuUZouXmhvhOilUBSgI0PymwzUqI9URanSF6U7UEKN_ziHQ_s9gLRcQ/exec";

type Sender = "user" | "bot";

interface Message {
  id: number;
  text: string;
  sender: Sender;
  image?: string;
}

interface YSPChatBotProps {
  userRole?: string;
  orgChartUrl?: string;
  onOfficerDirectorySearch?: (request: { query: string; idCode?: string }) => void;
  onRequestCacheClear?: () => void;
  currentPage?: string;
}

// 👇 Add this new interface for the Knowledge Base
interface KBEntry {
  keywords: string[];
  answer: string;
  lookup?: string; // The name to search in the directory
}

// 💡 SUGGESTIONS: Quick reply chips
const BASE_SUGGESTIONS = [
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

const SUGGESTIONS = BASE_SUGGESTIONS;

// 🗄️ EXTENSIVE LOCAL KNOWLEDGE BASE
// The bot checks this FIRST. If a match is found, it skips the API.
const LOCAL_KNOWLEDGE_BASE = [
  // --- LEADERSHIP & ABOUT ---
  {
    keywords: ["founder", "who created", "wacky", "father of ysp", "head"],
    answer: "The founder of YSP Tagum Chapter is Juanquine Carlo R. Castro, also known as 'Wacky Racho'."
  },
  {
    keywords: ["chairman", "chapter president", "current leader"],
    answer: "The current Chapter President of YSP Tagum is Mr. Jhonas Untalan.",
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
    answer: "The developer of this Portal is Mr. Ezequiel John B. Crisostomo, the current Membership and Internal Affairs of YSP Tagum Chapter. You may contact him via facebook: https://www.facebook.com/ezequieljohn.bengilcrisostomo",
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
    answer: "Current YSP Tagum Officers:\n• Chapter President: Jhonas Untalan\n• Membership and Internal Affairs Officer: Ezequiel John B. Crisostomo\n• External Relations Officer: Ian Ghabriel L. Navarro\n• Secretary and Documentation Officer: Yhana Bea Baliwan\n• Finance and Treasury Officer: Crystal Nice P. Tano\n• Communications and Marketing Officer: Russel T. Obreque\n• Program Development Officer: Valerie B. Cabualan"
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
    answer: "Membership is open for ALL youth in Tagum City. To join, click the 'Be a Member!' button on the home page."
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
  return `Error code: ${errorCode}. Please ask the developer for fixing this problem. I am currently experiencing fluctuations, please chuchu.`;
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

function formatOfficerDetails(officer: DirectoryOfficer): string {
  const lines: string[] = [];
  const addLine = (label: string, value?: string | number) => {
    if (value === undefined || value === null) return;
    const cleaned = String(value).trim();
    if (!cleaned) return;
    lines.push(`${label}: ${cleaned}`);
  };

  addLine("Name", officer.fullName);
  addLine("ID Code", officer.idCode);
  addLine("Position", officer.position);
  addLine("Committee", officer.committee);
  addLine("Role", officer.role);
  addLine("Status", officer.status);
  addLine("Chapter", officer.chapter);
  addLine("Date Joined", officer.dateJoined);
  addLine("Membership Type", officer.membershipType);
  addLine("Email", officer.email);
  if (officer.personalEmail && officer.personalEmail !== officer.email) {
    addLine("Personal Email", officer.personalEmail);
  }
  addLine("Contact", officer.contactNumber);
  addLine("Birthday", officer.birthday);
  addLine("Age", officer.age);
  addLine("Gender", officer.gender);
  addLine("Pronouns", officer.pronouns);
  addLine("Civil Status", officer.civilStatus);
  addLine("Nationality", officer.nationality);
  addLine("Religion", officer.religion);
  addLine("Emergency Contact Name", officer.emergencyContactName);
  addLine("Emergency Contact Relation", officer.emergencyContactRelation);
  addLine("Emergency Contact Number", officer.emergencyContactNumber);
  addLine("Facebook", officer.facebook);
  addLine("Instagram", officer.instagram);
  addLine("Twitter", officer.twitter);

  return lines.length > 0 ? lines.join("\n") : "No additional details available.";
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
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const directoryAnalyticsCacheRef = useRef<{ timestamp: number; officers: DirectoryOfficer[] } | null>(null);
  const cooldownEndRef = useRef<number>(0); // 👈 Tracks real time

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

  const getCachedOfficersFromStorage = (): DirectoryOfficer[] | null => {
    const storages = [sessionStorage, localStorage];
    let bestTimestamp = 0;
    let bestOfficers: DirectoryOfficer[] | null = null;

    for (const storage of storages) {
      try {
        for (let i = 0; i < storage.length; i++) {
          const key = storage.key(i);
          if (!key || !key.startsWith("ysp_directory_cache_all_")) continue;
          const raw = storage.getItem(key);
          if (!raw) continue;
          const parsed = JSON.parse(raw) as { data?: { officers?: DirectoryOfficer[] }; timestamp?: number };
          const officers = parsed.data?.officers;
          const timestamp = parsed.timestamp || 0;
          if (officers && timestamp > bestTimestamp) {
            bestTimestamp = timestamp;
            bestOfficers = officers;
          }
        }
      } catch {
        // Ignore storage read errors
      }
    }

    return bestOfficers;
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

  const loadAllOfficersForAnalytics = async (): Promise<DirectoryOfficer[]> => {
    const cache = directoryAnalyticsCacheRef.current;
    const cacheMs = 2 * 60 * 1000;
    if (cache && Date.now() - cache.timestamp < cacheMs) {
      return cache.officers;
    }

    const cachedOfficers = getCachedOfficersFromStorage();
    if (cachedOfficers && cachedOfficers.length > 0) {
      directoryAnalyticsCacheRef.current = { timestamp: Date.now(), officers: cachedOfficers };
      return cachedOfficers;
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
    const isMembersCommandAllowed =
      pageKey === "officer-directory" || pageKey === "manage-members";

    if (/^@clear\b/i.test(workingText) || /^@clear chat history\b/i.test(workingText)) {
      setMessages([{ id: Date.now(), text: "Hello! I'm the YSP Assistant. How can I help you?", sender: "bot" }]);
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

    if (membersCommandActive && !/^@members\b/i.test(workingText)) {
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
              const genderValue = (officer.gender || "").toLowerCase();
              if (!genderValue) return false;
              if (genderKey === "female") {
                return genderValue.includes("female") || genderValue === "f";
              }
              return genderValue.includes("male") || genderValue === "m";
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
    if (analyticsQuery) {
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
        const officers = await loadAllOfficersForAnalytics();

        if (analyticsQuery.type === "gender" && analyticsQuery.gender) {
          const genderKey = analyticsQuery.gender;
          const matches = officers.filter((officer) => {
            const genderValue = (officer.gender || "").toLowerCase();
            if (!genderValue) return false;
            if (genderKey === "female") {
              return genderValue.includes("female") || genderValue === "f";
            }
            return genderValue.includes("male") || genderValue === "m";
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

    if (isExecutiveBoardQuery(normalized)) {
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

    if (isDirectoryIntent(normalized)) {
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
    if (eventQuery) {
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

    if (isProjectsQuery(normalized)) {
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

    const localMatch = findLocalAnswer(text);
    if (localMatch) {
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

      setTimeout(() => {
        const botMsg: Message = {
          id: Date.now() + 1,
          text: localMatch.answer,
          sender: "bot",
          image: imageUrl,
        };
        setMessages((prev) => [...prev, botMsg]);
        setIsLoading(false);
      }, imageUrl ? 1000 : 600);

      return;
    }

    try {
      const res = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({ message: text }),
      });

      const raw = await res.text();
      let reply = "";
      try {
        const parsed = JSON.parse(raw);
        reply = typeof parsed?.reply === "string" ? parsed.reply : "";
      } catch {
        reply = raw;
      }

      if (!reply.trim()) reply = CLARIFYING_FALLBACK;

      const botMsg: Message = { id: Date.now() + 1, text: reply, sender: "bot" };
      setMessages((prev) => [...prev, botMsg]);
    } catch (err) {
      console.error("Chatbot API error:", err);
      setMessages((prev) => [
        ...prev,
        { id: Date.now() + 1, text: buildErrorMessage("500"), sender: "bot" },
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
    // Split text by URLs or Emails (including + signs)
    const regex = /((?:https?:\/\/[^\s]+)|(?:[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}))/g;

    return text.split(regex).map((part, i) => {
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
            href={`mailto:${part}`}
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
    const role = userRole.toLowerCase();
    const isPrivileged = role === "auditor" || role === "admin";

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

  const ui = useMemo(() => {
    return (
      <div
        className="font-sans"
        style={{
          position: "fixed",
          bottom: "20px",
          right: "20px",
          zIndex: 9999990,
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
            backgroundColor: "#ffffff",
            border: "1px solid #e5e7eb",
            borderRadius: "16px",
            overflow: "hidden",
            boxShadow: "0 10px 40px -10px rgba(0,0,0,0.2)",
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
              backgroundColor: "#f9fafb",
              display: "flex",
              flexDirection: "column",
              gap: "16px",
            }}
          >
            {messages.map((msg) => {
              const isUser = msg.sender === "user";
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
                        backgroundColor: "#ffffff",
                        flexShrink: 0,
                        border: "1px solid #e5e7eb",
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
                        backgroundColor: "#f3f4f6",
                        border: "1px solid #e5e7eb",
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
                        backgroundColor: isUser ? "#ea580c" : "#ffffff",
                        color: isUser ? "#ffffff" : "#1f2937",
                        border: isUser ? "none" : "1px solid #e5e7eb",
                        boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
                        wordBreak: "break-word",
                        overflowWrap: "anywhere",
                        whiteSpace: "pre-wrap",
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
                    backgroundColor: "#ffffff",
                    border: "1px solid #e5e7eb",
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
                    backgroundColor: "#ffffff",
                    border: "1px solid #e5e7eb",
                    padding: "10px 14px",
                    borderRadius: "18px",
                    borderTopLeftRadius: "4px",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                  }}
                >
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-orange-600" />
                  <span style={{ fontSize: "12px", color: "#6b7280" }}>Thinking...</span>
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
                backgroundColor: "#f9fafb", // matches message area bg
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
                  border: "1px solid #e5e7eb",
                  backgroundColor: "#ffffff",
                  color: "#4b5563",
                  fontSize: "12px",
                  fontWeight: "500",
                  cursor: isLoading ? "default" : "pointer",
                  transition: "all 0.2s",
                  boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
                  flexShrink: 0,
                }}
                onMouseEnter={(e) => {
                   if (!isLoading) {
                     e.currentTarget.style.backgroundColor = "#f3f4f6";
                     e.currentTarget.style.borderColor = "#d1d5db";
                   }
                }}
                onMouseLeave={(e) => {
                   if (!isLoading) {
                     e.currentTarget.style.backgroundColor = "#ffffff";
                     e.currentTarget.style.borderColor = "#e5e7eb";
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
              borderTop: "1px solid #e5e7eb",
              backgroundColor: "#ffffff",
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
                border: "1px solid #e5e7eb",
                borderRadius: "24px",
                padding: "10px 16px",
                outline: "none",
                fontSize: "14px",
                color: "#1f2937",
                // Change background if cooling down
                backgroundColor: cooldown > 0 ? "#f3f4f6" : "#f9fafb", 
                transition: "all 0.2s",
                cursor: cooldown > 0 ? "not-allowed" : "text"
              }}
              onFocus={(e) => {
                if (cooldown === 0) e.target.style.borderColor = "#ea580c";
              }}
              onBlur={(e) => (e.target.style.borderColor = "#e5e7eb")}
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
            border: "none",
            cursor: "pointer",
            background: "linear-gradient(135deg, #f6421f 0%, #ee8724 100%)",
            color: "#ffffff",
            boxShadow: "0 4px 14px rgba(246, 66, 31, 0.4)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            pointerEvents: "auto",
            transition: "transform 0.2s, box-shadow 0.2s",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = "scale(1.05)";
            e.currentTarget.style.boxShadow = "0 6px 20px rgba(246, 66, 31, 0.5)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = "scale(1)";
            e.currentTarget.style.boxShadow = "0 4px 14px rgba(246, 66, 31, 0.4)";
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
              zIndex: 9999990,
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
}, [isOpen, isLoading, input, messages, cooldown, fullImageUrl, suggestionList]); // ✅ Add cooldown here

  if (!mounted) return null;
  return createPortal(ui, document.body);
};

export default YSPChatBot;



