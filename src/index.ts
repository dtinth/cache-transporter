#!/usr/bin/env node

import yargs from "yargs";
import tar from "tar";
import {
  createReadStream,
  createWriteStream,
  existsSync,
  mkdirSync,
  readFileSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from "fs";
import hasha, { fromFileSync } from "hasha";
import { globbyStream } from "globby";
import { resolve, relative, sep, dirname } from "path";
import { networkClientEnv, fsEnv, networkServerEnv } from "./env";
import { Readable } from "stream";
import { pipeline } from "stream/promises";
import { FastifyReply, FastifyRequest } from "fastify";

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

async function startServer() {
  const { default: fastify } = await import("fastify");
  const server = fastify({ logger: true });
  server.addContentTypeParser(
    "application/octet-stream",
    function (request, payload, done) {
      done(null);
    }
  );

  const handleUpload = async (
    request: FastifyRequest,
    reply: FastifyReply,
    prefix: string,
    hash: string,
    checkHash: boolean
  ) => {
    if (!hash.match(/^[a-f0-9]{64}$/)) {
      reply.code(400);
      return "Invalid hash";
    }
    const path = `${networkServerEnv.CACHE_TRANSPORTER_STORAGE}/${prefix}/${hash}`;
    mkdirSync(dirname(path), { recursive: true });
    await pipeline(request.raw, createWriteStream(path));
    if (checkHash) {
      const computedHash = fromFileSync(path, { algorithm: "sha256" });
      if (computedHash !== hash) {
        reply.code(422);
        return "Hash mismatch";
      }
    }
    return "OK";
  };
  server.put("/cas/:hash", async (request, reply) => {
    const { hash } = request.params as any;
    return handleUpload(request, reply, "cas", hash, true);
  });
  server.put("/ac/:hash", async (request, reply) => {
    const { hash } = request.params as any;
    return handleUpload(request, reply, "ac", hash, false);
  });

  const result = await server.listen({
    port: networkServerEnv.CACHE_TRANSPORTER_PORT,
    host: networkServerEnv.CACHE_TRANSPORTER_HOST,
  });
  console.log(result);
}

function getPaths(cacheId: string) {
  const archiveFile = `${fsEnv.CACHE_TRANSPORTER_TEMP}/${cacheId}.tgz`;
  const metadataFile = `${fsEnv.CACHE_TRANSPORTER_TEMP}/${cacheId}.json`;
  return { archiveFile, metadataFile };
}

function getCommonAncestor(absolutePaths: string[]) {
  const pairwise = (a: string, b: string) => {
    return relative(a, b)
      .split(sep)
      .reduce((x, y) => (y === ".." ? resolve(x, y) : x), a);
  };
  return absolutePaths.reduce(pairwise);
}
