import User from "../models/user.model.js";
import jwt from "jsonwebtoken";

// 1) USER REGISTRATION
export const register = async (req, res) => {
  try {
    const { username, email, password, role, photo } = req.body;

    // Input Validation
    if (!username || !email || !password) {
      return res.status(400).json({
        status: "failed",
        success: false,
        message: "Username, email, and password are required fields",
      });
    }

    // Check for existing user to prevent duplicates
    const normalizedEmail = email.toLowerCase().trim();
    const existingUser = await User.findOne({ email: normalizedEmail });

    if (existingUser) {
      return res.status(409).json({
        status: "failed",
        success: false,
        message: "A user with this email already exists",
      });
    }

    // Create new user instance
    // Note: Password hashing is securely handled by the Mongoose pre-save hook in user.model.js
    const newUser = new User({
      username: username.trim(),
      email: normalizedEmail,
      password,
      role: role || "user",
      photo,
    });

    const registeredUser = await newUser.save();

    // Omit sensitive data (like password) from the response
    const { password: _, ...userResponse } = registeredUser._doc;

    return res.status(201).json({
      status: "success",
      success: true,
      message: "User successfully registered",
      data: userResponse,
    });
  } catch (err) {
    console.error("Registration Error:", err);
    return res.status(500).json({
      status: "failed",
      success: false,
      message: "An error occurred during registration. Please try again later.",
    });
  }
};

// 2) USER LOGIN
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Input Validation
    if (!email || !password) {
      return res.status(400).json({
        status: "failed",
        success: false,
        message: "Email and password are required fields",
      });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Find the user by email
    const user = await User.findOne({ email: normalizedEmail });

    // Prevent email enumeration by returning a generic error message
    if (!user) {
      return res.status(401).json({
        status: "failed",
        success: false,
        message: "Invalid email or password",
      });
    }

    // Verify password using the instance method defined in the model
    const isPasswordValid = await user.comparePassword(password);

    if (!isPasswordValid) {
      return res.status(401).json({
        status: "failed",
        success: false,
        message: "Invalid email or password",
      });
    }

    // Omit sensitive information from the user object before sending it to the client
    const { password: _, role, ...rest } = user._doc;

    // Ensure JWT Secret is configured
    if (!process.env.JWT_SECRET_KEY) {
      console.error("JWT_SECRET_KEY is missing in environment variables.");
      return res.status(500).json({
        status: "error",
        success: false,
        message: "Internal server error",
      });
    }

    // Generate JWT token
    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET_KEY,
      { expiresIn: "15d" },
    );

    // Secure cookie configuration
    const cookieOptions = {
      httpOnly: true,
      secure: true,
      sameSite: "none",
      maxAge: 15 * 24 * 60 * 60 * 1000, // 15 days in milliseconds
    };

    // Set cookie and respond
    return res
      .cookie("accessToken", token, cookieOptions)
      .status(200)
      .json({
        status: "success",
        success: true,
        message: "Login successful",
        token,
        data: { ...rest },
        role,
      });
  } catch (err) {
    console.error("Login Error:", err);
    return res.status(500).json({
      status: "failed",
      success: false,
      message: "An error occurred during login. Please try again later.",
    });
  }
};

// 3) USER LOGOUT
export const logout = async (req, res) => {
  try {
    const cookieOptions = {
      httpOnly: true,
      secure: true,
      sameSite: "none",
    };

    return res.clearCookie("accessToken", cookieOptions).status(200).json({
      status: "success",
      success: true,
      message: "Logged out successfully",
    });
  } catch (err) {
    console.error("Logout Error:", err);
    return res.status(500).json({
      status: "failed",
      success: false,
      message: "An error occurred during logout. Please try again later.",
    });
  }
};
