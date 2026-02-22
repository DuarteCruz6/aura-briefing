import { Toaster } from "./components/ui/toaster";
import { Toaster as Sonner } from "./components/ui/sonner";
import { TooltipProvider } from "./components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Settings from "./pages/Settings";
import Explore from "./pages/Explore";
import Bookmarks from "./pages/Bookmarks";
import Favourites from "./pages/Favourites";
import NotFound from "./pages/NotFound";
import { MobileNav } from "./components/MobileNav";
import { ChatSidebar } from "./components/ChatSidebar";
import { ChatProvider, useChat } from "./contexts/ChatContext";

const queryClient = new QueryClient();

function ChatSidebarGate() {
  const { chatOpen, setChatOpen } = useChat();
  return <ChatSidebar open={chatOpen} onClose={() => setChatOpen(false)} />;
}

function AnimatedRoutes() {
  const location = useLocation();
  return (
    <>
      <AnimatePresence mode="wait">
        <Routes location={location} key={location.pathname}>
          <Route path="/" element={<Index />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/explore" element={<Explore />} />
          <Route path="/favourites" element={<Favourites />} />
          <Route path="/bookmarks" element={<Bookmarks />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </AnimatePresence>
      <MobileNav />
      <ChatSidebarGate />
    </>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <ChatProvider>
          <AnimatedRoutes />
        </ChatProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
