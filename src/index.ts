#!/usr/bin/env node

import yargs from "yargs";
import tar from "tar";
import {
  createReadStream,
  existsSync,
  readFileSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from "fs";
import hasha, { fromFileSync } from "hasha";
import { globbyStream } from "globby";
import { resolve, relative } from "path";
import { networkClientEnv } from "./env";
import { Readable } from "stream";
import { getPaths } from "./getPaths";
import { getCommonAncestor } from "./getCommonAncestor";
import { startServer } from "./startServer";

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

async function save(cacheId: string, paths: string[]) {
  const resolvedPaths = paths.map((path) => resolve(path));
  const commonAncestor = getCommonAncestor(resolvedPaths);
  const relativePaths = resolvedPaths.map(
    (path) => "./" + relative(commonAncestor, path)
  );
  const { archiveFile: outArchiveFile, metadataFile: outMetadataFile } =
    getPaths(cacheId);

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
  const metadata = {
    cacheId,
    cwd: resolve(),
    base: commonAncestor,
    hash: hash,
  };
  writeFileSync(outMetadataFile, JSON.stringify(metadata, null, 2));
  console.log("Wrote metadata:", outMetadataFile);
  return {
    archiveFile: {
      path: outArchiveFile,
    },
    metadataFile: {
      path: outMetadataFile,
    },
  };
}

async function upload(cacheId: string) {
  const { archiveFile, metadataFile } = getPaths(cacheId);
  if (!existsSync(archiveFile)) {
    throw new Error("Archive file does not exist: " + archiveFile);
  }
  if (!existsSync(metadataFile)) {
    throw new Error("Metadata file does not exist: " + metadataFile);
  }
  const metadata = JSON.parse(readFileSync(metadataFile, "utf8"));
  const archiveUrl = `${networkClientEnv.CACHE_TRANSPORTER_URI}/cas/${metadata.hash}`;
  const response = await fetch(archiveUrl, {
    method: "PUT",
    headers: {
      "Content-Type": "application/octet-stream",
    },
    body: Readable.toWeb(createReadStream(archiveFile)) as any,
    // @ts-expect-error - https://github.com/nodejs/node/issues/46221
    duplex: "half",
  });
  if (!response.ok) {
    throw new Error("Upload archive failed: " + response.status);
  }
  console.log("Uploaded archive. Status:", response.status);

  const metadataUrl = `${networkClientEnv.CACHE_TRANSPORTER_URI}/ac/${hasha(
    cacheId,
    { algorithm: "sha256" }
  )}`;
  const response2 = await fetch(metadataUrl, {
    method: "PUT",
    headers: {
      "Content-Type": "application/octet-stream",
    },
    body: readFileSync(metadataFile),
  });
  if (!response2.ok) {
    throw new Error("Upload metadata failed: " + response2.status);
  }
  console.log("Uploaded metadata. Status:", response2.status);
}
