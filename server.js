import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import cookieParser from "cookie-parser";
import userRoute from "./routes/users.js";
import eventRoute from "./routes/events.js";
import reviewRoute from "./routes/reviews.js";
import bookingRoute from "./routes/bookings.js";
import timeslotRoute from "./routes/timeslots.js";
import authRoute from "./routes/auth.js";
import { handleStripePayment } from "./controllers/strip.controller.js";
import db from "./config/db.js";

dotenv.config();
const app = express();
const portNo = process.env.PORT || 8000;
app.use(
  "/api/v1/booking/webhook",
  express.raw({ type: "application/json" }),
  handleStripePayment.handleStripeWebhook,
);

const corsOptions = {
  origin: "https://golocalworld.netlify.app",
  credentials: true,
};

//middlewares
app.use(express.json());
app.use(cors(corsOptions));
app.use(cookieParser());

//routes
app.get("/", (req, res) => {
  res.send("Api working succesfully");
});

//setting route for Authentication
app.use("/api/v1/auth", authRoute);

//setting route for User
app.use("/api/v1/users", userRoute);

//setting route for Event
app.use("/api/v1/events", eventRoute);

//setting route for Review
app.use("/api/v1/review", reviewRoute);

//setting route for Booking
app.use("/api/v1/booking", bookingRoute);

//setting route for Timeslot
app.use("/api/v1/timeslot", timeslotRoute);

app.use((err, req, res, next) => {
  console.error("Error:", err);
  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({
    status: "failed",
    success: false,
    message: err.message || "Internal Server Error",
  });
});

//starting the server
const server = app.listen(portNo, async (err) => {
  await db.connect();
  console.log("Server listening on port No " + portNo);
});

// Graceful shutdown
process.on("SIGINT", async () => {
  console.log("SIGINT signal received. Shutting down gracefully...");
  server.close(() => {
    console.log("HTTP server closed.");
  });
  await db.disconnect();
  process.exit(0);
});
