import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { proxy } from "@/proxy";

function makeRequest(path: string, hasCookie = false) {
  const url = `http://localhost:3400${path}`;
  const headers = new Headers();
  if (hasCookie) {
    headers.set("cookie", "better-auth.session_token=test-token");
  }
  return new NextRequest(url, { headers });
}

describe("proxy (auth middleware)", () => {
  it("allows /sign-in without a session", () => {
    const res = proxy(makeRequest("/sign-in"));
    expect(res.status).not.toBe(307);
  });

  it("allows /api/auth routes without a session", () => {
    const res = proxy(makeRequest("/api/auth/sign-in/email"));
    expect(res.status).not.toBe(307);
  });

  it("redirects to /sign-in when no session cookie", () => {
    const res = proxy(makeRequest("/"));
    expect(res.status).toBe(307);
    expect(new URL(res.headers.get("location")!).pathname).toBe("/sign-in");
  });

  it("allows authenticated requests through", () => {
    const res = proxy(makeRequest("/", true));
    expect(res.status).not.toBe(307);
  });

  it("redirects /dashboard without session", () => {
    const res = proxy(makeRequest("/dashboard"));
    expect(res.status).toBe(307);
  });

  it("allows /dashboard with session", () => {
    const res = proxy(makeRequest("/dashboard", true));
    expect(res.status).not.toBe(307);
  });
});
