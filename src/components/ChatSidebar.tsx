import { Send, X, ExternalLink, Loader2 } from "lucide-react";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import logo from "../assets/logo.png";
import { api } from "../lib/api";

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

function isUrl(text: string): boolean {
  const t = text.trim();
  return t.startsWith("http://") || t.startsWith("https://");
}

function formatSummary(summary: unknown): string {
  if (summary == null) return "No summary available.";
  if (typeof summary === "string") return summary;
  if (typeof summary === "object" && summary !== null) {
    const o = summary as Record<string, unknown>;
    const parts: string[] = [];
    if (typeof o.title === "string") parts.push(o.title);
    if (typeof o.channel === "string") parts.push(`Channel: ${o.channel}`);
    if (typeof o.description === "string" && o.description) parts.push(o.description);
    if (typeof o.text === "string" && o.text) parts.push(o.text);
    if (typeof o.summary === "string") parts.push(o.summary);
    if (parts.length) return parts.join("\n\n");
  }
  return JSON.stringify(summary);
}

// Thinking/waveform animation
function ThinkingAnimation() {
  return (
    <div className="flex justify-start">
      <div className="max-w-[85%] rounded-xl px-3.5 py-3 bg-secondary text-secondary-foreground">
        <div className="flex items-center gap-1.5 h-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <motion.div
              key={i}
              animate={{ scaleY: [1, 2.5, 1], opacity: [0.4, 1, 0.4] }}
              transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.1, ease: "easeInOut" }}
              className="w-[3px] h-3 rounded-full bg-primary"
            />
          ))}
          <span className="text-xs text-muted-foreground ml-2">Analyzing…</span>
        </div>
      </div>
    </div>
  );
}

export function ChatSidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSend = async () => {
    const text = input.trim();
    if (!text) return;
    const userMsg: Message = { role: "user", content: text };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");

    if (isUrl(text)) {
      setLoading(true);
      try {
        const { source_url, summary } = await api.getOrExtractSummary(text);
        const content = formatSummary(summary);
        const sourceHost = source_url ? new URL(source_url).hostname : undefined;
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content,
            sources: source_url ? [source_url] : sourceHost ? [sourceHost] : undefined,
          },
        ]);
      } catch (err) {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: err instanceof Error ? err.message : "Failed to get summary for this URL." },
        ]);
      } finally {
        setLoading(false);
      }
      return;
    }

    setLoading(true);
    try {
      const { content } = await api.chat([...messages, userMsg]);
      setMessages((prev) => [...prev, { role: "assistant", content }]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: err instanceof Error ? err.message : "Something went wrong. Please try again.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.aside
          initial={{ width: 0, opacity: 0 }}
          animate={{ width: 380, opacity: 1 }}
          exit={{ width: 0, opacity: 0 }}
          transition={{ duration: 0.3, ease: "easeInOut" }}
          className="h-full border-l border-border/50 bg-sidebar/80 backdrop-blur-xl flex flex-col overflow-hidden flex-shrink-0"
        >
          {/* Header */}
          <div className="px-4 py-4 border-b border-border/50 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <img src={logo} alt="Unscrolling" className="w-5 h-5 object-contain" />
              <span className="font-display font-semibold text-sm text-foreground">Ask Unscrolling</span>
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
                          href={s.startsWith("http") ? s : `https://${s}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-xs text-primary hover:underline"
                        >
                          <ExternalLink className="w-3 h-3" />
                          {s.startsWith("http") ? new URL(s).hostname : s}
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              </motion.div>
            ))}
            {loading && <ThinkingAnimation />}
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
                disabled={loading}
                className="text-primary hover:text-primary/80 transition-colors disabled:opacity-50"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
