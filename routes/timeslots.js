import express from "express";
import { verifyAdmin } from "../utils/verifyToken.js";
import {
  createTimeslot,
  deleteTimeslot,
  getAllSlots,
  getSlotById,
  updateTimeslot,
} from "../controllers/timeSlot.controller.js";

const router = express.Router();

router.post("/createTimeslot", verifyAdmin, createTimeslot);
router.get("/getAllSlots", getAllSlots);
router.put("/updateslot", verifyAdmin, updateTimeslot);
router.get("/getslot", getSlotById);
router.delete("/deletetimeslot", verifyAdmin, deleteTimeslot);

export default router;
