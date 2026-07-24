import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { localSessionsPlugin } from "./server/sessions";

export default defineConfig({
  plugins: [localSessionsPlugin(), react(), tailwindcss()],
});
