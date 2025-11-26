import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Seer.fun Cyber Color Palette
        void: "#050505",           // Void Black - Background
        matrix: "#00FF41",         // Matrix Green - Primary Text & YES
        cyber: "#FF0055",          // Cyber Pink - NO
        "dark-grey": "#333333",    // Dark Grey - Borders
        "neon-green": "#00FF41",   // Neon Green Glow
        "neon-pink": "#FF0055",    // Cyber Pink Glow
        terminal: {
          bg: "#0a0a0a",
          border: "#1a1a1a",
          text: "#00FF41",
        },
      },
      fontFamily: {
        vt323: ["var(--font-vt323)", "monospace"],
        mono: ["var(--font-jetbrains)", "monospace"],
      },
      animation: {
        // Glitch effect animation
        glitch: "glitch 0.3s ease-in-out infinite",
        "glitch-hover": "glitch-hover 0.5s ease-in-out",
        // CRT flicker
        flicker: "flicker 0.15s infinite",
        // Terminal typing cursor
        blink: "blink 1s step-end infinite",
        // Scanline movement
        scanline: "scanline 8s linear infinite",
        // Neon pulse
        "neon-pulse": "neon-pulse 2s ease-in-out infinite",
        // Matrix rain effect
        "matrix-fall": "matrix-fall 20s linear infinite",
        // Typing effect
        typing: "typing 3.5s steps(40, end)",
      },
      keyframes: {
        glitch: {
          "0%, 100%": { transform: "translate(0)" },
          "20%": { transform: "translate(-2px, 2px)" },
          "40%": { transform: "translate(-2px, -2px)" },
          "60%": { transform: "translate(2px, 2px)" },
          "80%": { transform: "translate(2px, -2px)" },
        },
        "glitch-hover": {
          "0%": { transform: "translate(0)", opacity: "1" },
          "20%": { transform: "translate(-3px, 3px)", opacity: "0.8" },
          "40%": { transform: "translate(3px, -3px)", opacity: "0.9" },
          "60%": { transform: "translate(-3px, -3px)", opacity: "0.8" },
          "80%": { transform: "translate(3px, 3px)", opacity: "0.9" },
          "100%": { transform: "translate(0)", opacity: "1" },
        },
        flicker: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.8" },
        },
        blink: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0" },
        },
        scanline: {
          "0%": { transform: "translateY(-100%)" },
          "100%": { transform: "translateY(100%)" },
        },
        "neon-pulse": {
          "0%, 100%": {
            textShadow: "0 0 4px #00FF41, 0 0 11px #00FF41, 0 0 19px #00FF41",
          },
          "50%": {
            textShadow: "0 0 4px #00FF41, 0 0 40px #00FF41, 0 0 80px #00FF41",
          },
        },
        "matrix-fall": {
          "0%": { transform: "translateY(-100%)" },
          "100%": { transform: "translateY(100vh)" },
        },
        typing: {
          "0%": { width: "0" },
          "100%": { width: "100%" },
        },
      },
      boxShadow: {
        "neon-green": "0 0 5px #00FF41, 0 0 10px #00FF41, 0 0 20px #00FF41",
        "neon-pink": "0 0 5px #FF0055, 0 0 10px #FF0055, 0 0 20px #FF0055",
        terminal: "0 0 10px rgba(0, 255, 65, 0.3), inset 0 0 60px rgba(0, 0, 0, 0.5)",
      },
      backgroundImage: {
        "grid-pattern": `linear-gradient(rgba(0, 255, 65, 0.03) 1px, transparent 1px),
                         linear-gradient(90deg, rgba(0, 255, 65, 0.03) 1px, transparent 1px)`,
      },
      backgroundSize: {
        grid: "20px 20px",
      },
    },
  },
  plugins: [],
};
export default config;
