import { fsEnv } from "./env";

export function getPaths(cacheId: string) {
  const archiveFile = `${fsEnv.CACHE_TRANSPORTER_TEMP}/${cacheId}.tgz`;
  const metadataFile = `${fsEnv.CACHE_TRANSPORTER_TEMP}/${cacheId}.json`;
  return { archiveFile, metadataFile };
}
