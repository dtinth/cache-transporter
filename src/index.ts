#!/usr/bin/env node

import yargs from "yargs";
import { Env } from "@(-.-)/env";
import { z } from "zod";
import tar from "tar";
import { existsSync, unlinkSync } from "fs";
import { fromFileSync } from "hasha";

const networkEnv = Env(
  z.object({
    CACHE_TRANSPORTER_TOKEN: z.string(),
    CACHE_TRANSPORTER_URI: z.string().optional(),
  })
);
const fsEnv = Env(
  z.object({
    CACHE_TRANSPORTER_TEMP: z.string().default("/tmp"),
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
      if (!networkEnv.valid) {
        console.error("Skipping push, environment is invalid.");
        console.error(networkEnv.error);
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
      console.log("push");

      const outFile = "/tmp/nm.tgz";
      const cwd = "node_modules";
      const inPaths = ["."];
      if (existsSync(outFile)) unlinkSync(outFile);
      const progressReporter = (() => {
        let count = 0;
        let last = Date.now();
        const report = () => console.log("Added", count, "files.");
        return {
          tick: () => {
            count += 1;
            if (Date.now() - last > 1000) {
              report();
              last = Date.now();
            }
          },
          finalize() {
            report();
          },
        };
      })();
      const filter = (path: string) => {
        progressReporter.tick();
        return true;
      };
      await tar.c({ gzip: true, file: outFile, cwd, filter }, inPaths);
      progressReporter.finalize();
      const hash = fromFileSync(outFile, { algorithm: "sha256" });
      console.log(hash);
    }
  )
  .command("pull", "pull", {}, async () => {
    if (!networkEnv.valid) {
      console.error("Skipping pull, environment is invalid.");
      console.error(networkEnv.error);
      process.exit(0);
    }
    console.log("pull");
  })
  .command("prune", "prune", {}, async () => {
    const token = networkEnv.CACHE_TRANSPORTER_TOKEN;
    console.log("prune");
  })
  .command("server", "[UNIMPLENTED] server", {}, async () => {
    const token = networkEnv.CACHE_TRANSPORTER_TOKEN;
    console.log("server");
  })
  .parse();
