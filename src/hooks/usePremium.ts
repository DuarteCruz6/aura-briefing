import { useState, useCallback } from "react";

const PREMIUM_KEY = "briefcast_premium";

interface PremiumState {
  isPremium: boolean;
  trialStartedAt: string | null;
}

function getPremiumState(): PremiumState {
  const stored = localStorage.getItem(PREMIUM_KEY);
  if (!stored) return { isPremium: false, trialStartedAt: null };
  const parsed = JSON.parse(stored) as PremiumState;
  
  // Check if trial has expired (7 days)
  if (parsed.trialStartedAt && !parsed.isPremium) {
    const trialStart = new Date(parsed.trialStartedAt).getTime();
    const now = Date.now();
    const sevenDays = 7 * 24 * 60 * 60 * 1000;
    if (now - trialStart > sevenDays) {
      localStorage.removeItem(PREMIUM_KEY);
      return { isPremium: false, trialStartedAt: null };
    }
  }
  
  return parsed;
}

export function usePremium() {
  const [state, setState] = useState<PremiumState>(getPremiumState);

  const startTrial = useCallback(() => {
    const newState: PremiumState = {
      isPremium: true,
      trialStartedAt: new Date().toISOString(),
    };
    localStorage.setItem(PREMIUM_KEY, JSON.stringify(newState));
    setState(newState);
  }, []);

  const trialDaysLeft = state.trialStartedAt
    ? Math.max(0, 7 - Math.floor((Date.now() - new Date(state.trialStartedAt).getTime()) / (24 * 60 * 60 * 1000)))
    : null;

  return {
    isPremium: state.isPremium,
    trialDaysLeft,
    startTrial,
  };
}
