import tar, { FileStat } from "tar";
import { existsSync, unlinkSync, writeFileSync } from "fs";
import { fromFileSync } from "hasha";
import { resolve, relative } from "path";
import { getPaths } from "./getPaths";
import { getCommonAncestor } from "./getCommonAncestor";
import { Metadata } from "./Metadata";
import { createProgressReporter } from "./createProgressReporter";

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
  const scanReporter = createProgressReporter("Scanning files", "Scaned files");
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
  const archiveReporter = createProgressReporter(
    "Archiving files",
    "Archived files"
  );
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
