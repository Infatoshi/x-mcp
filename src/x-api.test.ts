import assert from "node:assert/strict";
import test from "node:test";
import { XApiClient } from "./x-api.js";

// Regression test: tool-supplied ids and usernames are interpolated into
// request URLs. They must be encoded as a single path segment, otherwise
// a value like "123/followers" or "name?x=1" changes the endpoint that
// gets called with the user's credentials.

const seen: string[] = [];

function stubFetch() {
  globalThis.fetch = (async (url: unknown) => {
    seen.push(String(url));
    return new Response(
      JSON.stringify({ data: { id: "1" }, media_id_string: "42" }),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  }) as typeof fetch;
}

function makeClient() {
  return new XApiClient({
    apiKey: "test",
    apiSecret: "test",
    accessToken: "test",
    accessTokenSecret: "test",
    bearerToken: "test",
  });
}

test("getUser encodes a crafted username as one path segment", async () => {
  stubFetch();
  seen.length = 0;
  await makeClient().getUser({ username: "victim?user.fields=private" });
  assert.equal(seen.length, 1);
  const url = new URL(seen[0]);
  assert.equal(url.pathname, "/2/users/by/username/victim%3Fuser.fields%3Dprivate");
  assert.equal(url.searchParams.get("user.fields")!.includes("private"), false);
});

test("getUser encodes a crafted user id as one path segment", async () => {
  stubFetch();
  seen.length = 0;
  await makeClient().getUser({ userId: "123/followers" });
  const url = new URL(seen[0]);
  assert.equal(url.pathname, "/2/users/123%2Ffollowers");
});

test("getTimeline encodes a traversal user id as one path segment", async () => {
  stubFetch();
  seen.length = 0;
  await makeClient().getTimeline("../../tweets/search/recent?query=x");
  const url = new URL(seen[0]);
  assert.equal(
    url.pathname,
    "/2/users/..%2F..%2Ftweets%2Fsearch%2Frecent%3Fquery%3Dx/tweets",
  );
  assert.equal(url.searchParams.has("query"), false);
});

test("normal ids and usernames are unchanged", async () => {
  stubFetch();
  seen.length = 0;
  const client = makeClient();
  await client.getUser({ username: "elonmusk" });
  await client.getUser({ userId: "44196397" });
  assert.equal(new URL(seen[0]).pathname, "/2/users/by/username/elonmusk");
  assert.equal(new URL(seen[1]).pathname, "/2/users/44196397");
});
