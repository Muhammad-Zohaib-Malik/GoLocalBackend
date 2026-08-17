import mongoose from "mongoose";

const eventSchema = new mongoose.Schema(
  {
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    name: {
      type: String,
      required: true,
    },
    venue: {
      type: String,
    },
    address: {
      type: String,
    },
    photo: {
      type: String,
    },
    desc: {
      type: String,
    },
    template: {
      type: String,
    },
    category: {
      type: String,
      enum: ["Música", "Deportes", "Conferencia", "Taller", "Teatro"],
    },
    currency: {
      type: String,
      enum: ["EUR", "USD", "PKR"],
      default: "PKR",
    },
    gallery: {
      type: [String],
      default: [],
    },
    ticket: {
      type: String,
      enum: ["Online", "Walk-in"],
    },
    subscriptionPlan: {
      type: String,
      enum: ["Simple", "Standard", "Premium"],
      default: "Simple",
    },
    vipprice: {
      type: Number,
    },
    economyprice: {
      type: Number,
    },
    eventDate: {
      type: Date,
    },
    eventTime: {
      type: String,
    },
    eventDateSec: {
      type: Date,
    },
    eventTimeSec: {
      type: String,
    },
    vipSize: {
      type: Number,
    },
    TotalCapacity: {
      type: Number,
    },
    paymentStatus: {
      type: String,
      enum: ["pending", "paid", "failed"],
      default: "pending",
    },
    paymentDetails: {
      paymentIntentId: { type: String },
      paymentMethod: { type: String },
      sessionStorageId: { type: String },
    },
    economySize: {
      type: Number,
    },
    availableSeats: {
      type: [String],
      default: [],
    },
    finalSeats: {
      type: Array,
      default: [],
    },
    featured: {
      type: Boolean,
      default: false,
    },
    reservedSeats: {
      type: [String],
      default: [],
    },
    reservedSeatsSec: {
      type: [String],
      default: [],
    },
    published: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true },
);

export default mongoose.model("Event", eventSchema);
