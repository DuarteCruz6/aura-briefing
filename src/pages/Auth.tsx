import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import logo from "../assets/logo.png";
import { api } from "../lib/api";

const Auth = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      toast.error("Email is required");
      return;
    }
    setLoading(true);
    try {
      const user = isLogin
        ? await api.login({ email: trimmedEmail })
        : await api.getAuthMe({
            email: trimmedEmail,
            name: (name || trimmedEmail.split("@")[0]).trim() || undefined,
          });
      if (!user?.email) {
        toast.error("Invalid response from server");
        return;
      }
      const toStore = {
        id: user.id,
        email: user.email,
        name: user.name ?? (trimmedEmail.split("@")[0] || undefined),
      };
      localStorage.setItem("briefcast_auth", JSON.stringify(toStore));
      navigate("/", { replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Sign in failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      {/* Ambient glow */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-primary/5 rounded-full blur-[120px]" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md relative z-10"
      >
        {/* Logo */}
        <div className="flex items-center justify-center gap-1.5 mb-8">
          <img src={logo} alt="Unscrolling" className="h-20 object-contain" />
          <span className="font-display text-2xl font-bold text-foreground tracking-tight">Unscrolling</span>
        </div>

        {/* Card */}
        <div className="glass-panel rounded-2xl p-8 border border-white/[0.06]">
          {/* Toggle */}
          <div className="flex rounded-xl bg-white/[0.04] p-1 mb-8">
            {["Log In", "Sign Up"].map((label, i) => {
              const active = i === 0 ? isLogin : !isLogin;
              return (
                <button
                  key={label}
                  onClick={() => setIsLogin(i === 0)}
                  className={`relative flex-1 py-2.5 text-sm font-medium rounded-lg transition-colors ${
                    active ? "text-foreground" : "text-muted-foreground hover:text-foreground/70"
                  }`}
                >
                  {active && (
                    <motion.div
                      layoutId="auth-tab"
                      className="absolute inset-0 bg-white/[0.08] rounded-lg border border-white/[0.06]"
                      transition={{ type: "spring", bounce: 0.15, duration: 0.5 }}
                    />
                  )}
                  <span className="relative z-10">{label}</span>
                </button>
              );
            })}
          </div>

          <AnimatePresence mode="wait">
            <motion.form
              key={isLogin ? "login" : "signup"}
              initial={{ opacity: 0, x: isLogin ? -10 : 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: isLogin ? 10 : -10 }}
              transition={{ duration: 0.2 }}
              onSubmit={handleSubmit}
              className="space-y-4"
            >
              {!isLogin && (
                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-1.5">Full Name</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="John Doe"
                    className="w-full h-11 rounded-xl bg-white/[0.04] border border-white/[0.08] px-4 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-colors"
                    required
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-1.5">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full h-11 rounded-xl bg-white/[0.04] border border-white/[0.08] px-4 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-colors"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-1.5">Password</label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full h-11 rounded-xl bg-white/[0.04] border border-white/[0.08] px-4 pr-11 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-colors"
                    required
                    minLength={6}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {isLogin && (
                <div className="flex justify-end">
                  <button type="button" className="text-xs text-primary hover:text-primary/80 transition-colors">
                    Forgot password?
                  </button>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full h-11 rounded-xl bg-primary text-primary-foreground font-medium text-sm hover:bg-primary/90 transition-colors mt-2 disabled:opacity-50"
              >
                {loading ? "Signing in…" : isLogin ? "Log In" : "Create Account"}
              </button>
            </motion.form>
          </AnimatePresence>

          <p className="text-xs text-muted-foreground/60 text-center mt-6">
            {isLogin ? "Don't have an account? " : "Already have an account? "}
            <button
              onClick={() => setIsLogin(!isLogin)}
              className="text-primary hover:text-primary/80 transition-colors"
            >
              {isLogin ? "Sign up" : "Log in"}
            </button>
          </p>
        </div>
      </motion.div>
    </div>
  );
};

export default Auth;
