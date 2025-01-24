import express from "express";
import {
  deleteUser,
  getAllUser,
  getDetails,
  newUser,
} from "../controllers/user.js";
import { adminOnly } from "../middlewares/auth.js";

const app = express.Router();

app.post("/new", newUser);
app.get("/all", adminOnly, getAllUser);
app.route("/:id").get(getDetails).delete(adminOnly, deleteUser);

export default app;
