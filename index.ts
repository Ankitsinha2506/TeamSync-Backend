import "dotenv/config";
import express, { NextFunction, Request, Response } from "express";
import cors from "cors";
import session from "cookie-session";
import { config } from "./src/config/app.config";
import connectDatabase from "./src/config/database.config";
import { errorHandler } from "./src/middlewares/errorHandler.middleware";
import listEndpoints from "express-list-endpoints";

import "./src/config/passport.config";
import passport from "passport";

import authRoutes from "./src/routes/auth.route";
import userRoutes from "./src/routes/user.route";
import workspaceRoutes from "./src/routes/workspace.route";
import memberRoutes from "./src/routes/member.route";
import projectRoutes from "./src/routes/project.route";
import taskRoutes from "./src/routes/task.route";

import isAuthenticated from "./src/middlewares/isAuthenticated.middleware";
import { autoInjectRoles } from "./src/startup/autoInjectRoles";

// ----------------------------------------------------------------------
// Create Express App
// ----------------------------------------------------------------------
const app = express();

// ----------------------------------------------------------------------
// CORS (must be first)
// ----------------------------------------------------------------------
app.use(
  cors({
    origin: config.FRONTEND_ORIGIN,
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

console.log("FRONTEND_ORIGIN:", config.FRONTEND_ORIGIN);
console.log("NODE_ENV:", config.NODE_ENV);

// ----------------------------------------------------------------------
// Body Parsers
// ----------------------------------------------------------------------
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// ----------------------------------------------------------------------
// Session + Passport
// ----------------------------------------------------------------------
app.use(
  session({
    name: "session",
    secret: config.SESSION_SECRET,
    maxAge: 24 * 60 * 60 * 1000,
    secure: config.NODE_ENV === "production",  // HTTPS only in production
    httpOnly: true,
    sameSite: config.NODE_ENV === "production" ? "none" : "lax",
  })
);


app.use(passport.initialize());
app.use(passport.session());

// ----------------------------------------------------------------------
// Routes
// ----------------------------------------------------------------------
const BASE_PATH = config.BASE_PATH;

app.get("/", (req, res) => {
  res.json({ message: "API is running", version: "1.0.0" });
});

app.use(`${BASE_PATH}/auth`, authRoutes);
app.use(`${BASE_PATH}/user`, isAuthenticated, userRoutes);
app.use(`${BASE_PATH}/workspace`, isAuthenticated, workspaceRoutes);
app.use(`${BASE_PATH}/member`, isAuthenticated, memberRoutes);
app.use(`${BASE_PATH}/project`, isAuthenticated, projectRoutes);
app.use(`${BASE_PATH}/task`, isAuthenticated, taskRoutes);

// ----------------------------------------------------------------------
// Global Error Handler (last middleware)
// ----------------------------------------------------------------------
app.use(errorHandler);

// ----------------------------------------------------------------------
// Log all routes (dev only)
// ----------------------------------------------------------------------
if (config.NODE_ENV !== "production") {
  console.log("Registered Routes:");

  const endpoints = listEndpoints(app) as {
    path: string;
    methods: string[];
  }[];

  console.table(
    endpoints.map((route) => ({
      path: route.path,
      methods: route.methods.join(", "),
    }))
  );
}


// ----------------------------------------------------------------------
// Start Server — ONLY AFTER DB + Roles are ready
// ----------------------------------------------------------------------
const startServer = async () => {
  try {
    // 1. Connect to Database
    await connectDatabase();
    console.log("MongoDB connected successfully");

    // 2. Seed roles + create admin
    await autoInjectRoles();
    console.log("Roles & Admin injected successfully");

    // 3. NOW start listening
    app.listen(config.PORT, () => {
      console.log(`Server running on http://localhost:${config.PORT}`);
      console.log(`Environment: ${config.NODE_ENV}`);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
};

// ----------------------------------------------------------------------
// Graceful shutdown
// ----------------------------------------------------------------------
process.on("SIGTERM", () => {
  console.log("SIGTERM received: Shutting down gracefully");
  process.exit(0);
});

process.on("SIGINT", () => {
  console.log("SIGINT received: Shutting down");
  process.exit(0);
});

// ----------------------------------------------------------------------
// Start the app
// ----------------------------------------------------------------------
startServer();