import assert from "node:assert/strict";
import { test } from "node:test";
import { readLimitedJson } from "../src/lib/http/read-json.ts";

test("recusa corpo acima do limite mesmo sem Content-Length", async () => {
  const request = new Request("http://localhost/test", { method: "POST", body: JSON.stringify({ text: "x".repeat(100) }) });
  await assert.rejects(readLimitedJson(request, 20), { message: "too_large" });
});
