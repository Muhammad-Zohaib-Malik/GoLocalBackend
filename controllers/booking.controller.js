import Booking from "../models/booking.model.js";
import Event from "../models/event.model.js";
import { uploadOnCloudinary, deleteOnCloudinary } from "../utils/cloudinary.js";
import QRCode from "qrcode";

import crypto from "crypto";

// Encryption helper function
const encrypt = (data, secretKey) => {
  const keyBuffer = Buffer.from(secretKey, "hex");
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv("aes-256-cbc", keyBuffer, iv);
  let encrypted = cipher.update(data, "utf8", "hex");
  encrypted += cipher.final("hex");
  return `${iv.toString("hex")}:${encrypted}`;
};

// Booking creation function
export const createBooking = async (req, res) => {
  const { bookingDate, event_id, user_id, guestSize, seatNumbers, totalPrice } =
    req.body;

  try {
    // Fetch event details
    const event = await Event.findById(event_id);
    if (!event) {
      return res.status(404).json({
        status: "failed",
        success: "false",
        message: "Event not found",
      });
    }

    // Check for conflicting seats
    const conflictingSeats = await Booking.find({
      event_id,
      bookingDate,
      seatNumbers: { $in: seatNumbers },
    });

    if (conflictingSeats.length > 0) {
      return res.status(400).json({
        status: "failed",
        success: "false",
        message: "Some of the selected seats are already reserved",
        conflictingSeats: conflictingSeats
          .map((booking) => booking.seatNumbers)
          .flat(),
      });
    }

    // Create a new booking
    const newBooking = new Booking({
      user_id,
      event_id,
      bookingDate,
      guestSize,
      seatNumbers,
      totalPrice,
    });

    const savedBooking = await newBooking.save();

    // Update available seats
    event.availableSeats = event.availableSeats.filter(
      (seat) => !seatNumbers.includes(seat),
    );
    await event.save();

    // Populate relevant details for response
    const populatedBooking = await Booking.findById(savedBooking._id)
      .populate("user_id", "username email")
      .populate("event_id", "name desc venue");

    // Generate encrypted QR code data
    const secretKey = process.env.QR_SECRET_KEY;
    const qrCodeData = JSON.stringify({
      bookingId: savedBooking._id,
      event: event.name,
      user: populatedBooking.user_id.username,
      date: bookingDate,
      totalPrice,
    });

    const encryptedData = encrypt(qrCodeData, secretKey);

    // Create a QR code payload with a custom message
    const qrCodePayload = {
      errorMessage: "Invalid QR Code. Please contact the event organizer.", // Custom message here
      data: encryptedData, // Encrypted booking details
    };

    // Generate QR code as Base64
    const qrCodeBase64 = await QRCode.toDataURL(JSON.stringify(qrCodePayload));

    // Upload QR code to Cloudinary
    const qrCodeUploadResponse = await uploadOnCloudinary(qrCodeBase64, {
      folder: "event_bookings",
      public_id: `booking_${savedBooking._id}`,
    });

    // Send response with booking details and QR code URL
    res.status(200).json({
      status: "success",
      success: "true",
      message: "Your reservation has been made",
      data: populatedBooking,
      qrCodeUrl: qrCodeUploadResponse.secure_url,
    });
  } catch (err) {
    res.status(500).json({
      status: "failed",
      success: "false",
      message: "Error when making the reservation",
      error: err.message,
    });
  }
};
export const getBooking = async (req, res) => {
  const _id = req.query.id;

  try {
    const booking = await Booking.findById(_id);
    res.status(200).json({
      status: "success",
      success: "true",
      message: "Success",
      data: booking,
    });
  } catch (err) {
    res.status(404).json({
      status: "failed",
      success: "false",
      message: "Reservation not found",
    });
  }
};

// 2) To get all bookings by a user
export const getUserBookings = async (req, res) => {
  const user_id = req.query.user_id;

  try {
    const userBookings = await Booking.find({ user_id }).populate(
      "event_id",
      "name venue",
    );
    res.status(200).json({
      status: "success",
      success: "true",
      message: "User reservations successfully recovered",
      data: userBookings,
    });
  } catch (err) {
    res.status(500).json({
      status: "failed",
      success: "false",
      message: "Error retrieving user reservations",
      error: err.message,
    });
  }
};

// 3) To get all bookings for an event
export const getEventBookings = async (req, res) => {
  const event_id = req.query.event_id;

  try {
    const eventBookings = await Booking.find({ event_id }).populate(
      "user_id",
      "username email",
    );
    res.status(200).json({
      status: "success",
      success: "true",
      message: "Event reservations successfully recovered",
      data: eventBookings,
    });
  } catch (err) {
    res.status(500).json({
      status: "failed",
      success: "false",
      message: "Error retrieving event reservations",
      error: err.message,
    });
  }
};

// 4) To get all bookings details
export const getAllBookings = async (req, res) => {
  try {
    const allBookings = await Booking.find();
    res.status(200).json({
      status: "success",
      success: "true",
      message: "Success",
      count: allBookings.length,
      data: allBookings,
    });
  } catch (err) {
    res.status(500).json({
      status: "failed",
      success: "false",
      message: "Internal Server Error",
    });
  }
};

// 5) To delete a booking
export const deleteBooking = async (req, res) => {
  const id = req.params.id;

  try {
    await Booking.findByIdAndDelete(id);
    res.status(200).json({
      status: "success",
      success: "true",
      message: "Reservation successfully deleted",
    });
  } catch (err) {
    res.status(500).json({
      status: "failed",
      success: "false",
      message: "The reservation could not be deleted. Please try again.",
    });
  }
};

// 6) To update a booking
export const updateBooking = async (req, res) => {
  const _id = req.query.id;

  try {
    const updatedBooking = await Booking.findByIdAndUpdate(
      _id,
      { $set: req.body },
      { new: true },
    );
    res.status(200).json({
      status: "success",
      success: "true",
      message: "Reservation successfully updated",
      data: updatedBooking,
    });
  } catch (err) {
    res.status(500).json({
      status: "failed",
      success: "false",
      message: "The reservation could not be updated. Please try again.",
    });
  }
};
