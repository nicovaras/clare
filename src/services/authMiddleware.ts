import { Request, Response, NextFunction } from "express";
import dotenv from "dotenv";

dotenv.config();

const VALID_TOKENS = process.env.VALID_TOKENS?.split(",") || [];

export const authenticate = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const authHeader = req.headers["authorization"];

  if (!authHeader) {
    res.status(401).json({ error: "Authorization header missing" });
    return;
  }

  const token = authHeader.split(" ")[1]; // Extract the token after "Bearer"

  if (!VALID_TOKENS.includes(token)) {
    res.status(403).json({ error: "Invalid or missing token" });
    return;
  }

  next();
};
