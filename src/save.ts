import tar, { FileStat } from "tar";
import { existsSync, unlinkSync, writeFileSync } from "fs";
import { fromFileSync } from "hasha";
import { resolve, relative } from "path";
import { getPaths } from "./getPaths";
import { getCommonAncestor } from "./getCommonAncestor";
import { Metadata } from "./Metadata";
import { timer } from "./timer";

export async function save(cacheId: string, paths: string[]) {
  const resolvedPaths = paths.map((path) => resolve(path));
  const commonAncestor = getCommonAncestor(resolvedPaths);
  const relativePaths = resolvedPaths.map(
    (path) => "./" + relative(commonAncestor, path)
  );
  const { archiveFile: outArchiveFile, metadataFile: outMetadataFile } =
    getPaths(cacheId);

  const cwd = commonAncestor;
  const inPaths = relativePaths;
  const scanReporter = progressReporter("Scanning files", "Scaned files");
  let totalBytes = 0;
  const counter = (path: string, stat: FileStat) => {
    scanReporter.tick();
    return true;
  };
  for await (const b of tar.c({ gzip: false, cwd, filter: counter }, inPaths)) {
    totalBytes += b.length;
  }
  scanReporter.finalize();
  console.log("Total bytes:", totalBytes);

  console.log("Creating archive:", outArchiveFile);
  if (existsSync(outArchiveFile)) unlinkSync(outArchiveFile);
  const archiveReporter = progressReporter("Archiving files", "Archived files");
  const filter = (path: string) => {
    archiveReporter.tick();
    return true;
  };
  await tar.c({ gzip: true, file: outArchiveFile, cwd, filter }, inPaths);
  archiveReporter.finalize();
  const hash = fromFileSync(outArchiveFile, { algorithm: "sha256" });
  const metadata: Metadata = {
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

const progressReporter = (
  inProgressMessage: string,
  finishedMessage: string
) => {
  let count = 0;
  let last = Date.now();
  const t = timer();
  return {
    tick: () => {
      count += 1;
      if (Date.now() - last > 1000) {
        last = Date.now();
        console.log(`${inProgressMessage}... Number of files so far: ${count}`);
      }
    },
    finalize() {
      console.log(`${finishedMessage} in ${t()}. Number of files: ${count}`);
    },
  };
};
