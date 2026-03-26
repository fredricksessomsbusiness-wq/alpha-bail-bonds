import type { Config } from "@netlify/functions";
import { processBatchQueue } from "../../lib/batch-processor";

export default async (req: Request) => {
  try {
    const { next_run } = await req.json().catch(() => ({ next_run: null }));
    console.log("Batch processor triggered. Next run:", next_run);

    const result = await processBatchQueue();
    console.log(`Batch processor done: ${result.processed} processed, ${result.errors} errors`);
  } catch (error) {
    console.error("Scheduled batch processor error:", error);
  }
};

export const config: Config = {
  schedule: "*/2 * * * *",
};
