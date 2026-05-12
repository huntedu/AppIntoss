import { defineConfig } from "@apps-in-toss/web-framework/config";

export default defineConfig({
  appName: "appintoss-habit-tracker",
  brand: {
    displayName: "오늘습관",
    primaryColor: "#3182F6",
    icon: "",
  },
  web: {
    host: "localhost",
    port: 3000,
    commands: {
      dev: "next dev --hostname 0.0.0.0",
      build: "next build",
    },
  },
  permissions: [],
  outdir: "out",
});
