// Purpose: Main backend server
// Input: HTTP requests from extension
// Output: Mock responses (DB later)

import express, { Request, Response, NextFunction } from "express";
import cors from "cors";


import eventsRoutes from "./routes/events.routes";
import braindumpRoutes from "./routes/braindump.routes";

import contextRoutes from "./routes/context.routes";


const app = express();

app.use(cors());
app.use(express.json()); // MUST be before any routes

// Mount events route
app.use("/", eventsRoutes);

// Mount braindump route
app.use("/braindump", braindumpRoutes);

// Mount context route
app.use("/context", contextRoutes);

// middleware example
app.use((req: Request, res: Response, next: NextFunction) => {
  console.log(`${req.method} ${req.url}`);
  next();
});

// health route
app.get("/health", (req: Request, res: Response) => {
  res.json({ status: "ok" });
});

// start server
app.listen(3001, () => {
  console.log("Server started on 3001");
});