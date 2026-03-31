import { describe, it, expect, vi, beforeEach } from "vitest";

const mockUser = {
  id: "test-uuid",
  displayName: null,
  email: null,
  authProvider: null,
  authProviderId: null,
  avatarUrl: null,
  isAnonymous: true,
  createdAt: new Date(),
  lastSeenAt: new Date(),
};

vi.mock("@/db", () => {
  const mockReturning = vi.fn().mockResolvedValue([mockUser]);
  const mockValues = vi.fn().mockReturnValue({ returning: mockReturning });
  const mockInsert = vi.fn().mockReturnValue({ values: mockValues });

  const mockLimit = vi.fn().mockResolvedValue([mockUser]);
  const mockWhere = vi.fn().mockReturnValue({ limit: mockLimit });
  const mockFrom = vi.fn().mockReturnValue({ where: mockWhere });
  const mockSelect = vi.fn().mockReturnValue({ from: mockFrom });

  const mockUpdateWhere = vi.fn().mockResolvedValue(undefined);
  const mockSet = vi.fn().mockReturnValue({ where: mockUpdateWhere });
  const mockUpdate = vi.fn().mockReturnValue({ set: mockSet });

  return {
    db: {
      insert: mockInsert,
      select: mockSelect,
      update: mockUpdate,
    },
    schema: {
      users: { id: "id" },
    },
  };
});

vi.mock("@/lib/logger", () => ({
  log: vi.fn(),
}));

describe("/api/users", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("POST creates anonymous user", async () => {
    const { POST } = await import("@/app/api/users/route");
    const { db } = await import("@/db");

    const request = new Request("http://localhost/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });

    const response = await POST(request as any);
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.id).toBe("test-uuid");
    expect(data.isAnonymous).toBe(true);
    expect(db.insert).toHaveBeenCalled();
  });

  it("POST creates user with displayName", async () => {
    const { POST } = await import("@/app/api/users/route");

    const request = new Request("http://localhost/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ displayName: "Jan Novák" }),
    });

    const response = await POST(request as any);
    expect(response.status).toBe(201);
  });

  it("GET returns user by id", async () => {
    const { GET } = await import("@/app/api/users/route");

    const request = new Request(
      "http://localhost/api/users?id=test-uuid"
    );

    const response = await GET(request as any);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.id).toBe("test-uuid");
  });

  it("GET returns 400 without id", async () => {
    const { GET } = await import("@/app/api/users/route");

    const request = new Request("http://localhost/api/users");
    const response = await GET(request as any);

    expect(response.status).toBe(400);
  });
});
