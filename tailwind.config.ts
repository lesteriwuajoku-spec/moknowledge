import type { Config } from "tailwindcss";

export default {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        moflo: {
          primary: "#0f766e",
          secondary: "#134e4a",
          accent: "#2dd4bf",
          muted: "#ccfbf1",
        },
      },
    },
  },
  plugins: [],
} satisfies Config;
