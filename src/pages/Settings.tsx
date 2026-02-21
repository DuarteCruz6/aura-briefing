import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { AppSidebar } from "../components/AppSidebar";
import { useAuth } from "../hooks/useAuth";
import { api } from "../lib/api";
import { ArrowLeft, Check, Loader2, Wifi, WifiOff } from "lucide-react";

const briefingLengths = [
  { value: 3, label: "3 min", desc: "Quick headlines" },
  { value: 7, label: "7 min", desc: "Key stories" },
  { value: 12, label: "12 min", desc: "Deep dive" },
];
const briefingFrequencies = [
  { value: "daily", label: "Daily", desc: "Every morning" },
  { value: "weekly", label: "Weekly", desc: "Monday digest" },
  { value: "monthly", label: "Monthly", desc: "Monthly recap" },
];
const voiceStyles = [
  { value: "professional", label: "Professional", desc: "Calm and authoritative" },
  { value: "conversational", label: "Conversational", desc: "Friendly and casual" },
  { value: "energetic", label: "Energetic", desc: "Upbeat and dynamic" },
  { value: "minimal", label: "Minimal", desc: "Just the facts" },
];

const Settings = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [briefingLength, setBriefingLength] = useState(7);
  const [voiceStyle, setVoiceStyle] = useState("professional");
  const [frequency, setFrequency] = useState(() => localStorage.getItem("briefcast_frequency") || "daily");
  const [backendOk, setBackendOk] = useState<boolean | null>(null);

  useEffect(() => {
    api
      .getHealth()
      .then(() => setBackendOk(true))
      .catch(() => setBackendOk(false));
  }, []);

  if (!user) return null;

  return (
    <div className="flex h-screen w-full bg-background overflow-hidden">
      <AppSidebar activePage="settings" />
      <main className="flex-1 overflow-y-auto scrollbar-thin pb-24">
        <div className="max-w-2xl mx-auto px-6 py-8">
          <button onClick={() => navigate("/")} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6">
            <ArrowLeft className="w-4 h-4" /> Back to Home
          </button>

          <h1 className="font-display text-2xl font-bold text-foreground mb-1">Profile & Settings</h1>
          <p className="text-sm text-muted-foreground mb-8">Customize your briefing experience</p>

          {/* Backend status */}
          <Section title="Backend">
            <div className="flex items-center gap-2 text-sm">
              {backendOk === null ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                  <span className="text-muted-foreground">Checking connection…</span>
                </>
              ) : backendOk ? (
                <>
                  <Wifi className="w-4 h-4 text-green-500" />
                  <span className="text-foreground">Connected to backend</span>
                </>
              ) : (
                <>
                  <WifiOff className="w-4 h-4 text-destructive" />
                  <span className="text-muted-foreground">Backend unreachable (is it running on port 8000?)</span>
                </>
              )}
            </div>
          </Section>

          {/* Profile */}
          <Section title="Profile">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-14 h-14 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center text-primary font-display font-bold text-xl">
                {user.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="font-medium text-foreground">{user.name}</p>
                <p className="text-sm text-muted-foreground">{user.email}</p>
              </div>
            </div>
            <button
              onClick={logout}
              className="text-sm text-destructive hover:text-destructive/80 transition-colors"
            >
              Log out
            </button>
          </Section>

          {/* Briefing Length */}
          <Section title="Briefing Length">
            <div className="grid grid-cols-3 gap-3">
              {briefingLengths.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setBriefingLength(opt.value)}
                  className={`glass-panel rounded-xl p-4 text-center transition-all border ${
                    briefingLength === opt.value
                      ? "border-primary/50 bg-primary/10"
                      : "border-white/[0.06] hover:border-white/[0.12]"
                  }`}
                >
                  <p className="font-display font-bold text-lg text-foreground">{opt.label}</p>
                  <p className="text-xs text-muted-foreground mt-1">{opt.desc}</p>
                </button>
              ))}
            </div>
          </Section>

          {/* Briefing Frequency */}
          <Section title="Briefing Frequency">
            <div className="grid grid-cols-3 gap-3">
              {briefingFrequencies.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => { setFrequency(opt.value); localStorage.setItem("briefcast_frequency", opt.value); }}
                  className={`glass-panel rounded-xl p-4 text-center transition-all border ${
                    frequency === opt.value
                      ? "border-primary/50 bg-primary/10"
                      : "border-white/[0.06] hover:border-white/[0.12]"
                  }`}
                >
                  <p className="font-display font-bold text-lg text-foreground">{opt.label}</p>
                  <p className="text-xs text-muted-foreground mt-1">{opt.desc}</p>
                </button>
              ))}
            </div>
          </Section>

          {/* Voice Style */}
          <Section title="Voice Style">
            <div className="grid grid-cols-2 gap-3">
              {voiceStyles.map((v) => (
                <button
                  key={v.value}
                  onClick={() => setVoiceStyle(v.value)}
                  className={`glass-panel rounded-xl p-4 text-left transition-all border flex items-start gap-3 ${
                    voiceStyle === v.value
                      ? "border-primary/50 bg-primary/10"
                      : "border-white/[0.06] hover:border-white/[0.12]"
                  }`}
                >
                  <div className="flex-1">
                    <p className="font-medium text-foreground text-sm">{v.label}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{v.desc}</p>
                  </div>
                  {voiceStyle === v.value && <Check className="w-4 h-4 text-primary mt-0.5" />}
                </button>
              ))}
            </div>
          </Section>
        </div>
      </main>
    </div>
  );
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-8"
    >
      <h2 className="font-display text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">{title}</h2>
      {children}
    </motion.section>
  );
}

function Chip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all border ${
        active
          ? "bg-primary/15 border-primary/40 text-primary"
          : "bg-white/[0.04] border-white/[0.08] text-muted-foreground hover:text-foreground hover:border-white/[0.15]"
      }`}
    >
      {label}
    </button>
  );
}

export default Settings;
