import Event from "../models/event.model.js";
import { uploadPhoto, deletePhoto } from "../utils/cloudinary.js";
import mongoose from "mongoose";
import fs from "fs";

// Helper to validate Object ID
const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

// Clean up local files helper
const cleanupFiles = (files) => {
  files.forEach((file) => {
    if (file && fs.existsSync(file)) {
      fs.unlinkSync(file);
    }
  });
};

// 1) CREATE NEW EVENT
export const createNewEvent = async (req, res) => {
  const {
    name,
    venue,
    address,
    template,
    desc,
    vipprice,
    economyprice,
    vipSize,
    economySize,
    eventDate,
    eventTime,
    eventDateSec,
    eventTimeSec,
    finalSeats,
    currency,
    ticket,
    category,
    featured,
    published,
  } = req.body;

  if (!req.user || !req.user._id) {
    return res.status(401).json({
      status: "failed",
      success: false,
      message: "Unauthorized: Please log in and try again.",
    });
  }

  let photoFile = null;
  let galleryFiles = [];
  let photoUrl = null;
  let galleryUrls = [];

  if (req.files) {
    for (const file of req.files) {
      if (file.fieldname === "photo") {
        photoFile = file.path;
      } else if (file.fieldname.startsWith("gallery")) {
        galleryFiles.push(file.path);
      }
    }
  }

  try {
    if (photoFile) {
      photoUrl = await uploadPhoto(photoFile, "eventos");
      if (!photoUrl) {
        return res.status(500).json({
          status: "failed",
          success: false,
          message: "Error uploading photo to Cloudinary. Event not created.",
        });
      }
    }

    for (const galleryFile of galleryFiles) {
      const url = await uploadPhoto(galleryFile, "eventos");
      if (url) {
        galleryUrls.push(url);
      } else {
        console.warn(`Error uploading image: ${galleryFile}`);
      }
    }

    const TotalCapacity = Number(vipSize || 0) + Number(economySize || 0);

    const newEvent = new Event({
      name,
      venue,
      address,
      desc,
      vipprice,
      economyprice,
      vipSize,
      economySize,
      template,
      finalSeats,
      eventDate: eventDate ? new Date(eventDate) : null,
      eventTime: eventTime ? new Date(eventTime) : null,
      eventDateSec: eventDateSec ? new Date(eventDateSec) : null,
      eventTimeSec: eventTimeSec ? new Date(eventTimeSec) : null,
      user_id: req.user._id,
      TotalCapacity,
      currency,
      ticket,
      category,
      photo: photoUrl,
      gallery: galleryUrls,
      featured: featured === "true" || featured === true,
      published: published === "true" || published === true,
    });

    const savedEvent = await newEvent.save();

    return res.status(201).json({
      status: "success",
      success: true,
      message: "Event successfully created.",
      data: savedEvent,
    });
  } catch (err) {
    console.error("Error creating event:", err);
    return res.status(500).json({
      status: "failed",
      success: false,
      message: "Could not create the event. Please try again.",
      error: err.message,
    });
  } finally {
    cleanupFiles([photoFile, ...galleryFiles]);
  }
};

// 2) UPDATE EVENT
export const updateEvent = async (req, res) => {
  const id = req.query.id;

  if (!id || !isValidObjectId(id)) {
    return res.status(400).json({
      status: "failed",
      success: false,
      message: "Valid Event ID is required.",
    });
  }

  let photoFile = null;
  let galleryFiles = [];
  let photoUrl = null;
  let galleryUrls = [];

  if (req.files) {
    for (const file of req.files) {
      if (file.fieldname === "photo") {
        photoFile = file.path;
      } else if (file.fieldname.startsWith("gallery")) {
        galleryFiles.push(file.path);
      }
    }
  }

  try {
    const existingEvent = await Event.findById(id);
    if (!existingEvent) {
      return res.status(404).json({
        status: "failed",
        success: false,
        message: "Event not found.",
      });
    }

    if (photoFile) {
      photoUrl = await uploadPhoto(photoFile, "eventos");
      if (photoUrl && existingEvent.photo) {
        await deletePhoto(existingEvent.photo);
      }
    }

    for (const galleryFile of galleryFiles) {
      const url = await uploadPhoto(galleryFile, "eventos");
      if (url) {
        galleryUrls.push(url);
      }
    }

    const updatedData = { ...req.body };

    if (photoUrl) {
      updatedData.photo = photoUrl;
    }

    if (galleryUrls.length > 0) {
      updatedData.gallery = [...(existingEvent.gallery || []), ...galleryUrls];
    }

    if (
      updatedData.vipSize !== undefined ||
      updatedData.economySize !== undefined
    ) {
      const vSize =
        updatedData.vipSize !== undefined
          ? updatedData.vipSize
          : existingEvent.vipSize;
      const eSize =
        updatedData.economySize !== undefined
          ? updatedData.economySize
          : existingEvent.economySize;
      updatedData.TotalCapacity = Number(vSize || 0) + Number(eSize || 0);
    }

    const updatedEvent = await Event.findByIdAndUpdate(
      id,
      { $set: updatedData },
      { new: true },
    );

    return res.status(200).json({
      status: "success",
      success: true,
      message: "Event updated successfully.",
      data: updatedEvent,
    });
  } catch (err) {
    console.error("Error updating event:", err);
    return res.status(500).json({
      status: "failed",
      success: false,
      message: "The event could not be updated. Please try again.",
      error: err.message,
    });
  } finally {
    cleanupFiles([photoFile, ...galleryFiles]);
  }
};

// 3) GET SINGLE EVENT
export const getSingleEvent = async (req, res) => {
  const id = req.query.id;

  if (!id || !isValidObjectId(id)) {
    return res.status(400).json({
      status: "failed",
      success: false,
      message: "Valid Event ID is required.",
    });
  }

  try {
    const singleEvent = await Event.findById(id).populate(
      "user_id",
      "username email photo",
    );

    if (!singleEvent) {
      return res.status(404).json({
        status: "failed",
        success: false,
        message: "Event data not found.",
      });
    }

    const { user_id, ...eventData } = singleEvent.toObject();
    const transformedEvent = {
      ...eventData,
      owner: user_id
        ? {
            username: user_id.username,
            email: user_id.email,
            photo: user_id.photo,
          }
        : null,
    };

    return res.status(200).json({
      status: "success",
      success: true,
      message: "Successful",
      data: transformedEvent,
    });
  } catch (err) {
    console.error("Error fetching single event:", err);
    return res.status(500).json({
      status: "failed",
      success: false,
      message: "Internal Server Error.",
    });
  }
};

// 4) GET ALL EVENTS
export const getAllEvents = async (req, res) => {
  const page = parseInt(req.query.page) || 0;

  try {
    const allEvents = await Event.find({})
      .populate("user_id", "username email photo")
      .skip(page * 8)
      .limit(8);

    const transformedEvents = allEvents.map((event) => {
      const { user_id, ...eventData } = event.toObject();
      return {
        ...eventData,
        owner: user_id
          ? {
              username: user_id.username,
              email: user_id.email,
              photo: user_id.photo,
            }
          : null,
      };
    });

    return res.status(200).json({
      status: "success",
      success: true,
      count: transformedEvents.length,
      message: "Successful",
      data: transformedEvents,
    });
  } catch (err) {
    console.error("Error fetching all events:", err);
    return res.status(500).json({
      status: "failed",
      success: false,
      message: "Internal Server Error.",
    });
  }
};

// 5) DELETE EVENT
export const deleteEvent = async (req, res) => {
  const id = req.params.id;

  if (!id || !isValidObjectId(id)) {
    return res.status(400).json({
      status: "failed",
      success: false,
      message: "Valid Event ID is required.",
    });
  }

  try {
    const deletedEvent = await Event.findByIdAndDelete(id);

    if (!deletedEvent) {
      return res.status(404).json({
        status: "failed",
        success: false,
        message: "Event not found.",
      });
    }

    if (deletedEvent.photo) {
      await deletePhoto(deletedEvent.photo);
    }

    if (deletedEvent.gallery && deletedEvent.gallery.length > 0) {
      for (const url of deletedEvent.gallery) {
        await deletePhoto(url);
      }
    }

    return res.status(200).json({
      status: "success",
      success: true,
      message: "Event successfully deleted",
    });
  } catch (err) {
    console.error("Error deleting event:", err);
    return res.status(500).json({
      status: "failed",
      success: false,
      message: "The event cannot be deleted. Please try again.",
    });
  }
};

// 6) SEARCH EVENTS
export const getEventsBySearch = async (req, res) => {
  try {
    const query = {};

    if (req.query.name) {
      query.name = { $regex: new RegExp(req.query.name, "i") };
    }

    if (req.query.area) {
      query.address = { $regex: new RegExp(req.query.area, "i") };
    }

    if (req.query.eventTime) {
      const timeRegex = new RegExp(req.query.eventTime, "i");
      query.$or = query.$or || [];
      query.$or.push(
        { eventTime: { $regex: timeRegex } },
        { eventTimeSec: { $regex: timeRegex } },
      );
    }

    if (req.query.startDate && req.query.endDate) {
      const start = new Date(req.query.startDate);
      const end = new Date(req.query.endDate);
      end.setDate(end.getDate() + 1);

      query.$or = query.$or || [];
      query.$or.push(
        { eventDate: { $gte: start, $lt: end } },
        { eventDateSec: { $gte: start, $lt: end } },
      );
    }

    const events = await Event.find(query);

    return res.status(200).json({
      status: "success",
      success: true,
      message: "Events fetched successfully",
      data: events,
      count: events.length,
    });
  } catch (err) {
    console.error("Error during event search:", err);
    return res.status(500).json({
      status: "failed",
      success: false,
      message: "Failed to fetch events. Please try again later.",
    });
  }
};

// 7) GET FEATURED EVENTS
export const getFeaturedEvents = async (req, res) => {
  try {
    const featuredEvents = await Event.find({ featured: true }).limit(8);
    return res.status(200).json({
      status: "success",
      success: true,
      count: featuredEvents.length,
      message: "Success",
      data: featuredEvents,
    });
  } catch (err) {
    console.error("Error fetching featured events:", err);
    return res.status(500).json({
      status: "failed",
      success: false,
      message: "Error: Data not found.",
    });
  }
};

// 8) GET EVENTS COUNT
export const getEventsCount = async (req, res) => {
  try {
    const eventCount = await Event.estimatedDocumentCount();
    return res.status(200).json({
      status: "success",
      success: true,
      message: "Success",
      data: eventCount,
    });
  } catch (err) {
    console.error("Error getting events count:", err);
    return res.status(500).json({
      status: "failed",
      success: false,
      message: "Error: Failed to get data.",
    });
  }
};

// 9) PUBLISH EVENT
export const publishEvent = async (req, res) => {
  const { eventId } = req.body;
  try {
    if (!eventId || !isValidObjectId(eventId)) {
      return res.status(400).json({
        status: "failed",
        success: false,
        message: "Valid Event ID is required.",
      });
    }

    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({
        status: "failed",
        success: false,
        message: "Event not found",
      });
    }

    event.published = true;
    await event.save();

    return res.status(200).json({
      status: "success",
      success: true,
      message: "Event published successfully",
      data: event,
    });
  } catch (err) {
    console.error("Error publishing event:", err);
    return res.status(500).json({
      status: "failed",
      success: false,
      message: "Error publishing event",
      error: err.message,
    });
  }
};

// 10) FEATURE EVENT
export const featureEvent = async (req, res) => {
  const { eventId } = req.body;
  try {
    if (!eventId || !isValidObjectId(eventId)) {
      return res.status(400).json({
        status: "failed",
        success: false,
        message: "Valid Event ID is required.",
      });
    }

    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({
        status: "failed",
        success: false,
        message: "Event not found",
      });
    }

    event.featured = true;
    await event.save();

    return res.status(200).json({
      status: "success",
      success: true,
      message: "Event marked as featured successfully",
      data: event,
    });
  } catch (err) {
    console.error("Error featuring event:", err);
    return res.status(500).json({
      status: "failed",
      success: false,
      message: "Failed to mark event as featured",
      error: err.message,
    });
  }
};

// 11) GET EVENTS BY TIME AND NAME
export const getEventsByTimeAndName = async (req, res) => {
  const { name, startTime } = req.query;
  const query = {};
  let startDate, endDate;

  if (name) {
    query.name = new RegExp(name, "i");
  }

  if (startTime) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    switch (startTime.toLowerCase()) {
      case "today":
        startDate = new Date(today);
        endDate = new Date(today);
        endDate.setDate(today.getDate() + 1);
        break;
      case "this week":
        startDate = new Date(today);
        startDate.setDate(today.getDate() - today.getDay());
        endDate = new Date(startDate);
        endDate.setDate(startDate.getDate() + 7);
        break;
      case "this month":
        startDate = new Date(today);
        startDate.setDate(1);
        endDate = new Date(startDate);
        endDate.setMonth(startDate.getMonth() + 1);
        break;
      default:
        return res.status(400).json({
          status: "failed",
          success: false,
          message:
            "Invalid startTime value. Use 'today', 'this week', or 'this month'.",
        });
    }

    query.eventDate = { $gte: startDate, $lt: endDate };
  }

  try {
    const events = await Event.find(query);
    return res.status(200).json({
      status: "success",
      success: true,
      message: "Events fetched successfully",
      data: events,
    });
  } catch (err) {
    console.error("Error fetching events by time and name:", err);
    return res.status(500).json({
      status: "failed",
      success: false,
      message: "Error: Unable to fetch events. Please try again later.",
    });
  }
};

// 12) GET USER EVENTS
export const getUserEvents = async (req, res) => {
  try {
    const userId = req.user._id;

    if (!userId || !isValidObjectId(userId)) {
      return res.status(400).json({
        status: "failed",
        success: false,
        message: "Valid User ID is required.",
      });
    }

    const userEvents = await Event.find({ user_id: userId });

    if (!userEvents.length) {
      return res.status(404).json({
        status: "failed",
        success: false,
        message: "No events were found for this user.",
      });
    }

    return res.status(200).json({
      status: "success",
      success: true,
      message: "Events recovered successfully.",
      data: userEvents,
    });
  } catch (err) {
    console.error("Error getting user events:", err);
    return res.status(500).json({
      status: "failed",
      success: false,
      message: "Error retrieving events. Please try again.",
    });
  }
};

// 13) GET WALK-IN EVENTS
export const getWalkInEvents = async (req, res) => {
  try {
    const walkInEvents = await Event.find({ ticket: "Walk-in" });

    if (!walkInEvents.length) {
      return res.status(404).json({
        status: "failed",
        success: false,
        message: "No Walk-in events found.",
      });
    }

    return res.status(200).json({
      status: "success",
      success: true,
      message: "Walk-in events successfully found.",
      data: walkInEvents,
    });
  } catch (err) {
    console.error("Error getting Walk-in events:", err);
    return res.status(500).json({
      status: "failed",
      success: false,
      message: "Error retrieving Walk-in events. Please try again.",
    });
  }
};
