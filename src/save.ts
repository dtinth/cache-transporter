import tar from "tar";
import { existsSync, statSync, unlinkSync, writeFileSync } from "fs";
import { fromFileSync } from "hasha";
import { globbyStream } from "globby";
import { resolve, relative } from "path";
import { getPaths } from "./getPaths";
import { getCommonAncestor } from "./getCommonAncestor";

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
