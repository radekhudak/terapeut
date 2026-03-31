import { describe, it, expect } from "vitest";

describe("Coaching API basic validation", () => {
  it("tasks GET returns 400 without userId", async () => {
    const { GET } = await import("@/app/api/coaching/tasks/route");
    const request = new Request("http://localhost/api/coaching/tasks");
    const response = await GET(request as never);
    expect(response.status).toBe(400);
  });

  it("topics GET returns 400 without userId", async () => {
    const { GET } = await import("@/app/api/coaching/topics/route");
    const request = new Request("http://localhost/api/coaching/topics");
    const response = await GET(request as never);
    expect(response.status).toBe(400);
  });

  it("daily routine GET returns 400 with invalid userId", async () => {
    const { GET } = await import("@/app/api/coaching/daily-routine/route");
    const request = new Request(
      "http://localhost/api/coaching/daily-routine?userId=invalid"
    );
    const response = await GET(request as never);
    expect(response.status).toBe(400);
  });

  it("daily routine complete returns 400 with invalid body", async () => {
    const { POST } = await import(
      "@/app/api/coaching/daily-routine/complete/route"
    );
    const request = new Request(
      "http://localhost/api/coaching/daily-routine/complete",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: "invalid", routineId: "invalid" }),
      }
    );
    const response = await POST(request as never);
    expect(response.status).toBe(400);
  });
});
