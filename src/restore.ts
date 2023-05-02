import { mkdirSync, readFileSync } from "fs";
import { resolve, relative } from "path";
import { getPaths } from "./getPaths";
import tar from "tar";
import { Metadata, metadataSchema } from "./Metadata";
import { createProgressReporter } from "./createProgressReporter";

export async function restore(cacheId: string) {
  const { archiveFile, metadataFile } = getPaths(cacheId);
  const metadata: Metadata = metadataSchema.parse(
    JSON.parse(readFileSync(metadataFile, "utf8"))
  );

  // Find the relative path to unarchive.
  const relativePath = relative(metadata.cwd, metadata.base);
  const pathToUnarchive = resolve(relativePath);

  console.log("Unarchiving:", archiveFile);
  console.log("Target:", relativePath, "->", pathToUnarchive);
  const reporter = createProgressReporter("Unarchiving", "Unarchived");
  mkdirSync(pathToUnarchive, { recursive: true });
  await tar.x({
    file: archiveFile,
    cwd: pathToUnarchive,
    onentry() {
      reporter.tick();
    },
    onwarn(code, message) {
      console.warn(code, message);
    },
  });
  reporter.finalize();
}
