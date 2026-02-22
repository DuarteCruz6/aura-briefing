import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  sources?: string[];
}

const initialMessages: ChatMessage[] = [
  {
    role: "assistant",
    content: "I'm your briefing assistant. Ask me anything about today's stories — I'll provide context and sources.",
  },
];

interface ChatContextValue {
  messages: ChatMessage[];
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  chatOpen: boolean;
  setChatOpen: (open: boolean) => void;
}

const ChatContext = createContext<ChatContextValue | null>(null);

export function ChatProvider({ children }: { children: ReactNode }) {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [chatOpen, setChatOpen] = useState(false);
  const setOpen = useCallback((open: boolean) => setChatOpen(open), []);

  return (
    <ChatContext.Provider
      value={{
        messages,
        setMessages,
        chatOpen,
        setChatOpen: setOpen,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
}

export function useChat() {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error("useChat must be used within ChatProvider");
  return ctx;
}
