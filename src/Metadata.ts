import { z } from "zod";

export const metadataSchema = z.object({
  cacheId: z.string(),
  cwd: z.string(),
  base: z.string(),
  hash: z.string(),
});

export type Metadata = z.infer<typeof metadataSchema>;
