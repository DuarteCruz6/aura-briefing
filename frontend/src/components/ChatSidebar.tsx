import { Send, X, ExternalLink } from "lucide-react";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import logo from "@/assets/logo.png";

interface Message {
  role: "user" | "assistant";
  content: string;
  sources?: string[];
}

const initialMessages: Message[] = [
  {
    role: "assistant",
    content: "I'm your briefing assistant. Ask me anything about today's stories — I'll provide context and sources.",
  },
];

export function ChatSidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [input, setInput] = useState("");

  const handleSend = () => {
    if (!input.trim()) return;
    const userMsg: Message = { role: "user", content: input };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");

    // Simulated response
    setTimeout(() => {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `Based on today's briefing, here's what I found about "${input}". The latest data suggests significant developments in this area with multiple sources confirming the trend.`,
          sources: ["reuters.com", "ft.com", "arxiv.org"],
        },
      ]);
    }, 800);
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.aside
          initial={{ width: 0, opacity: 0 }}
          animate={{ width: 380, opacity: 1 }}
          exit={{ width: 0, opacity: 0 }}
          transition={{ duration: 0.3, ease: "easeInOut" }}
          className="h-full border-l border-border/50 bg-sidebar flex flex-col overflow-hidden flex-shrink-0"
        >
          {/* Header */}
          <div className="px-4 py-4 border-b border-border/50 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <img src={logo} alt="Briefcast" className="w-5 h-5 object-contain" />
              <span className="font-display font-semibold text-sm text-foreground">Ask Briefcast</span>
            </div>
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto scrollbar-thin p-4 space-y-4">
            {messages.map((msg, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] rounded-xl px-3.5 py-2.5 text-sm ${
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary text-secondary-foreground"
                  }`}
                >
                  <p>{msg.content}</p>
                  {msg.sources && (
                    <div className="mt-2 pt-2 border-t border-border/30 space-y-1">
                      {msg.sources.map((s) => (
                        <a
                          key={s}
                          href="#"
                          className="flex items-center gap-1 text-xs text-primary hover:underline"
                        >
                          <ExternalLink className="w-3 h-3" />
                          {s}
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              </motion.div>
            ))}
          </div>

          {/* Input */}
          <div className="p-3 border-t border-border/50">
            <div className="flex items-center gap-2 bg-secondary rounded-xl px-3 py-2">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSend()}
                placeholder="Ask about today's briefing..."
                className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
              />
              <button
                onClick={handleSend}
                className="text-primary hover:text-primary/80 transition-colors"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
