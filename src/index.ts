#!/usr/bin/env node

import yargs from "yargs";
import { networkClientEnv } from "./env";
import { startServer } from "./startServer";
import { upload } from "./upload";
import { save } from "./save";

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
      if (!networkClientEnv.valid) {
        console.error("Skipping push, environment is invalid.");
        console.error(networkClientEnv.error);
        process.exit(0);
      }
      console.log("push");
    }
  )
  .command(
    "save",
    "Save the cache data to a file",
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
      const archive = await save(args["cache-id"], args["path"]);
      console.log(archive);
    }
  )
  .command(
    "upload",
    "Upload the cache data to the server",
    {
      "cache-id": {
        type: "string",
        demand: true,
      },
    },
    async (args) => {
      await upload(args["cache-id"]);
    }
  )
  .command("pull", "pull", {}, async () => {
    if (!networkClientEnv.valid) {
      console.error("Skipping pull, environment is invalid.");
      console.error(networkClientEnv.error);
      process.exit(0);
    }
    console.log("pull");
  })
  .command("prune", "prune", {}, async () => {
    // const token = networkClientEnv.CACHE_TRANSPORTER_TOKEN;
    // console.log("prune");
  })
  .command("server", "server", {}, async () => {
    // const token = networkClientEnv.CACHE_TRANSPORTER_TOKEN;
    // console.log("server");
    await startServer();
  })
  .parse();
