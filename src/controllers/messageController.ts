import { RequestHandler } from "express";
import { generateGPTResponse, classifyMessage } from "../services/gptService";
import { redisClient, connectRedis } from "../services/redisService";
import { Request, Response } from "express";
import { v4 as uuidv4 } from "uuid";

type Message = {
  role: "user" | "system";
  content: string;
};

export const sendMessage: RequestHandler = async (req, res) => {
  const { userId, message } = req.body;

  if (!userId || !message) {
    res.status(400).json({ error: "userId and message are required" });
    return;
  }

  const activeFlowKey = `context:${userId}:activeFlow`;
  let currentFlow = await redisClient.get(activeFlowKey);

  /*
    The assignment didn't specify logic for switching between flows.
    As a result, the only way to access a "normal" flow is to send a message before initiating the check-in flow.
  */
  if (!currentFlow) currentFlow = "normal";

  const conversationsKey = `context:${userId}:${currentFlow}:conversations`;
  let conversations = await redisClient.lRange(conversationsKey, -1, -1);

  let conversationId;
  let messages: Message[];

  if (conversations.length > 0) {
    conversationId = conversations[0];
    const conversationKey = `context:${userId}:${currentFlow}:${conversationId}`;
    const context = await redisClient.hGet(conversationKey, "messages");
    messages = context ? JSON.parse(context) : [];
  } else {
    // Start a new conversation if none exist
    conversationId = uuidv4();
    await redisClient.rPush(conversationsKey, conversationId);
    messages = [];
  }

  messages.push({ role: "user", content: message });

  const category = await classifyMessage(message);
  const systemResponse = await getGPTResponse(category, messages);

  messages.push({ role: "system", content: systemResponse });

  const conversationKey = `context:${userId}:${currentFlow}:${conversationId}`;
  await redisClient.hSet(conversationKey, {
    messages: JSON.stringify(messages),
  });

  res.json({
    userId,
    flow: currentFlow,
    conversationId,
    category,
    response: systemResponse,
  });
};

export const initiateCheckIn: RequestHandler = async (req, res) => {
  const { userId } = req.body;

  if (!userId) {
    res.status(400).json({ error: "userId is required" });
    return;
  }

  const activeFlowKey = `context:${userId}:activeFlow`;
  await redisClient.set(activeFlowKey, "check-in");

  const conversationsKey = `context:${userId}:check-in:conversations`;
  const conversationId = uuidv4();

  await redisClient.rPush(conversationsKey, conversationId);

  const conversationKey = `context:${userId}:check-in:${conversationId}`;
  const initialMessage = {
    role: "system",
    content: "Hi! How are you doing today?",
  };

  await redisClient.hSet(conversationKey, {
    messages: JSON.stringify([initialMessage]),
  });

  res.json({ userId, conversationId, message: initialMessage.content });
};

export const getContext = async (req: Request, res: Response) => {
  const { userId } = req.params;

  if (!userId) {
    res.status(400).json({ error: "userId is required" });
    return;
  }

  const activeFlowKey = `context:${userId}:activeFlow`;
  const activeFlow = await redisClient.get(activeFlowKey);

  const getConversations = async (flow: string) => {
    const conversationsKey = `context:${userId}:${flow}:conversations`;
    const conversationIds = await redisClient.lRange(conversationsKey, 0, -1);
    const conversations = [];

    for (const id of conversationIds) {
      const conversationKey = `context:${userId}:${flow}:${id}`;
      const context = await redisClient.hGet(conversationKey, "messages");
      const messages = context ? JSON.parse(context) : [];
      conversations.push({ conversationId: id, messages });
    }

    return conversations;
  };

  const normalConversations = await getConversations("normal");
  const checkInConversations = await getConversations("check-in");

  res.json({
    userId,
    activeFlow: activeFlow || "normal",
    contexts: {
      normal: normalConversations,
      "check-in": checkInConversations,
    },
  });
};

export const updateContext = async (req: Request, res: Response) => {
  const { userId, flow, conversationId, contextUpdates } = req.body;

  if (
    !userId ||
    !flow ||
    !conversationId ||
    !contextUpdates ||
    typeof contextUpdates !== "object"
  ) {
    res.status(400).json({
      error: "userId, flow, conversationId, and contextUpdates are required",
    });
    return;
  }

  if (!["normal", "check-in"].includes(flow)) {
    res
      .status(400)
      .json({ error: 'Invalid flow. Must be "normal" or "check-in"' });
    return;
  }

  const conversationKey = `context:${userId}:${flow}:${conversationId}`;

  const existingContext = await redisClient.hGet(conversationKey, "messages");
  let messages = existingContext ? JSON.parse(existingContext) : [];

  if (contextUpdates.messages && Array.isArray(contextUpdates.messages)) {
    messages = [...messages, ...contextUpdates.messages];
    contextUpdates.messages = JSON.stringify(messages);
  }

  await redisClient.hSet(conversationKey, contextUpdates);

  res.json({
    userId,
    flow,
    conversationId,
    message: "Context updated successfully",
    contextUpdates,
  });
};

export async function getGPTResponse(category: string, messages: Message[]) {
  let systemResponse = "";
  if (category.toLowerCase().includes("suicide")) {
    systemResponse =
      "I'm really sorry you're feeling this way. Please talk to a mental health professional or contact a crisis hotline right away. Your safety is very important.";
  } else if (category.toLowerCase().includes("faq")) {
    systemResponse = "Please refer to https://www.clareandme.com/faq.";
  } else {
    const gptPrompt = messages
      .map((m: Message) => `${m.role}: ${m.content}`)
      .join("\n");
    systemResponse = await generateGPTResponse(gptPrompt);
  }
  return systemResponse;
}
