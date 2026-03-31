import { Queue, Worker, type Job } from "bullmq";
import IORedis from "ioredis";
import { env } from "./env";

let connection: IORedis | null = null;

export function getRedisConnection(): IORedis {
  if (!connection) {
    connection = new IORedis(env.REDIS_URL, {
      maxRetriesPerRequest: null,
    });
  }
  return connection;
}

export const insightQueue = new Queue("trigger_insight", {
  connection: getRedisConnection(),
  defaultJobOptions: {
    removeOnComplete: 100,
    removeOnFail: 50,
    attempts: 3,
    backoff: { type: "exponential", delay: 1000 },
  },
});

export type InsightJobData = {
  messageId: string;
  userId: string;
  sessionId: string;
  content: string;
  voiceSentiment?: string;
};

export function createInsightWorker(
  processor: (job: Job<InsightJobData>) => Promise<void>
) {
  return new Worker<InsightJobData>("trigger_insight", processor, {
    connection: getRedisConnection(),
    concurrency: 5,
  });
}
