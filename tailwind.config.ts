import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        surface: "#0f172a",
        panel: "#111827",
        card: "#1f2937",
        muted: "#94a3b8",
        line: "#334155",
      },
    },
  },
  plugins: [],
};
export default config;
