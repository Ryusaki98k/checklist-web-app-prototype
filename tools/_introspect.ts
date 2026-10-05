/** Which exported tables can actually be introspected? */
import { getTableConfig, unwrapTable } from "drizzle-orm/pg-core";
import * as schema from "../src/db/schema";

for (const [name, t] of Object.entries(schema)) {
  if (!t || typeof t !== "object") continue;
  let direct = "";
  try { direct = "ok:" + getTableConfig(t as any).name; }
  catch (e: any) { direct = "THROWS"; }
  let viaUnwrap = "";
  try { viaUnwrap = "ok:" + getTableConfig(unwrapTable(t as any)).name; }
  catch { viaUnwrap = "THROWS"; }
  console.log(`${name.padEnd(24)} direct=${direct.padEnd(18)} unwrap=${viaUnwrap}`);
}