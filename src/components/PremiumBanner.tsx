import { Crown, Video, Sparkles, Check, X, Zap } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import { toast } from "@/hooks/use-toast";

interface PremiumBannerProps {
  showPopup: boolean;
  onPopupChange: (open: boolean) => void;
}

export function PremiumBanner({ showPopup, onPopupChange }: PremiumBannerProps) {
  const [trialStarted, setTrialStarted] = useState(() => {
    return localStorage.getItem("briefcast_trial") === "active";
  });

  const handleStartTrial = () => {
    localStorage.setItem("briefcast_trial", "active");
    localStorage.setItem("briefcast_trial_start", new Date().toISOString());
    setTrialStarted(true);
    toast({ title: "🎉 Trial Activated!", description: "You now have 7 days of Premium access. Enjoy!" });
    onPopupChange(false);
  };

  const [buyLoading, setBuyLoading] = useState(false);

  const handleBuyNow = async () => {
    setBuyLoading(true);
    toast({ title: "💳 Creating subscription…", description: "Connecting to Stripe…" });

    try {
      const res = await fetch("https://api.stripe.com/v1/subscription_schedules", {
        method: "POST",
        headers: {
          "Authorization": "Basic " + btoa("sk_test_51LHrRJSF15KCJB9H9jwN566bkeX4CBfZcgDCNfz6IKl9TgsEapwawQyefdKS1bnrrb5buK88tL7zruiugLykR4gO00qnef4fve:"),
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          "end_behavior": "cancel",
          "phases[0][currency]": "eur",
          "phases[0][items][0][price]": "price_1T3IWkSF15KCJB9HDzc1SvGh",
          "phases[0][items][0][quantity]": "1",
          "phases[0][iterations]": "12",
          "phases[0][proration_behavior]": "none",
          "start_date": "1772303400",
        }),
      });

      const data = await res.json();

      if (res.ok) {
        localStorage.setItem("briefcast_trial", "active");
        setTrialStarted(true);
        toast({ title: "✅ Premium Unlocked!", description: `Subscription scheduled! ID: ${data.id}` });
        onPopupChange(false);
      } else {
        toast({ title: "⚠️ Stripe Error", description: data.error?.message || "Something went wrong." });
      }
    } catch (err) {
      toast({ title: "❌ Network Error", description: "Could not reach Stripe. Try again." });
    } finally {
      setBuyLoading(false);
    }
  };

  return (
    <>
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.5 }}
        className="glass-panel p-6 mt-8 relative overflow-hidden cursor-pointer group"
        onClick={() => onPopupChange(true)}
      >
        {/* Animated gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-r from-primary/10 via-accent/5 to-primary/10 pointer-events-none group-hover:from-primary/20 group-hover:to-primary/20 transition-all duration-500" />
        
        <div className="relative flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-primary/15 flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform duration-300">
            <Video className="w-7 h-7 text-primary" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <Sparkles className="w-4 h-4 text-primary animate-pulse" />
              <span className="text-xs font-bold text-primary uppercase tracking-wider">New — AI Video</span>
            </div>
            <h3 className="font-display text-lg font-bold text-foreground">Turn Your Briefing Into a Video</h3>
            <p className="text-sm text-muted-foreground">One tap. Cinematic visuals, charts & motion graphics — generated in seconds.</p>
          </div>
          <motion.div
            animate={{ x: [0, 6, 0] }}
            transition={{ repeat: Infinity, duration: 1.5 }}
            className="text-primary font-semibold text-sm whitespace-nowrap"
          >
            Try Free →
          </motion.div>
        </div>
      </motion.section>

      {/* Premium Popup */}
      <AnimatePresence>
        {showPopup && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
            onClick={() => onPopupChange(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="relative w-full max-w-md mx-4 rounded-2xl bg-card border border-border p-8 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => onPopupChange(false)}
                className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="text-center mb-6">
                <div className="w-16 h-16 rounded-2xl bg-primary/15 flex items-center justify-center mx-auto mb-4">
                  <Crown className="w-8 h-8 text-primary" />
                </div>
                <h2 className="font-display text-2xl font-bold text-foreground mb-1">Go Premium</h2>
                <p className="text-muted-foreground text-sm">Unlock AI video briefings & more</p>
              </div>

              <div className="space-y-3 mb-6">
                {[
                  "AI-generated video briefings",
                  "Cinematic visuals & motion graphics",
                  "Vertical & landscape formats",
                  "Priority audio generation",
                  "Unlimited bookmarks",
                ].map((feature) => (
                  <div key={feature} className="flex items-center gap-3">
                    <div className="w-5 h-5 rounded-full bg-primary/15 flex items-center justify-center flex-shrink-0">
                      <Check className="w-3 h-3 text-primary" />
                    </div>
                    <span className="text-sm text-foreground">{feature}</span>
                  </div>
                ))}
              </div>

              <div className="bg-secondary/50 rounded-xl p-4 mb-6 text-center">
                <p className="text-xs text-muted-foreground mb-1">7 days free, then</p>
                <div className="flex items-baseline justify-center gap-1">
                  <span className="font-display text-3xl font-bold text-foreground">€10</span>
                  <span className="text-muted-foreground text-sm">/month</span>
                </div>
              </div>

              <button
                onClick={handleStartTrial}
                disabled={trialStarted}
                className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                {trialStarted ? "✓ Trial Active" : "Start 7-Day Free Trial"}
              </button>

              <button
                onClick={handleBuyNow}
                disabled={buyLoading}
                className="w-full py-3 rounded-xl bg-accent text-accent-foreground font-semibold text-sm hover:bg-accent/80 transition-colors flex items-center justify-center gap-2 mt-2 disabled:opacity-50"
              >
                <Zap className="w-4 h-4" />
                {buyLoading ? "Processing…" : "Buy Now — €10/mo"}
              </button>
              <p className="text-xs text-muted-foreground text-center mt-3">Cancel anytime. No charge during trial.</p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
