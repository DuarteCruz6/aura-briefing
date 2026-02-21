import { useState } from "react";
import { MessageSquare, Crown } from "lucide-react";
import { AppSidebar } from "@/components/AppSidebar";
import { useAuth } from "@/hooks/useAuth";
import { TodaysBriefing } from "@/components/TodaysBriefing";
import { BriefingCard, briefings } from "@/components/BriefingCard";
import { AudioPlayer } from "@/components/AudioPlayer";
import { ChatSidebar } from "@/components/ChatSidebar";
import { PremiumBanner } from "@/components/PremiumBanner";

const Index = () => {
  const { user } = useAuth();
  const [chatOpen, setChatOpen] = useState(false);
  const [premiumOpen, setPremiumOpen] = useState(false);

  if (!user) return null;

  return (
    <div className="flex h-screen w-full bg-background overflow-hidden">
      <AppSidebar />

      <main className="flex-1 flex flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto scrollbar-thin pb-4">
          <div className="max-w-3xl mx-auto px-6 py-8">
            {/* Top bar */}
            <div className="flex items-center justify-between mb-8">
              <div>
                <p className="text-sm text-muted-foreground">Wednesday, Feb 21</p>
                <h2 className="font-display text-xl font-semibold text-foreground">Good morning</h2>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPremiumOpen(true)}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary/10 text-primary text-sm font-medium hover:bg-primary/20 transition-colors"
                >
                  <Crown className="w-4 h-4" />
                  Premium
                </button>
                <button
                  onClick={() => setChatOpen(!chatOpen)}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg bg-secondary text-secondary-foreground text-sm font-medium hover:bg-secondary/80 transition-colors"
                >
                  <MessageSquare className="w-4 h-4" />
                  Ask AI
                </button>
              </div>
            </div>

            <TodaysBriefing />

            <div className="space-y-3">
              <h3 className="font-display text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">
                Your Briefings
              </h3>
              {briefings.map((b, i) => (
                <BriefingCard key={b.title} {...b} index={i} />
              ))}
            </div>

            <PremiumBanner showPopup={premiumOpen} onPopupChange={setPremiumOpen} />
          </div>
        </div>
        <AudioPlayer />
      </main>

      <ChatSidebar open={chatOpen} onClose={() => setChatOpen(false)} />
    </div>
  );
};

export default Index;
