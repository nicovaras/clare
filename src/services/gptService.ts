import { OpenAI } from "openai";
import dotenv from "dotenv";

dotenv.config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function generateGPTResponse(prompt: string): Promise<string> {
  const clarePrompt = `
        You are Clare, a compassionate and highly skilled CBT specialist. 
        Your role is to guide the user through their challenges with empathy and evidence-based cognitive-behavioral techniques. 
        Engage with the user thoughtfully and provide actionable advice.
        Here is the user's input: "${prompt}"`;

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: clarePrompt }],
  });
  return (
    completion.choices[0]?.message?.content?.trim() || "No response generated."
  );
}

export async function classifyMessage(message: string): Promise<string> {
  const classificationPrompt = `
    Classify the following message into one of these categories: General, FAQ, Suicide Risk.
    Only output "General", "FAQ" or "Suicide Risk".
    It is FAQ if it is a question about one of these:
        * How do I get started with the product?
        * Can Clare help me with emotional problems, such as anxiety?
        * Is this anonymous?
        * Can I call anytime?
        * It's my first time with a virtual assistant, how should I behave?
        * Does Clare offer psychotherapy?
        * Is Clare the right solution for me?
        * Can talking to Clare replace my traditional therapy?
        * Where can I leave a review?
        * What is clare&me?
        * Is Clare a human?
        * How does it work?
        * What can Clare do?
        * Can I speak to Clare as I would with a human being?
        * Are there any useful commands Clare understands, that will improve our communication?
        * What are the costs of talking to Clare?
        * How can I cancel my subscription?
        * How can I edit my payment details? I used a PayPal account.
        * How can I edit my payment details? I don't have a PayPal account.
    Message: "${message}"
    Category: 
  `;

  const classification = await generateGPTResponse(classificationPrompt);
  return classification;
}
