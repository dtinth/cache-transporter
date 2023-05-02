import { readFileSync } from "fs";
import { resolve, relative } from "path";
import { getPaths } from "./getPaths";
import { Metadata, metadataSchema } from "./Metadata";

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
}
