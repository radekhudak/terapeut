import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { env } from "@/lib/env";
import * as schema from "./schema";

const sql = neon(env.databaseUrl);

export const db = drizzle(sql, { schema });

export { schema };
