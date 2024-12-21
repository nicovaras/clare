import {
  sendMessage,
  initiateCheckIn,
  getContext,
  updateContext,
  getGPTResponse,
} from "../src/controllers/messageController";
import { v4 as uuidv4 } from "uuid";
import {
  classifyMessage,
  generateGPTResponse,
} from "../src/services/gptService";
import { redisClient } from "../src/services/redisService";
import { Request, Response, NextFunction } from "express";

type Message = {
  role: "user" | "system";
  content: string;
};

jest.mock("uuid", () => ({ v4: jest.fn() }));
jest.mock("../src/services/redisService", () => ({
  redisClient: {
    get: jest.fn(),
    lRange: jest.fn(),
    hGet: jest.fn(),
    hSet: jest.fn(),
    rPush: jest.fn(),
    set: jest.fn(),
  },
}));
jest.mock("../src/services/gptService", () => ({
  classifyMessage: jest.fn(),
  generateGPTResponse: jest.fn(),
}));

const mockNext: NextFunction = jest.fn();
const mockResponse = (): Partial<Response> => ({
  status: jest.fn().mockReturnThis(),
  json: jest.fn(),
});

describe("sendMessage", () => {
  const userId = "123";
  const message = "Hello";

  beforeEach(() => {
    jest.clearAllMocks();
    (generateGPTResponse as jest.Mock).mockResolvedValue("System response");
  });

  it("should return 400 if userId or message is missing", async () => {
    const req: Partial<Request> = { body: { userId: "", message: "" } };
    const res = mockResponse() as Response;

    await sendMessage(req as Request, res, mockNext);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: "userId and message are required",
    });
  });

  it("should fetch an existing conversation and append the message", async () => {
    const req: Partial<Request> = { body: { userId, message } };
    const res = mockResponse() as Response;

    (redisClient.get as jest.Mock).mockResolvedValue("normal");
    (redisClient.lRange as jest.Mock).mockResolvedValue(["conversation-id-1"]);
    (redisClient.hGet as jest.Mock).mockResolvedValue(
      JSON.stringify([{ role: "user", content: "Hi" }])
    );
    (classifyMessage as jest.Mock).mockResolvedValue("general");

    await sendMessage(req as Request, res, mockNext);

    expect(redisClient.hSet).toHaveBeenCalledWith(
      "context:123:normal:conversation-id-1",
      {
        messages: JSON.stringify([
          { role: "user", content: "Hi" },
          { role: "user", content: "Hello" },
          { role: "system", content: "System response" },
        ]),
      }
    );
    expect(res.json).toHaveBeenCalledWith({
      userId,
      flow: "normal",
      conversationId: "conversation-id-1",
      category: "general",
      response: "System response",
    });
  });

  it("should start a new conversation if no existing conversations are found", async () => {
    const req: Partial<Request> = { body: { userId, message } };
    const res = mockResponse() as Response;

    (redisClient.get as jest.Mock).mockResolvedValue("normal");
    (redisClient.lRange as jest.Mock).mockResolvedValue([]);
    (redisClient.hGet as jest.Mock).mockResolvedValue(null);
    (uuidv4 as jest.Mock).mockReturnValue("new-conversation-id");
    (classifyMessage as jest.Mock).mockResolvedValue("general");

    await sendMessage(req as Request, res, mockNext);

    expect(redisClient.rPush).toHaveBeenCalledWith(
      "context:123:normal:conversations",
      "new-conversation-id"
    );
    expect(redisClient.hSet).toHaveBeenCalledWith(
      "context:123:normal:new-conversation-id",
      {
        messages: JSON.stringify([
          { role: "user", content: "Hello" },
          { role: "system", content: "System response" },
        ]),
      }
    );
    expect(res.json).toHaveBeenCalledWith({
      userId,
      flow: "normal",
      conversationId: "new-conversation-id",
      category: "general",
      response: "System response",
    });
  });
});

describe("initiateCheckIn", () => {
  const userId = "123";

  beforeEach(() => {
    jest.clearAllMocks();
    (uuidv4 as jest.Mock).mockReturnValue("new-check-in-id");
  });

  it("should return 400 if userId is missing", async () => {
    const req: Partial<Request> = { body: { userId: "" } };
    const res = mockResponse() as Response;

    await initiateCheckIn(req as Request, res, mockNext);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: "userId is required" });
  });

  it("should initiate a check-in conversation", async () => {
    const req: Partial<Request> = { body: { userId } };
    const res = mockResponse() as Response;

    await initiateCheckIn(req as Request, res, mockNext);

    expect(redisClient.set).toHaveBeenCalledWith(
      `context:${userId}:activeFlow`,
      "check-in"
    );
    expect(redisClient.rPush).toHaveBeenCalledWith(
      `context:${userId}:check-in:conversations`,
      "new-check-in-id"
    );
    expect(redisClient.hSet).toHaveBeenCalledWith(
      `context:${userId}:check-in:new-check-in-id`,
      {
        messages: JSON.stringify([
          { role: "system", content: "Hi! How are you doing today?" },
        ]),
      }
    );
    expect(res.json).toHaveBeenCalledWith({
      userId,
      conversationId: "new-check-in-id",
      message: "Hi! How are you doing today?",
    });
  });
});

describe("getContext", () => {
  const userId = "123";

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should return 400 if userId is missing", async () => {
    const req: Partial<Request> = { params: { userId: "" } };
    const res = mockResponse() as Response;

    await getContext(req as Request, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: "userId is required" });
  });

  it("should retrieve context for normal and check-in flows", async () => {
    const req: Partial<Request> = { params: { userId } };
    const res = mockResponse() as Response;

    (redisClient.get as jest.Mock).mockResolvedValue("normal");
    (redisClient.lRange as jest.Mock).mockImplementation((key) => {
      if (key === `context:${userId}:normal:conversations`)
        return ["normal-convo-1"];
      if (key === `context:${userId}:check-in:conversations`)
        return ["check-in-convo-1"];
      return [];
    });
    (redisClient.hGet as jest.Mock).mockImplementation((key) => {
      if (key === `context:${userId}:normal:normal-convo-1`)
        return JSON.stringify([{ role: "user", content: "Hello" }]);
      if (key === `context:${userId}:check-in:check-in-convo-1`)
        return JSON.stringify([
          { role: "system", content: "Hi! How are you doing today?" },
        ]);
      return null;
    });

    await getContext(req as Request, res);

    expect(res.json).toHaveBeenCalledWith({
      userId,
      activeFlow: "normal",
      contexts: {
        normal: [
          {
            conversationId: "normal-convo-1",
            messages: [{ role: "user", content: "Hello" }],
          },
        ],
        "check-in": [
          {
            conversationId: "check-in-convo-1",
            messages: [
              { role: "system", content: "Hi! How are you doing today?" },
            ],
          },
        ],
      },
    });
  });
});

describe("updateContext", () => {
  const userId = "123";
  const flow = "normal";
  const conversationId = "convo-1";

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should return 400 if required fields are missing", async () => {
    const req: Partial<Request> = {
      body: { userId: "", flow: "", conversationId: "", contextUpdates: null },
    };
    const res = mockResponse() as Response;

    await updateContext(req as Request, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: "userId, flow, conversationId, and contextUpdates are required",
    });
  });

  it("should return 400 if flow is invalid", async () => {
    const req: Partial<Request> = {
      body: { userId, flow: "invalid", conversationId, contextUpdates: {} },
    };
    const res = mockResponse() as Response;

    await updateContext(req as Request, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Invalid flow. Must be "normal" or "check-in"',
    });
  });

  it("should update the context successfully", async () => {
    const req: Partial<Request> = {
      body: {
        userId,
        flow,
        conversationId,
        contextUpdates: {
          messages: [{ role: "user", content: "New message" }],
        },
      },
    };
    const res = mockResponse() as Response;

    (redisClient.hGet as jest.Mock).mockResolvedValue(
      JSON.stringify([{ role: "system", content: "Initial message" }])
    );

    await updateContext(req as Request, res);

    expect(redisClient.hGet).toHaveBeenCalledWith(
      `context:${userId}:${flow}:${conversationId}`,
      "messages"
    );
    expect(redisClient.hSet).toHaveBeenCalledWith(
      `context:${userId}:${flow}:${conversationId}`,
      {
        messages: JSON.stringify([
          { role: "system", content: "Initial message" },
          { role: "user", content: "New message" },
        ]),
      }
    );
    expect(res.json).toHaveBeenCalledWith({
      userId,
      flow,
      conversationId,
      message: "Context updated successfully",
      contextUpdates: {
        messages: JSON.stringify([
          { role: "system", content: "Initial message" },
          { role: "user", content: "New message" },
        ]),
      },
    });
  });
});

describe("getGPTResponse", () => {
  it("should return a suicide prevention response for suicide-related categories", async () => {
    const messages: Message[] = [
      { role: "user", content: "I feel like giving up" },
    ];
    const response = await getGPTResponse("suicide", messages);

    expect(response).toBe(
      "I'm really sorry you're feeling this way. Please talk to a mental health professional or contact a crisis hotline right away. Your safety is very important."
    );
  });

  it("should return an FAQ response for faq-related categories", async () => {
    const messages: Message[] = [
      { role: "user", content: "How does this work?" },
    ];
    const response = await getGPTResponse("faq", messages);

    expect(response).toBe("Please refer to https://www.clareandme.com/faq.");
  });

  it("should generate a response using GPT for other categories", async () => {
    const messages: Message[] = [
      { role: "user", content: "Tell me something interesting" },
      { role: "system", content: "Sure, what would you like to know?" },
    ];

    (generateGPTResponse as jest.Mock).mockResolvedValue(
      "Here is an interesting fact."
    );

    const response = await getGPTResponse("general", messages);

    expect(generateGPTResponse).toHaveBeenCalledWith(
      "user: Tell me something interesting\nsystem: Sure, what would you like to know?"
    );
    expect(response).toBe("Here is an interesting fact.");
  });
});
