import { Env } from "@(-.-)/env";
import { z } from "zod";

export const networkClientEnv = Env(
  z.object({
    // CACHE_TRANSPORTER_TOKEN: z.string(),
    CACHE_TRANSPORTER_URI: z.string(),
  })
);

export const networkServerEnv = Env(
  z.object({
    CACHE_TRANSPORTER_PORT: z.coerce.number().default(33813),
    CACHE_TRANSPORTER_HOST: z.string().default("0.0.0.0"),
    CACHE_TRANSPORTER_STORAGE: z.string().default(".cache/cache-transporter"),
  })
);

export const fsEnv = Env(
  z.object({
    CACHE_TRANSPORTER_TEMP: z.string().default("/tmp"),
  })
);
