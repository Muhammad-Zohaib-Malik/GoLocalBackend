import express from "express";
import { verifyAdmin, verifyJWT, verifyOrganizer } from "../utils/verifyToken.js";

import {
  createNewEvent,
  getEventsByTimeAndName,
  publishEvent,
  deleteEvent,
  getAllEvents,
  getFeaturedEvents,
  getWalkInEvents,
  getSingleEvent,
  getEventsBySearch,
  getEventsCount,
  updateEvent,
  getUserEvents,
  featureEvent,
} from "../controllers/event.controller.js";
//import { upload } from '../middlewares/multer.middleware.js';
import multer from "multer";
const upload = multer({ dest: "uploads/" });
const router = express.Router();
//router.post('/createEvent',  createNewEvent)
//router.post('/createEvent', upload.single('photo'),verifyJWT, createNewEvent);
router.post("/createEvent", upload.any(), verifyOrganizer, createNewEvent);

router.put("/updateEvent", upload.any(), verifyOrganizer, updateEvent);
router.patch("/publishedEvent", verifyAdmin, publishEvent);
router.patch("/featuredEvent", verifyAdmin, featureEvent);
router.delete("/deleteEvent", verifyOrganizer, deleteEvent);
router.get("/getsingleEvent", getSingleEvent);
router.get("/getuserEvent", verifyJWT, getUserEvents);
router.get("/walk-in", getWalkInEvents);
router.get("/getAllEvents", getAllEvents);
router.get("/search/getEventBySearch", getEventsBySearch);
router.get("/search/getFeaturedEvents", getFeaturedEvents);
router.get("/search/getEventCount", getEventsCount);
router.get("/search/getEventbytime", getEventsByTimeAndName);

export default router;
