import http from "node:http";
import { timingSafeEqual } from "node:crypto";
import { boot } from "./runtime.mjs";
const secret = process.env.BRIDGE_SECRET;
if (!secret || secret.length < 16)
  throw Error("BRIDGE_SECRET must have at least 16 characters");
const runtime = await boot({ persistent: true, port: 8545 });
// Serialize transactions so concurrent HTTP requests never race signer nonces.
let queue = Promise.resolve();
http
  .createServer(async (req, res) => {
    res.setHeader("Content-Type", "application/json");
    const supplied = Buffer.from(req.headers["x-bridge-secret"] || "");
    const expected = Buffer.from(secret);
    if (
      supplied.length !== expected.length ||
      !timingSafeEqual(supplied, expected)
    ) {
      res.writeHead(401);
      return res.end(JSON.stringify({ error: "Unauthorized" }));
    }
    try {
      let result;
      const path = new URL(req.url, "http://localhost").pathname;
      if (req.method === "GET" && path === "/config")
        result = { ...runtime.config, ...(await runtime.metrics()) };
      else if (req.method === "GET" && path === "/events")
        result = await runtime.events();
      else if (req.method === "GET" && path.startsWith("/payments/"))
        result = await runtime.snapshot(path.split("/")[2]);
      else if (req.method === "POST" && path === "/action") {
        let raw = "";
        for await (const chunk of req) {
          raw += chunk;
          if (raw.length > 8192) throw Error("Request too large");
        }
        const b = JSON.parse(raw);
        const job = queue.then(() =>
          runtime.action(b.kind, b.id, b.actor, b.payload),
        );
        queue = job.catch(() => {});
        result = await job;
      } else {
        res.writeHead(404);
        return res.end(JSON.stringify({ error: "Not found" }));
      }
      res.end(JSON.stringify(result));
    } catch (e) {
      res.writeHead(409);
      res.end(JSON.stringify({ error: e.shortMessage || e.message }));
    }
  })
  .listen(8546, "0.0.0.0", () =>
    console.log("Local chain 31337 and authenticated bridge ready"),
  );
