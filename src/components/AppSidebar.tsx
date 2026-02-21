import { Home, Compass, Bookmark, Settings, ChevronLeft, ChevronRight, Sun, Moon, Heart } from "lucide-react";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import logo from "../assets/logo.png";

interface AppSidebarProps {
  activePage?: string;
}

const navItems = [
  { icon: Home, label: "Home", path: "/" },
  { icon: Compass, label: "Explore", path: "/explore" },
  { icon: Heart, label: "Favourites", path: "/favourites" },
  { icon: Bookmark, label: "Bookmarks", path: "/bookmarks" },
];

const bottomItems = [
  { icon: Settings, label: "Settings", path: "/settings" },
];

export function AppSidebar({ activePage = "home" }: AppSidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [theme, setTheme] = useState(() => localStorage.getItem("briefcast_theme") || "dark");
  const navigate = useNavigate();

  useEffect(() => {
    document.documentElement.classList.remove("light", "dark");
    document.documentElement.classList.add(theme);
    localStorage.setItem("briefcast_theme", theme);
  }, [theme]);

  return (
    <motion.aside
      animate={{ width: collapsed ? 72 : 240 }}
      transition={{ duration: 0.3, ease: "easeInOut" }}
      className="h-full hidden sm:flex flex-col border-r border-border/50 bg-sidebar py-6 overflow-hidden flex-shrink-0"
    >
      {/* Logo */}
      <div className="px-4 mb-8 flex items-center justify-between">
        <AnimatePresence mode="wait">
          {!collapsed && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex items-center gap-2"
            >
              <img src={logo} alt="Briefcast" className="w-10 h-10 object-contain" />
              <span className="font-display font-semibold text-foreground text-lg">Briefcast</span>
            </motion.div>
          )}
        </AnimatePresence>
        {collapsed && (
          <img src={logo} alt="Briefcast" className="w-10 h-10 object-contain mx-auto" />
        )}
      </div>

      {/* Nav items */}
      <nav className="flex-1 px-3 space-y-1">
        {navItems.map((item) => (
          <button
            key={item.label}
            onClick={() => navigate(item.path)}
            className={`nav-item w-full ${item.label.toLowerCase() === activePage ? "nav-item-active" : ""}`}
          >
            <item.icon className="w-5 h-5 flex-shrink-0" />
            <AnimatePresence mode="wait">
              {!collapsed && (
                <motion.span
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="whitespace-nowrap"
                >
                  {item.label}
                </motion.span>
              )}
            </AnimatePresence>
          </button>
        ))}
      </nav>

      {/* Bottom items */}
      <div className="px-3 space-y-1 mb-2">
        {bottomItems.map((item) => (
          <button key={item.label} onClick={() => navigate(item.path)} className={`nav-item w-full ${item.label.toLowerCase() === activePage ? "nav-item-active" : ""}`}>
            <item.icon className="w-5 h-5 flex-shrink-0" />
            <AnimatePresence mode="wait">
              {!collapsed && (
                <motion.span
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="whitespace-nowrap"
                >
                  {item.label}
                </motion.span>
              )}
            </AnimatePresence>
          </button>
        ))}
      </div>

      {/* Theme toggle */}
      <div className="px-3 mb-1">
        <button
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          className="nav-item w-full"
        >
          {theme === "dark" ? <Sun className="w-5 h-5 flex-shrink-0" /> : <Moon className="w-5 h-5 flex-shrink-0" />}
          <AnimatePresence mode="wait">
            {!collapsed && (
              <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="whitespace-nowrap"
              >
                {theme === "dark" ? "Light Mode" : "Dark Mode"}
              </motion.span>
            )}
          </AnimatePresence>
        </button>
      </div>

      {/* Collapse toggle */}
      <div className="px-3">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="nav-item w-full justify-center"
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>
    </motion.aside>
  );
}
