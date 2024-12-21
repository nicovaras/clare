import { createClient } from "redis";
import dotenv from "dotenv";

dotenv.config();

const redisClient = createClient({
  url: process.env.REDIS_URL,
});

redisClient.on("error", (err) => {
  console.error("Redis Client Error:", err);
});

async function connectRedis() {
  if (!redisClient.isOpen) {
    await redisClient.connect().catch((err) => {
      console.error("Failed to connect to Redis:", err);
    });
  }
}

connectRedis();

export { redisClient, connectRedis };
