#!/usr/bin/env node

import yargs from "yargs";
import { Env } from "@(-.-)/env";
import { z } from "zod";

const env = Env(
  z.object({
    CACHE_TRANSPORTER_TOKEN: z.string(),
    CACHE_TRANSPORTER_URI: z.string().optional(),
  })
);

yargs(process.argv.slice(2))
  .demandCommand()
  .strict()
  .help()
  .command("push", "push", {}, async () => {
    if (!env.valid) {
      console.error("Skipping push, environment is invalid.");
      console.error(env.error);
      process.exit(0);
    }
    console.log("push");
  })
  .command("pull", "pull", {}, async () => {
    if (!env.valid) {
      console.error("Skipping pull, environment is invalid.");
      console.error(env.error);
      process.exit(0);
    }
    console.log("pull");
  })
  .command("server", "server", {}, async () => {
    const token = env.CACHE_TRANSPORTER_TOKEN;
    console.log("server");
  })
  .parse();
