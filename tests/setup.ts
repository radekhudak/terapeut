// Global test setup
// Mock environment variables for tests
process.env.OPENAI_API_KEY = "sk-test-key-for-testing-purposes-only";
process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test";
process.env.ENCRYPTION_KEY =
  "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";
// @ts-expect-error -- assigning for test environment
process.env.NODE_ENV = "test";
