#!/usr/bin/env node

import yargs from "yargs";
import { Env } from "@(-.-)/env";
import { z } from "zod";
import tar from "tar";
import { existsSync, statSync, unlinkSync } from "fs";
import { fromFileSync } from "hasha";
import { globbyStream } from "globby";
import { resolve, relative, sep } from "path";

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
      console.log("save");

      const cacheId = "nm";

      await archiveCache(cacheId, ["node_modules"]);
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

async function archiveCache(cacheId: string, paths: string[]) {
  const resolvedPaths = paths.map((path) => resolve(path));
  const commonAncestor = getCommonAncestor(resolvedPaths);
  const relativePaths = resolvedPaths.map(
    (path) => "./" + relative(commonAncestor, path)
  );
  const outArchiveFile = `${fsEnv.CACHE_TRANSPORTER_TEMP}/${cacheId}.tgz`;

  const cwd = commonAncestor;
  const inPaths = relativePaths;

  let numberOfFiles = 0;
  let totalBytes = 0;
  for await (const entry of globbyStream("**/*", { cwd, dot: true })) {
    const realPath = resolve(cwd, entry as string);
    const stat = statSync(realPath);
    numberOfFiles += 1;
    totalBytes += stat.size;
  }
  console.log("Number of files found:", numberOfFiles);
  console.log("Total bytes:", totalBytes);
  console.log("Creating archive:", outArchiveFile);
  if (existsSync(outArchiveFile)) unlinkSync(outArchiveFile);
  const progressReporter = (() => {
    let count = 0;
    let last = Date.now();
    return {
      tick: () => {
        count += 1;
        if (Date.now() - last > 1000) {
          last = Date.now();
          console.log("Archiving... Number of files so far:", count);
        }
      },
      finalize() {
        console.log("Finished archiving. Number of files:", count);
      },
    };
  })();
  const filter = (path: string) => {
    // const realPath = resolve(cwd, path);
    progressReporter.tick();
    return true;
  };
  await tar.c({ gzip: true, file: outArchiveFile, cwd, filter }, inPaths);
  progressReporter.finalize();
  const hash = fromFileSync(outArchiveFile, { algorithm: "sha256" });
  console.log(hash);
}

function getCommonAncestor(absolutePaths: string[]) {
  const pairwise = (a: string, b: string) => {
    return relative(a, b)
      .split(sep)
      .reduce((x, y) => (y === ".." ? resolve(x, y) : x), a);
  };
  return absolutePaths.reduce(pairwise);
}
