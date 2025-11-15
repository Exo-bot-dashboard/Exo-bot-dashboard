import express, { type Express } from "express";
import fs from "fs";
import path, { dirname } from "path";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export async function setupVite(app: Express, server: any) {
  const vite = await createViteServer({
    server: {
      middlewareMode: true,
      hmr: { server },
    },
    appType: "custom",
  });

  app.use(vite.middlewares);
  
  // Serve index.html for all non-API routes - use a function instead of path pattern
  app.use((req, res, next) => {
    // Skip API routes
    if (req.url.startsWith("/api/")) {
      return next();
    }

    // Skip static files and Vite HMR
    if (req.url.includes(".") || req.url.startsWith("/@") || req.url.startsWith("/__")) {
      return next();
    }

    const url = req.originalUrl;

    (async () => {
      try {
        const clientPath = path.resolve(__dirname, "..", "client", "index.html");
        let template = fs.readFileSync(clientPath, "utf-8");
        template = await vite.transformIndexHtml(url, template);

        res.status(200).set({ "Content-Type": "text/html" }).end(template);
      } catch (e) {
        vite.ssrFixStacktrace(e as Error);
        next(e);
      }
    })();
  });
}
