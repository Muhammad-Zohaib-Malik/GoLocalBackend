import User from "../models/user.model.js";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import fs from "fs";
import { uploadPhoto, deletePhoto } from "../utils/cloudinary.js";

// Helper for validating Object ID
const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

// 1) Create a new user
export const createNewUser = async (req, res) => {
  const { username, email, password, role = "usuario", fullname } = req.body;
  const file = req.file?.path;

  try {
    // Validation
    if (!username || !email || !password) {
      return res.status(400).json({
        status: "failed",
        success: false,
        message: "Username, email, and password are required.",
      });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const existingUser = await User.findOne({ email: normalizedEmail });

    if (existingUser) {
      return res.status(409).json({
        status: "failed",
        success: false,
        message: "A user with this email already exists.",
      });
    }

    const photoUrl = file ? await uploadPhoto(file, "users") : null;

    // Create user (password is automatically hashed via pre-save hook)
    const newUser = new User({
      username: username.trim(),
      email: normalizedEmail,
      password,
      role,
      photo: photoUrl,
      fullname: fullname?.trim(),
    });

    const savedUser = await newUser.save();

    // Omit sensitive data before responding
    const { password: _, ...userResponse } = savedUser._doc;

    return res.status(201).json({
      status: "success",
      success: true,
      message: "The user has been created successfully.",
      data: userResponse,
    });
  } catch (err) {
    console.error("Error creating user:", err);
    return res.status(500).json({
      status: "failed",
      success: false,
      message: "The user could not be created. Please try again.",
    });
  } finally {
    if (file && fs.existsSync(file)) {
      fs.unlinkSync(file);
    }
  }
};

// 2) Login User
export const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        status: "failed",
        success: false,
        message: "Email and password are required.",
      });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const user = await User.findOne({ email: normalizedEmail });

    // Prevent email enumeration
    if (!user) {
      return res.status(401).json({
        status: "failed",
        success: false,
        message: "Invalid email or password.",
      });
    }

    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      return res.status(401).json({
        status: "failed",
        success: false,
        message: "Invalid email or password.",
      });
    }

    if (!process.env.JWT_SECRET_KEY) {
      console.error("JWT_SECRET_KEY is missing in environment variables.");
      return res.status(500).json({
        status: "error",
        success: false,
        message: "Internal server error.",
      });
    }

    const tokenPayload = {
      id: user._id,
      email: user.email,
      role: user.role,
    };

    const token = jwt.sign(tokenPayload, process.env.JWT_SECRET_KEY, {
      expiresIn: "30d",
    });

    // Secure cookie configuration
    const cookieOptions = {
      httpOnly: true,
      secure: true,
      sameSite: "none",
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    };

    return res
      .cookie("accessToken", token, cookieOptions)
      .status(200)
      .json({
        status: "success",
        success: true,
        message: "Login successful.",
        data: {
          token,
          user: {
            id: user._id,
            username: user.username,
            email: user.email,
            role: user.role,
            fullname: user.fullname,
            photo: user.photo,
          },
        },
      });
  } catch (err) {
    console.error("Error during login:", err);
    return res.status(500).json({
      status: "failed",
      success: false,
      message: "There was an error during login. Please try again.",
    });
  }
};

// 3) Update User
export const updateUser = async (req, res) => {
  const id = req.query.id || req.user?._id;
  const file = req.file?.path;
  const { password, email, username, ...updateFields } = req.body;

  try {
    if (!id || !isValidObjectId(id)) {
      return res.status(400).json({
        status: "failed",
        success: false,
        message: "Valid user ID is required.",
      });
    }

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({
        status: "failed",
        success: false,
        message: "The user could not be found.",
      });
    }

    if (file) {
      const photoUrl = await uploadPhoto(file, "users");
      if (photoUrl) {
        if (user.photo) {
          await deletePhoto(user.photo); // Delete old photo if it exists
        }
        user.photo = photoUrl;
      }
    }

    if (email) {
      const normalizedEmail = email.toLowerCase().trim();
      const emailExists = await User.findOne({
        email: normalizedEmail,
        _id: { $ne: id },
      });
      if (emailExists) {
        return res.status(409).json({
          status: "failed",
          success: false,
          message: "Email is already in use by another account.",
        });
      }
      user.email = normalizedEmail;
    }

    if (username) user.username = username.trim();
    if (password) user.password = password; // Trigger pre-save hook

    // Apply remaining fields dynamically
    Object.keys(updateFields).forEach((key) => {
      user[key] = updateFields[key];
    });

    const updatedUser = await user.save();

    // Omit sensitive data
    const { password: _, ...userResponse } = updatedUser._doc;

    return res.status(200).json({
      status: "success",
      success: true,
      message: "The user has been successfully updated.",
      data: userResponse,
    });
  } catch (err) {
    console.error("Error updating user:", err);
    return res.status(500).json({
      status: "failed",
      success: false,
      message: "The user could not be updated. Please try again.",
    });
  } finally {
    if (file && fs.existsSync(file)) {
      fs.unlinkSync(file);
    }
  }
};

// 4) Delete User
export const deleteUser = async (req, res) => {
  const id = req.query.id;

  try {
    if (!id || !isValidObjectId(id)) {
      return res.status(400).json({
        status: "failed",
        success: false,
        message: "Valid user ID is required.",
      });
    }

    const deletedUser = await User.findByIdAndDelete(id);
    if (!deletedUser) {
      return res.status(404).json({
        status: "failed",
        success: false,
        message: "The user could not be found.",
      });
    }

    // Delete photo from Cloudinary if it exists
    if (deletedUser.photo) {
      await deletePhoto(deletedUser.photo);
    }

    return res.status(200).json({
      status: "success",
      success: true,
      message: "The user has been successfully deleted.",
    });
  } catch (err) {
    console.error("Error deleting user:", err);
    return res.status(500).json({
      status: "failed",
      success: false,
      message: "The user could not be deleted. Please try again.",
    });
  }
};

// 5) Get Single User
export const getSingleUser = async (req, res) => {
  const id = req.query.id || req.user?._id;

  try {
    if (!id || !isValidObjectId(id)) {
      return res.status(400).json({
        status: "failed",
        success: false,
        message: "Valid user ID is required.",
      });
    }

    const singleUser = await User.findById(id).select(
      "-password -refreshToken",
    );

    if (!singleUser) {
      return res.status(404).json({
        status: "failed",
        success: false,
        message: "User data could not be found.",
      });
    }

    return res.status(200).json({
      status: "success",
      success: true,
      message: "Success.",
      data: singleUser,
    });
  } catch (err) {
    console.error("Error getting user data:", err);
    return res.status(500).json({
      status: "failed",
      success: false,
      message: "Could not get user data.",
    });
  }
};

// 6) Get All Users
export const getAllUsers = async (req, res) => {
  try {
    const allUsers = await User.find({}).select("-password -refreshToken");

    return res.status(200).json({
      status: "success",
      success: true,
      message: "Success.",
      count: allUsers.length,
      data: allUsers,
    });
  } catch (err) {
    console.error("Error getting all users:", err);
    return res.status(500).json({
      status: "failed",
      success: false,
      message: "Data could not be retrieved.",
    });
  }
};
