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
  .command(
    "push",
    "push",
    {
      "cache-id": {
        type: "string",
        demand: true,
      },
      path: {
        type: "string",
        array: true,
        demand: true,
      },
    },
    async (args) => {
      console.log(args);
      if (!env.valid) {
        console.error("Skipping push, environment is invalid.");
        console.error(env.error);
        process.exit(0);
      }
      console.log("push");
    }
  )
  .command("pull", "pull", {}, async () => {
    if (!env.valid) {
      console.error("Skipping pull, environment is invalid.");
      console.error(env.error);
      process.exit(0);
    }
    console.log("pull");
  })
  .command("prune", "prune", {}, async () => {
    const token = env.CACHE_TRANSPORTER_TOKEN;
    console.log("prune");
  })
  .command("server", "server", {}, async () => {
    const token = env.CACHE_TRANSPORTER_TOKEN;
    console.log("server");
  })
  .parse();
