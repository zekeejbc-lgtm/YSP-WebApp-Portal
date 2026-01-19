import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Send, MessageSquare, X, Minimize2, Loader2, User } from "lucide-react";
import { searchOfficers } from "../services/gasDirectoryService"; // 👈 ADD THIS

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

// 👇 Add this new interface for the Knowledge Base
interface KBEntry {
  keywords: string[];
  answer: string;
  lookup?: string; // The name to search in the directory
}

// 💡 SUGGESTIONS: Quick reply chips
const SUGGESTIONS = [
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
  "Report Portal Issues"
];

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
    keywords: ["program development", "program dev", "events", "prog dev"],
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

const YSPChatBot: React.FC = () => {
  const [mounted, setMounted] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { id: 1, text: "Hello! I'm the YSP Assistant. How can I help you?", sender: "bot" },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0); // Display number
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
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

  // Reusable function to handle sending messages
  const handleSend = async (text: string) => {
    // 🛑 Block if cooling down or loading
    if (!text.trim() || isLoading || cooldown > 0) return;

    // ⏱️ Start 10-second Cooldown
    const COOLDOWN_SECONDS = 10;
    cooldownEndRef.current = Date.now() + (COOLDOWN_SECONDS * 1000);
    setCooldown(COOLDOWN_SECONDS);

    const userMsg: Message = { id: Date.now(), text, sender: "user" };
    setMessages((prev) => [...prev, userMsg]);
    setIsLoading(true);

    // ⚡️ PRIORITY CHECK: LOCAL KNOWLEDGE BASE
    const localMatch = findLocalAnswer(text);

    if (localMatch) {
      let imageUrl: string | undefined = undefined;

      // 👇 New Logic: Check if we need to fetch an image
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
            image: imageUrl // 👈 Attach the image
        };
        setMessages((prev) => [...prev, botMsg]);
        setIsLoading(false);
      }, imageUrl ? 1000 : 600); // Wait a bit longer if loading an image
      
      return; 
    }

    // 🌐 FALLBACK: Call External API if no local match found
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

      if (!reply.trim()) reply = "I'm not sure about that. Try asking about the 'Founder', 'Membership', or 'Projects'.";

      const botMsg: Message = { id: Date.now() + 1, text: reply, sender: "bot" };
      setMessages((prev) => [...prev, botMsg]);
    } catch (err) {
      console.error(err);
      setMessages((prev) => [
        ...prev,
        { id: Date.now() + 2, text: "⚠️ Network Error. I couldn't reach the server.", sender: "bot" },
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

  const ui = useMemo(() => {
    return (
      <div
        className="font-sans"
        style={{
          position: "fixed",
          bottom: "20px",
          right: "20px",
          zIndex: 2147483647,
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
                          alt="Officer" 
                          style={{ width: "100%", height: "100%", objectFit: "cover" }}
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
            {SUGGESTIONS.map((suggestion, idx) => (
              <button
                key={idx}
                onClick={() => handleSend(suggestion)}
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
}, [isOpen, isLoading, input, messages, cooldown]); // ✅ Add cooldown here

  if (!mounted) return null;
  return createPortal(ui, document.body);
};

export default YSPChatBot;