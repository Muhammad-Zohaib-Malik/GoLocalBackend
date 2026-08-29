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
