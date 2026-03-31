import { describe, it, expect, vi, beforeEach } from "vitest";
import { z } from "zod";
import { BaseAgent } from "@/agents/base-agent";

// Mock OpenAI
vi.mock("@/lib/openai", () => ({
  chatCompletion: vi.fn(),
}));

vi.mock("@/lib/logger", () => ({
  log: vi.fn(),
}));

const TestOutputSchema = z.object({
  answer: z.string(),
  confidence: z.number().min(0).max(1).catch(0.5),
  tags: z.array(z.string()).catch([]),
});
type TestOutput = z.infer<typeof TestOutputSchema>;

class TestAgent extends BaseAgent<TestOutput> {
  name = "TestAgent";
  outputSchema = TestOutputSchema;
  systemPrompt = "You are a test agent. Respond in JSON.";
}

describe("BaseAgent", () => {
  let agent: TestAgent;

  beforeEach(() => {
    agent = new TestAgent();
    vi.clearAllMocks();
  });

  it("parses valid JSON response", async () => {
    const { chatCompletion } = await import("@/lib/openai");
    vi.mocked(chatCompletion).mockResolvedValueOnce(
      JSON.stringify({ answer: "hello", confidence: 0.8, tags: ["test"] })
    );

    const result = await agent.run([
      { role: "user", content: "test question" },
    ]);
    expect(result.answer).toBe("hello");
    expect(result.confidence).toBe(0.8);
    expect(result.tags).toEqual(["test"]);
  });

  it("uses .catch() defaults for invalid fields", async () => {
    const { chatCompletion } = await import("@/lib/openai");
    vi.mocked(chatCompletion).mockResolvedValueOnce(
      JSON.stringify({ answer: "hello", confidence: "not_a_number" })
    );

    const result = await agent.run([
      { role: "user", content: "test question" },
    ]);
    expect(result.answer).toBe("hello");
    expect(result.confidence).toBe(0.5);
    expect(result.tags).toEqual([]);
  });

  it("retries on invalid JSON", async () => {
    const { chatCompletion } = await import("@/lib/openai");
    vi.mocked(chatCompletion)
      .mockResolvedValueOnce("not json at all")
      .mockResolvedValueOnce(
        JSON.stringify({ answer: "retry worked", confidence: 0.9 })
      );

    const result = await agent.run([
      { role: "user", content: "test question" },
    ]);
    expect(result.answer).toBe("retry worked");
    expect(chatCompletion).toHaveBeenCalledTimes(2);
  });

  it("throws after max retries", async () => {
    const { chatCompletion } = await import("@/lib/openai");
    vi.mocked(chatCompletion)
      .mockResolvedValueOnce("bad")
      .mockResolvedValueOnce("still bad")
      .mockResolvedValueOnce("really bad");

    await expect(
      agent.run([{ role: "user", content: "test" }])
    ).rejects.toThrow();
    expect(chatCompletion).toHaveBeenCalledTimes(3);
  });

  it("includes context in messages when provided", async () => {
    const { chatCompletion } = await import("@/lib/openai");
    vi.mocked(chatCompletion).mockResolvedValueOnce(
      JSON.stringify({ answer: "ok", confidence: 0.5 })
    );

    await agent.run([{ role: "user", content: "test" }], {
      traits: { mood: "happy" },
    });

    const callArgs = vi.mocked(chatCompletion).mock.calls[0][0];
    expect(callArgs).toHaveLength(3); // system + context + user
    expect((callArgs[1] as { content: string }).content).toContain("Context");
  });
});
