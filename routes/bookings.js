import express from "express";
import { verifyAdmin, verifyUser, verifyToken } from "../utils/verifyToken.js";
import {
  createBooking,
  deleteBooking,
  getUserBookings,
  getEventBookings,
  getAllBookings,
  getBooking,
  updateBooking,
} from "../controllers/booking.controller.js";
import { handleStripePayment } from "../controllers/strip.controller.js";
const router = express.Router();
router.post("/create", verifyToken, createBooking);
router.get("/getbooking", verifyToken, getBooking);
router.get("/sessionBookingDetails", handleStripePayment.sessionBookingDetails);
router.post("/scannedQRCode", handleStripePayment.scannedQRCode);
router.get("/getuserbooking", verifyToken, getUserBookings);
router.get("/geteventbooking", verifyToken, getEventBookings);
router.get("/getallbookings", verifyAdmin, getAllBookings);

router.post("/stripe", verifyToken, handleStripePayment.createStripeSession);
router.post("/stripe/mob", verifyToken, handleStripePayment.createStripeSessionMob);

//router.post('/webhook', handleStripePayment.handleStripeWebhook)
router.put("/update", verifyToken, updateBooking);
router.delete("/:id", verifyAdmin, deleteBooking);

export default router;
