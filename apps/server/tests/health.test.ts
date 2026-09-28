import test from "node:test";
import assert from "node:assert/strict";
import { buildApp } from "../src/index.js";

test("HTTP: GET /health returns 200 with service status", async () => {
  const server = await buildApp({ logLevel: "silent", nodeEnv: "test" });

  try {
    const response = await server.app.inject({
      method: "GET",
      url: "/health",
    });

    assert.equal(response.statusCode, 200);
    assert.equal(
      response.headers["content-type"],
      "application/json; charset=utf-8"
    );

    const body = JSON.parse(response.payload);
    assert.deepEqual(body, {
      status: "ok",
      service: "omniplay-server",
    });
  } finally {
    await server.stop();
  }
});
