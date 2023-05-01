import { createReadStream, createWriteStream, existsSync, mkdirSync } from "fs";
import { fromFileSync } from "hasha";
import { dirname } from "path";
import { networkServerEnv } from "./env";
import { pipeline } from "stream/promises";
import { FastifyReply, FastifyRequest } from "fastify";

export async function startServer() {
  const { default: fastify } = await import("fastify");
  const server = fastify({ logger: true });
  server.addContentTypeParser(
    "application/octet-stream",
    function (request, payload, done) {
      done(null);
    }
  );

  const handleUpload = async (
    request: FastifyRequest,
    reply: FastifyReply,
    prefix: string,
    hash: string,
    checkHash: boolean
  ) => {
    if (!hash.match(/^[a-f0-9]{64}$/)) {
      reply.code(400);
      return "Invalid format";
    }
    const path = `${networkServerEnv.CACHE_TRANSPORTER_STORAGE}/${prefix}/${hash}`;
    mkdirSync(dirname(path), { recursive: true });
    await pipeline(request.raw, createWriteStream(path));
    if (checkHash) {
      const computedHash = fromFileSync(path, { algorithm: "sha256" });
      if (computedHash !== hash) {
        reply.code(422);
        return "Hash mismatch";
      }
    }
    return "OK";
  };

  const handleDownload = async (
    request: FastifyRequest,
    reply: FastifyReply,
    prefix: string,
    hash: string
  ) => {
    if (!hash.match(/^[a-f0-9]{64}$/)) {
      reply.code(400);
      return "Invalid format";
    }
    const path = `${networkServerEnv.CACHE_TRANSPORTER_STORAGE}/${prefix}/${hash}`;
    if (!existsSync(path)) {
      reply.code(404);
      return "Not found";
    }
    reply.header("Content-Type", "application/octet-stream");
    return reply.send(createReadStream(path));
  };

  server.put("/cas/:hash", async (request, reply) => {
    const { hash } = request.params as any;
    return handleUpload(request, reply, "cas", hash, true);
  });
  server.put("/ac/:hash", async (request, reply) => {
    const { hash } = request.params as any;
    return handleUpload(request, reply, "ac", hash, false);
  });
  server.get("/cas/:hash", async (request, reply) => {
    const { hash } = request.params as any;
    return handleDownload(request, reply, "cas", hash);
  });
  server.get("/ac/:hash", async (request, reply) => {
    const { hash } = request.params as any;
    return handleDownload(request, reply, "ac", hash);
  });

  const result = await server.listen({
    port: networkServerEnv.CACHE_TRANSPORTER_PORT,
    host: networkServerEnv.CACHE_TRANSPORTER_HOST,
  });
  console.log(result);
}
