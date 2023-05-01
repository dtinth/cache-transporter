import { createReadStream, existsSync, readFileSync } from "fs";
import hasha from "hasha";
import { networkClientEnv } from "./env";
import { Readable } from "stream";
import { getPaths } from "./getPaths";

export async function upload(cacheId: string) {
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
