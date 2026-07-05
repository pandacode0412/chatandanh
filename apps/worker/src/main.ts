import { Queue, Worker } from "bullmq";

const redisUrl = process.env.REDIS_URL ?? "redis://localhost:6379";
const connection = redisConnection(redisUrl);

const cleanupQueue = new Queue("cleanup", { connection });
const moderationQueue = new Queue("moderation", { connection });

const cleanupWorker = new Worker(
  "cleanup",
  async (job) => {
    console.log(`[worker] cleanup job ${job.name} da chay`, job.data);
  },
  { connection }
);

const moderationWorker = new Worker(
  "moderation",
  async (job) => {
    console.log(`[worker] moderation job ${job.name} da chay`, job.data);
  },
  { connection }
);

async function bootstrap() {
  await cleanupQueue.upsertJobScheduler("sessions.expire", { every: 10 * 60 * 1000 }, { name: "sessions.expire" });
  await cleanupQueue.upsertJobScheduler("presence.sweep", { every: 60 * 1000 }, { name: "presence.sweep" });
  await cleanupQueue.upsertJobScheduler("messages.retention", { every: 24 * 60 * 60 * 1000 }, { name: "messages.retention" });
  await moderationQueue.upsertJobScheduler("moderation.autoFlag", { every: 60 * 1000 }, { name: "moderation.autoFlag" });

  console.log("[worker] Chat An Danh worker dang lang nghe BullMQ jobs");
}

process.on("SIGTERM", () => void shutdown());
process.on("SIGINT", () => void shutdown());

async function shutdown() {
  await Promise.all([
    cleanupWorker.close(),
    moderationWorker.close(),
    cleanupQueue.close(),
    moderationQueue.close()
  ]);
  process.exit(0);
}

bootstrap().catch((error) => {
  console.error(error);
  process.exit(1);
});

function redisConnection(url: string) {
  const parsed = new URL(url);
  return {
    host: parsed.hostname,
    port: Number(parsed.port || 6379),
    password: parsed.password || undefined,
    maxRetriesPerRequest: null
  };
}
