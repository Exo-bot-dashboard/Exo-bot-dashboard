import express, { Request } from "express";
import session from "express-session";
import passport from "passport";
import { Strategy as DiscordStrategy } from "passport-discord";
import { router } from "./routes";
import { modSuggestionsRouter } from "./mod-suggestions-routes";
import { initBot } from "./bot";

// Extend Express Request type to include passport properties
declare global {
  namespace Express {
    interface User {
      id: string;
      username: string;
      discriminator: string;
      avatar: string;
      [key: string]: any;
    }
  }
}

const app = express();
const PORT = parseInt(process.env.PORT || "5000", 10);

// Check for required environment variables
const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID;
const DISCORD_CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET;
const SESSION_SECRET = process.env.SESSION_SECRET || "exo-dashboard-secret";

if (!DISCORD_BOT_TOKEN) {
  console.error("Missing DISCORD_BOT_TOKEN environment variable!");
  console.log("Please provide your Discord bot token to start Exo.");
}

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session setup
app.use(
  session({
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    },
  })
);

// Passport setup for Discord OAuth
if (DISCORD_CLIENT_ID && DISCORD_CLIENT_SECRET) {
  // Hardcoded callback URL - this should never change
  const callbackURL = "https://exo-bot-dashboard.replit.app/api/auth/discord/callback";

  console.log(`Discord OAuth callback URL: ${callbackURL}`);

  passport.use(
    new DiscordStrategy(
      {
        clientID: DISCORD_CLIENT_ID,
        clientSecret: DISCORD_CLIENT_SECRET,
        callbackURL: callbackURL,
        scope: ["identify", "guilds"],
      },
      (accessToken: string, refreshToken: string, profile: any, done: any) => {
        // Store user profile
        return done(null, profile);
      }
    )
  );

  passport.serializeUser((user: any, done) => {
    done(null, user);
  });

  passport.deserializeUser((obj: any, done) => {
    done(null, obj);
  });

  app.use(passport.initialize());
  app.use(passport.session());

  // Auth routes
  app.get("/api/auth/discord", passport.authenticate("discord"));
  app.get(
    "/api/auth/discord/callback",
    passport.authenticate("discord", {
      failureRedirect: "/",
    }),
    (req, res) => {
      res.redirect("/dashboard");
    }
  );

  app.get("/api/auth/user", (req, res) => {
    if (req.isAuthenticated()) {
      res.json(req.user);
    } else {
      res.status(401).json({ error: "Not authenticated" });
    }
  });

  app.post("/api/auth/logout", (req, res) => {
    req.logout((err) => {
      if (err) {
        res.status(500).json({ error: "Logout failed" });
      } else {
        res.json({ success: true });
      }
    });
  });
}

// API routes
app.use(router);
app.use(modSuggestionsRouter);

// Start Exo bot if token is provided
if (DISCORD_BOT_TOKEN) {
  initBot(DISCORD_BOT_TOKEN);
  console.log("Starting Exo bot...");
} else {
  console.log("Discord bot token not provided. Exo will not start.");
  console.log("Set DISCORD_BOT_TOKEN environment variable to start Exo.");
}

// Health check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

const server = app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on http://0.0.0.0:${PORT}`);
});

// Setup Vite dev server for frontend (only in development, not on Replit deployments)
const isReplitDeployment = process.env.REPL_DEPLOYMENT === "1" || process.env.REPLIT_DEPLOYMENT === "1";
if (!isReplitDeployment && process.env.NODE_ENV !== "production") {
  import("./vite").then(({ setupVite }) => {
    setupVite(app, server);
  }).catch((err) => {
    console.log("Vite setup not available, serving API only:", err.message);
  });
} else {
  // Serve static files in production or deployment
  import("path").then(({ default: path }) => {
    const distPath = path.resolve(process.cwd(), "dist/public");
    
    // Serve static files with no-cache headers for HTML
    app.use(express.static(distPath, {
      setHeaders: (res, filePath) => {
        if (filePath.endsWith('.html')) {
          res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
          res.setHeader('Pragma', 'no-cache');
          res.setHeader('Expires', '0');
        }
      }
    }));
    
    // Serve index.html for all non-API routes (SPA fallback)
    app.use((req, res, next) => {
      if (req.url.startsWith("/api/")) {
        return next();
      }
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      res.sendFile(path.join(distPath, "index.html"));
    });
  });
}
