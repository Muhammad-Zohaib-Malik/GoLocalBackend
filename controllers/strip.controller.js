import QRCode from "qrcode";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import Booking from "../models/booking.model.js";
import Event from "../models/event.model.js";
import User from "../models/user.model.js";
import Stripe from "stripe";
import jwt from "jsonwebtoken";
import fs from "fs";
import crypto from "crypto";
import PDFDocument from "pdfkit";
const encrypt = (data, secretKey) => {
  const keyBuffer = Buffer.from(secretKey, "hex");
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv("aes-256-cbc", keyBuffer, iv);
  let encrypted = cipher.update(data, "utf8", "hex");
  encrypted += cipher.final("hex");
  return `${iv.toString("hex")}:${encrypted}`;
};
const decrypt = (encryptedData, secretKey) => {
  const [ivHex, encryptedText] = encryptedData.split(":");
  const iv = Buffer.from(ivHex, "hex");
  const keyBuffer = Buffer.from(secretKey, "hex");
  const decipher = crypto.createDecipheriv("aes-256-cbc", keyBuffer, iv);
  let decrypted = decipher.update(encryptedText, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
};
const stripeClient = new Stripe(
  process.env.STRIPE_SECRET_KEY
);

export const handleStripePayment = {
  /**
   * Create a Stripe payment session for booking an event.
   */

  createStripeSession: async (req, res) => {
    const {
      user_id,
      event_id,
      bookingDate,
      guestSize,
      seatNumbers,
      totalPrice,
    } = req.body;

    try {
      // Find the event to book
      const event = await Event.findById(event_id);
      if (!event) {
        return res.status(404).json({ message: "Event not found" });
      }

      // Get all bookings for the same event and date
      const existingBookings = await Booking.find({
        event_id,
        bookingDate,
      });

      // Collect all reserved seats for this event and date
      const reservedSeats = existingBookings.flatMap(
        (booking) => booking.seatNumbers,
      );

      // Check if any requested seats are already reserved
      const alreadyReservedSeats = seatNumbers.filter((seat) =>
        reservedSeats.includes(seat),
      );
      if (alreadyReservedSeats.length > 0) {
        return res.status(400).json({
          message: "Some of the selected seats are already reserved",
          alreadyReservedSeats,
        });
      }

      // Create a Stripe session for payment
      const session = await stripeClient.checkout.sessions.create({
        payment_method_types: ["card"],
        line_items: [
          {
            price_data: {
              currency: "usd",
              product_data: {
                name: `Booking for ${event.name}`,
                description: `Venue: ${event.venue}, Seat Numbers: ${seatNumbers.join(",")}`,
              },
              unit_amount: totalPrice * 100, // Amount in cents
            },
            quantity: 1,
          },
        ],
        mode: "payment",
        success_url: `http://localhost:5173/wallet`,
        cancel_url: `http://localhost:5173/events`,
        metadata: {
          user_id,
          event_id,
          bookingDate,
          guestSize,
          seatNumbers: JSON.stringify(seatNumbers),
          totalPrice,
        },
      });

      res.status(200).json({ stripeUrl: session.url });
    } catch (error) {
      console.error("Error creating Stripe session for booking:", error);
      res
        .status(500)
        .json({ message: "Internal server error", error: error.message });
    }
  },
  createStripeSessionMob: async (req, res) => {
    const {
      user_id,
      event_id,
      bookingDate,
      guestSize,
      seatNumbers,
      totalPrice,
    } = req.body;

    try {
      // Find the event to book
      const event = await Event.findById(event_id);
      if (!event) {
        return res.status(404).json({ message: "Event not found" });
      }

      // Get all bookings for the same event and date
      const existingBookings = await Booking.find({
        event_id,
        bookingDate,
      });

      // Collect all reserved seats for this event and date
      const reservedSeats = existingBookings.flatMap(
        (booking) => booking.seatNumbers,
      );

      // Check if any requested seats are already reserved
      const alreadyReservedSeats = seatNumbers.filter((seat) =>
        reservedSeats.includes(seat),
      );
      if (alreadyReservedSeats.length > 0) {
        return res.status(400).json({
          message: "Some of the selected seats are already reserved",
          alreadyReservedSeats,
        });
      }

      // Create a Stripe session for payment
      const session = await stripeClient.checkout.sessions.create({
        payment_method_types: ["card"],
        line_items: [
          {
            price_data: {
              currency: "usd",
              product_data: {
                name: `Booking for ${event.name}`,
                description: `Venue: ${event.venue}, Seat Numbers: ${seatNumbers.join(",")}`,
              },
              unit_amount: totalPrice * 100, // Amount in cents
            },
            quantity: 1,
          },
        ],
        mode: "payment",
        success_url: `https://icpih.com/media-intestinal-health-ihsig/PAYMENT-SUCCESS.png`,
        cancel_url: `http://localhost:5173/events`,
        metadata: {
          user_id,
          event_id,
          bookingDate,
          guestSize,
          seatNumbers: JSON.stringify(seatNumbers),
          totalPrice,
        },
      });

      res.status(200).json({ stripeUrl: session.url });
    } catch (error) {
      console.error("Error creating Stripe session for booking:", error);
      res
        .status(500)
        .json({ message: "Internal server error", error: error.message });
    }
  },

  /**
     * Handle Stripe webhook to manage payment completion and create booking.
    //  */

  handleStripeWebhook: async (req, res) => {
    const sig = req.headers["stripe-signature"];
    let stripeEvent;

    try {
      stripeEvent = stripeClient.webhooks.constructEvent(
        req.body,
        sig,
        process.env.STRIPE_WEBHOOK_SECRET,
      );
    } catch (err) {
      console.error("Webhook signature verification failed:", err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    if (stripeEvent.type === "checkout.session.completed") {
      const session = stripeEvent.data.object;

      if (session.payment_status === "paid" && session.status === "complete") {
        const {
          user_id,
          event_id,
          bookingDate,
          guestSize,
          seatNumbers,
          totalPrice,
        } = session.metadata;

        try {
          // Find the event
          const event = await Event.findById(event_id);
          if (!event) {
            console.error("Event not found during booking creation.");
            return res.status(404).json({ message: "Event not found" });
          }

          // Determine which reservedSeats field to update
          let reservedSeatsField;
          if (
            new Date(bookingDate).getTime() ===
            new Date(event.eventDate).getTime()
          ) {
            reservedSeatsField = "reservedSeats";
          } else if (
            new Date(bookingDate).getTime() ===
            new Date(event.eventDateSec).getTime()
          ) {
            reservedSeatsField = "reservedSeatsSec";
          } else {
            console.error("Booking date does not match any event date.");
            return res.status(400).json({ message: "Invalid booking date" });
          }

          // Check if seats are already reserved for the selected date
          const alreadyReservedSeats = event[reservedSeatsField].filter(
            (seat) => JSON.parse(seatNumbers).includes(seat),
          );

          if (alreadyReservedSeats.length > 0) {
            console.error("Some of the selected seats are already reserved.");
            return res.status(400).json({
              message: "Some of the selected seats are already reserved",
              alreadyReservedSeats,
            });
          }

          // Add the reserved seats to the correct array
          event[reservedSeatsField] = [
            ...event[reservedSeatsField],
            ...JSON.parse(seatNumbers),
          ];
          await event.save();

          // Create the new booking
          const newBooking = new Booking({
            user_id,
            event_id,
            bookingDate,
            guestSize,
            seatNumbers: JSON.parse(seatNumbers),
            totalPrice,
            paymentStatus: "paid",
            paymentDetails: {
              paymentIntentId: session.payment_intent,
              sessionStorageId: session.id,
              paymentMethod: session.payment_method_types[0],
            },
          });

          const savedBooking = await newBooking.save();

          // Generate QR code
          const secretKey = process.env.QR_SECRET_KEY;
          const qrCodeData = JSON.stringify({
            bookingId: savedBooking._id,
            event: event.name,
            user: user_id,
            date: bookingDate,
            totalPrice,
          });

          const encryptedData = encrypt(qrCodeData, secretKey);

          const qrCodePayload = {
            errorMessage:
              "Invalid QR Code. Please contact the event organizer.",
            data: encryptedData,
          };

          const qrCodeBase64 = await QRCode.toDataURL(
            JSON.stringify(qrCodePayload),
          );

          // Upload QR code to Cloudinary
          const qrCodeUploadResponse = await uploadOnCloudinary(qrCodeBase64, {
            folder: "event_bookings",
            public_id: `booking_${savedBooking._id}`,
          });

          savedBooking.qrCodeUrl = qrCodeUploadResponse.secure_url;
          await savedBooking.save();

          console.log(
            `Booking ${savedBooking._id} created successfully with QR code.`,
          );
        } catch (error) {
          console.error("Error creating booking after payment:", error);
          return res
            .status(500)
            .json({ message: "Error creating booking after payment" });
        }
      }
    }
    res.status(200).json({ received: true });
  },

  /**
   * Retrieve booking details using the Stripe session ID.
   */

  sessionBookingDetails: async (req, res) => {
    const { session_id } = req.query;

    if (!session_id) {
      return res.status(400).json({ message: "Session ID is required" });
    }

    try {
      // Find the booking using Stripe session ID
      const booking = await Booking.findOne({
        "paymentDetails.sessionStorageId": session_id,
      });
      if (!booking) {
        return res.status(404).json({ message: "Booking not found" });
      }

      // Fetch associated event and user details
      const event = await Event.findOne({ _id: booking.event_id });
      const user = await User.findOne({ _id: booking.user_id });

      // Generate the booking PDF
      const doc = new PDFDocument({ margin: 50 });
      const filePath = `booking-${booking._id}.pdf`;
      const writeStream = fs.createWriteStream(filePath);
      doc.pipe(writeStream);

      // Header Section
      doc.rect(0, 0, doc.page.width, 80).fill("#2C3E50");
      doc
        .fillColor("#ECF0F1")
        .fontSize(26)
        .text("Confirmación de Reserva de Evento", 50, 30, { align: "center" });

      // Sub-header
      doc
        .moveDown(2)
        .fillColor("#34495E")
        .fontSize(18)
        .text("Resumen de la Reserva", 50, 100, {
          align: "left",
          underline: true,
        });

      // Booking Information
      doc.moveDown(1);
      doc
        .fillColor("black")
        .fontSize(14)
        .text(`ID de Reserva:`, { continued: true })
        .font("Helvetica-Bold")
        .text(` ${booking._id}`);
      doc
        .font("Helvetica")
        .text(`Nombre del Evento:`, { continued: true })
        .font("Helvetica-Bold")
        .text(` ${event.name}`);
      doc
        .font("Helvetica")
        .text(`Nombre del Usuario:`, { continued: true })
        .font("Helvetica-Bold")
        .text(` ${user.username}`);
      doc
        .font("Helvetica")
        .text(`Fecha de Reserva:`, { continued: true })
        .font("Helvetica-Bold")
        .text(` ${new Date(booking.bookingDate).toLocaleString()}`);
      doc
        .font("Helvetica")
        .text(`Asientos Reservados:`, { continued: true })
        .font("Helvetica-Bold")
        .text(` ${booking.guestSize}`);
      doc
        .font("Helvetica")
        .text(`Números de Asientos:`, { continued: true })
        .font("Helvetica-Bold")
        .text(` ${booking.seatNumbers.join(", ")}`);
      doc
        .font("Helvetica")
        .text(`Precio Total:`, { continued: true })
        .font("Helvetica-Bold")
        .text(` $${booking.totalPrice}`);
      doc
        .font("Helvetica")
        .text(`Estado de Pago:`, { continued: true })
        .font("Helvetica-Bold")
        .text(` ${booking.paymentStatus}`);

      // Divider
      doc
        .moveDown(1)
        .strokeColor("#BDC3C7")
        .lineWidth(1)
        .moveTo(50, doc.y)
        .lineTo(550, doc.y)
        .stroke();

      // QR Code Section
      doc
        .moveDown(2)
        .fillColor("#34495E")
        .fontSize(18)
        .text("Escanee su Código QR", { align: "left", underline: true });
      const qrCodeDataURL = await QRCode.toDataURL(
        booking.qrCodeUrl || "No QR code available",
      );
      const qrCodeImage = Buffer.from(qrCodeDataURL.split(",")[1], "base64");
      doc.image(qrCodeImage, 50, doc.y + 20, {
        fit: [150, 150],
        align: "center",
      });
      doc.moveDown(12);

      // Footer
      doc.rect(0, doc.page.height - 50, doc.page.width, 50).fill("#2C3E50");
      doc
        .fillColor("#ECF0F1")
        .fontSize(10)
        .text(
          "¡Gracias por reservar con nosotros! Para consultas, contacte a support@example.com",
          50,
          doc.page.height - 40,
          { align: "center" },
        );

      doc.end();

      writeStream.on("finish", () => {
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader(
          "Content-Disposition",
          `attachment; filename=${filePath}`,
        );
        res.sendFile(filePath, { root: "." }, (err) => {
          if (err) {
            console.error("Error sending PDF:", err);
          }
          // Cleanup the generated file
          fs.unlinkSync(filePath);
        });
      });
    } catch (error) {
      console.error("Error fetching booking details:", error);
      res
        .status(500)
        .json({ message: "Internal server error", error: error.message });
    }
  },
  /**
   * Handle scanned QR code to mark it as scanned.
   */

  scannedQRCode: async (req, res) => {
    const { data, eventIdToVerify } = req.body; // Datos encriptados del código QR y ID del evento
    const secretKey = process.env.QR_SECRET_KEY;

    try {
      // Paso 1: Desencriptar los datos del código QR
      const decryptedData = decrypt(data, secretKey);
      const parsedData = JSON.parse(decryptedData);
      const { bookingId, user, event, date, totalPrice } = parsedData;
      // Paso 2: Buscar la reserva en la base de datos
      const booking = await Booking.findById(bookingId)
        .populate("user_id", "username email")
        .populate("event_id", "name desc venue");
      if (!booking) {
        return res.status(404).json({ mensaje: "Reserva no encontrada" });
      }
      // Paso 3: Verificar si el código QR ya fue escaneado
      if (booking.qrCodeScanStatus) {
        return res
          .status(400)
          .json({ mensaje: "El código QR ya fue escaneado" });
      }
      // Paso 4: Validar el evento relacionado con el ID del organizador o del evento
      const eventRecord = await Event.findById(booking.event_id);

      if (!eventRecord || eventRecord._id.toString() !== eventIdToVerify) {
        return res.status(403).json({
          mensaje: "El boleto escaneado no es válido para el evento actual",
        });
      }

      // if (eventRecord.username !== user || eventRecord.name !== event) {
      //     return res.status(400).json({ mensaje: "Los datos del boleto no coinciden con el usuario o el evento." });
      // }

      // Paso 6: Marcar el código QR como escaneado
      booking.qrCodeScanStatus = true;
      await booking.save();

      // Paso 7: Devolver la respuesta de éxito
      res.status(200).json({
        mensaje: "Código QR escaneado con éxito",
        datos: {
          idReserva: booking._id,
          usuario: booking.user_id.username,
          evento: booking.event_id.name,
          fecha: booking.bookingDate,
          precioTotal: booking.totalPrice,
          asientos: booking.seatNumbers,
        },
      });
    } catch (error) {
      console.error("Error al validar el código QR:", error);
      if (
        error.name === "JsonWebTokenError" ||
        error.name === "TokenExpiredError"
      ) {
        return res
          .status(400)
          .json({ mensaje: "Código QR inválido o expirado" });
      }
      res.status(500).json({ mensaje: "Error interno del servidor" });
    }
  },
};
