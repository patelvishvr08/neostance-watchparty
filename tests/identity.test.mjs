import test from "node:test";
import assert from "node:assert/strict";
import { safeRelativeReturnPath } from "../core/identity.mjs";

test("account redirects preserve an invite and reject other origins or auth loops", () => {
  assert.equal(safeRelativeReturnPath("/?room=ABC123#join"), "/?room=ABC123#join");
  assert.equal(safeRelativeReturnPath("/still/index.html"), "/still/index.html");
  for (const destination of ["https://example.com", "//example.com", "/\\example.com", "/signin-with-chatgpt", "/callback/", "/a/../signout-with-chatgpt", null]) {
    assert.equal(safeRelativeReturnPath(destination), "/");
  }
});
