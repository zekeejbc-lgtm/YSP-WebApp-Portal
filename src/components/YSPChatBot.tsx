import React, { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Send, MessageSquare, X, Minimize2, Loader2, User } from "lucide-react";

// ✅ YOUR API KEY
const API_URL =
  "https://script.google.com/macros/s/AKfycbxBc_bEYUCdt71zuUZouXmhvhOilUBSgI0PymwzUqI9URanSF6U7UEKN_ziHQ_s9gLRcQ/exec";

type Sender = "user" | "bot";

interface Message {
  id: number;
  text: string;
  sender: Sender;
}

const YSPChatBot: React.FC = () => {
  const [mounted, setMounted] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { id: 1, text: "Hello! I'm the YSP Assistant. How can I help you?", sender: "bot" },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

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

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userText = input.trim();
    const userMsg: Message = { id: Date.now(), text: userText, sender: "user" };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsLoading(true);

    try {
      const res = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({ message: userText }),
      });

      const raw = await res.text();
      let reply = "";
      try {
        const parsed = JSON.parse(raw);
        reply = typeof parsed?.reply === "string" ? parsed.reply : "";
      } catch {
        reply = raw;
      }

      if (!reply.trim()) reply = "Sorry, I didn’t get a valid response.";

      const botMsg: Message = { id: Date.now() + 1, text: reply, sender: "bot" };
      setMessages((prev) => [...prev, botMsg]);
    } catch (err) {
      console.error(err);
      setMessages((prev) => [
        ...prev,
        { id: Date.now() + 2, text: "⚠️ Network Error. Try again.", sender: "bot" },
      ]);
    } finally {
      setIsLoading(false);
    }
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
              <span style={{ fontWeight: "bold", fontSize: "16px", lineHeight: "1.2" }}>
                KaagapAI
              </span>
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

                  {/* Message Bubble */}
                  <div
                    style={{
                      maxWidth: "75%",
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
                    {msg.text}
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
              placeholder="Ask YSP something..."
              style={{
                flex: 1,
                border: "1px solid #e5e7eb",
                borderRadius: "24px",
                padding: "10px 16px",
                outline: "none",
                fontSize: "14px",
                color: "#1f2937",
                backgroundColor: "#f9fafb",
                transition: "border-color 0.2s",
              }}
              onFocus={(e) => (e.target.style.borderColor = "#ea580c")}
              onBlur={(e) => (e.target.style.borderColor = "#e5e7eb")}
            />
            <button
              type="submit"
              disabled={isLoading}
              style={{
                width: "42px",
                height: "42px",
                borderRadius: "50%",
                border: "none",
                cursor: isLoading ? "default" : "pointer",
                backgroundColor: "#ea580c",
                color: "#ffffff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                opacity: isLoading ? 0.7 : 1,
                flexShrink: 0,
                boxShadow: "0 2px 6px rgba(234, 88, 12, 0.3)",
                transition: "transform 0.1s",
              }}
              onMouseDown={(e) => (e.currentTarget.style.transform = "scale(0.95)")}
              onMouseUp={(e) => (e.currentTarget.style.transform = "scale(1)")}
            >
              <Send size={18} />
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

        {/* Animations */}
        <style>{`
          @keyframes scaleIn {
            from { opacity: 0; transform: scale(0.95) translateY(10px); }
            to { opacity: 1; transform: scale(1) translateY(0); }
          }
        `}</style>
      </div>
    );
  }, [isOpen, isLoading, input, messages]);

  if (!mounted) return null;
  return createPortal(ui, document.body);
};

export default YSPChatBot;