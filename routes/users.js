import express from "express";
import { verifyAdmin, verifyJWT } from "../utils/verifyToken.js";
import {
  createNewUser,
  deleteUser,
  getAllUsers,
  getSingleUser,
  updateUser,
  loginUser,
  logoutUser,
} from "../controllers/user.controller.js";
import { upload } from "../middlewares/multer.middleware.js";
const router = express.Router();
router.post("/loginUser", loginUser);
router.post("/logout", logoutUser);
router.post("/createUser", upload.single("photo"), createNewUser);
router.put("/updateUser", upload.single("photo"), verifyJWT, updateUser);
router.delete("/deleteUser", verifyAdmin, deleteUser);
router.get("/getUser", verifyJWT, getSingleUser);
router.get("/getAllUsers", verifyAdmin, getAllUsers);

export default router;
