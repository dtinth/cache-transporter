import {
  createReadStream,
  createWriteStream,
  existsSync,
  readFileSync,
  writeFileSync,
} from "fs";
import hasha from "hasha";
import { networkClientEnv } from "./env";
import { Readable } from "stream";
import { getPaths } from "./getPaths";
import { pipeline } from "stream/promises";

export async function download(cacheId: string) {
  const { archiveFile, metadataFile } = getPaths(cacheId);
  const metadataUrl = `${networkClientEnv.CACHE_TRANSPORTER_URI}/ac/${hasha(
    cacheId,
    { algorithm: "sha256" }
  )}`;
  const response = await fetch(metadataUrl);
  if (!response.ok) {
    throw new Error("Download metadata failed: " + response.status);
  }
  const metadata = await response.json();
  console.log("Downloaded metadata. Status:", response.status);
  writeFileSync(metadataFile, JSON.stringify(metadata, null, 2));
  const archiveUrl = `${networkClientEnv.CACHE_TRANSPORTER_URI}/cas/${metadata.hash}`;
  const response2 = await fetch(archiveUrl);
  if (!response2.ok) {
    throw new Error("Download archive failed: " + response2.status);
  }
  await pipeline(
    Readable.fromWeb(response2.body as any),
    createWriteStream(archiveFile)
  );
  console.log("Downloaded archive. Status:", response2.status);
  const hash = hasha.fromFileSync(archiveFile, { algorithm: "sha256" });
  if (hash !== metadata.hash) {
    throw new Error(
      "Hash mismatch. Downloaded archive is corrupted. Actual hash: " +
        hash +
        ", expected hash: " +
        metadata.hash
    );
  }
  console.log("Archive verified.");
}
