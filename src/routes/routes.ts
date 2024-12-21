import { Router } from "express";
import {
  sendMessage,
  initiateCheckIn,
  getContext,
  updateContext,
} from "../controllers/messageController";
import { authenticate } from "../services/authMiddleware";

const router = Router();

router.post("/send-message", authenticate, sendMessage);
router.post("/initiate-check-in", authenticate, initiateCheckIn);
router.get("/get-context/:userId", authenticate, getContext);
router.post("/update-context", authenticate, updateContext);

export default router;
