import mongoose from "mongoose";

const bookingSchema = new mongoose.Schema(
  {
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    event_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Event",
    },
    seatNumbers: {
      type: [String],
      default: [],
    },
    bookingDate: {
      type: Date,
      required: true,
    },
    guestSize: {
      type: Number,
      required: true,
    },
    totalPrice: {
      type: Number,
    },
    qrCodeToken: {
      type: String,
    },
    qrCodeScanStatus: {
      type: Boolean,
      default: false,
    },
    qrCodeUrl: {
      type: String,
      default: null,
    },
    paymentStatus: {
      type: String,
      // enum: ['Pending', 'paid', 'Fallido'],
      enum: ["Pending", "paid", "Failed"],
      default: "Pending",
    },
    paymentDetails: {
      paymentIntentId: {
        type: String,
      },
      paymentMethod: {
        type: String,
      },
      sessionStorageId: {
        type: String,
      },
    },
  },
  { timestamps: true },
);

export default mongoose.model("Booking", bookingSchema);
