import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import express from "express";
import { expressMiddleware } from "@apollo/server/express4";
import { initApolloServer } from "./utils/apollo/init-apollo-server.ts";
import { getDataSources } from "./data-sources/index.ts";
import { imageAdapter, lastImageError } from "../../flow-core/src/adapters/image.ts";

const EXT: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/avif": "avif",
  "image/tiff": "tiff",
  "image/svg+xml": "svg",
};

const convertImage = (req: express.Request, res: express.Response) => {
  const body: unknown = req.body;
  if (!Buffer.isBuffer(body) || body.length === 0) {
    res.status(400).type("text/plain").send("пустое тело: ожидались байты изображения");
    return;
  }
  const quality = Math.min(100, Math.max(1, Number(req.query.quality) || 80));
  const ext = EXT[String(req.headers["content-type"])] ?? "png";
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "flow-image-"));
  const input = path.join(dir, `in.${ext}`);
  const output = path.join(dir, "out.webp");
  try {
    fs.writeFileSync(input, body);
    if (!imageAdapter.convert(input, output, quality)) {
      res.status(422).type("text/plain").send(lastImageError || "sharp-cli не смог конвертировать файл");
      return;
    }
    res.type("image/webp").send(fs.readFileSync(output));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
};

export const createAppServer = async () => {
  const app = express();
  const apollo = await initApolloServer();

  app.post("/api/convert", express.raw({ type: () => true, limit: "50mb" }), convertImage);

  app.use(
    "/graphql",
    express.json({ limit: "1mb" }),
    expressMiddleware(apollo, {
      context: async () => ({ dataSources: { flowApi: getDataSources() } }),
    })
  );

  return app;
};
