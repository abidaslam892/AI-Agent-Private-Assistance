import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        chat: {
          sidebar: "#171717",
          main: "#212121",
          userBubble: "#2f2f2f",
          input: "#2f2f2f",
          border: "#303030",
          hover: "#262626",
          accent: "#10a37f"
        }
      },
    },
  },
  plugins: [],
};
export default config;
