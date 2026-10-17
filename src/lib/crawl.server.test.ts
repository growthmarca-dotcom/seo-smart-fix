import { afterEach, describe, expect, it, vi } from "vitest";
import { crawlSite, parseRobotsTxt, resolveRobotsPolicy, robotsBlockedBy } from "./crawl.server";
import { RULES } from "@/seo/rules";
import { parseHtml } from "@/seo/html";

const page = (links: string[], extraHead = "") =>
  `<html><head><title>T</title>${extraHead}</head><body><h1>H</h1>${links
    .map((l) => `<a href="${l}">${l}</a>`)
    .join("")}</body></html>`;

function mockSite(routes: Record<string, { status: number; body: string; type?: string; headers?: Record<string, string> } | "throw">) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      const path = new URL(url).pathname;
      const r = routes[path];
      if (r === "throw") throw new Error("network down");
      const def = r ?? { status: 404, body: "" };
      return new Response(def.body, {
        status: def.status,
        headers: { "content-type": def.type ?? (path.endsWith(".txt") ? "text/plain" : "text/html"), ...def.headers },
      });
    }),
  );
}
afterEach(() => vi.unstubAllGlobals());

const site = {
  "/": { status: 200, body: page(["/a", "/privado/x"]) },
  "/a": { status: 200, body: page(["/"]) },
  "/privado/x": { status: 200, body: page(["/"]) },
};

describe("robots.txt", () => {
  it("1. permite todas las rutas", () => {
    const r = parseRobotsTxt("User-agent: *\nDisallow:");
    expect(r.state).toBe("valid");
    expect(robotsBlockedBy(r, "https://x.com/cualquier")).toBeNull();
    expect(resolveRobotsPolicy(r, true)).toBe("apply");
  });

  it("2. bloquea una ruta específica", () => {
    const r = parseRobotsTxt("User-agent: *\nDisallow: /privado/");
    expect(robotsBlockedBy(r, "https://x.com/privado/x")).toBe("/privado/");
    expect(robotsBlockedBy(r, "https://x.com/a")).toBeNull();
  });

  it("3. bloqueo total para nuestro agente, pero no si un Allow reabre rutas", () => {
    expect(parseRobotsTxt("User-agent: SEOFixerBot\nDisallow: /\n\nUser-agent: *\nDisallow:").state).toBe("disallow-all");
    expect(parseRobotsTxt("User-agent: *\nDisallow: /\nAllow: /blog").state).toBe("valid");
  });

  it("3b. crawl con bloqueo total se detiene e informa", async () => {
    mockSite({ ...site, "/robots.txt": { status: 200, body: "User-agent: *\nDisallow: /" } });
    const res = await crawlSite({ rootUrl: "https://x.com", limit: 10, respectRobots: true });
    expect(res.pages).toHaveLength(0);
    expect(res.robotsDisallowAll).toBe(true);
  });

  it("4. robots.txt inaccesible → modo seguro: solo la home", async () => {
    mockSite({ ...site, "/robots.txt": { status: 503, body: "" } });
    const res = await crawlSite({ rootUrl: "https://x.com", limit: 10, respectRobots: true });
    expect(res.coverage.robots?.policy).toBe("restricted-unverified");
    expect(res.pages.map((p) => new URL(p.url).pathname)).toEqual(["/"]);
    expect(res.coverage.excluded.some((e) => e.reason === "robots-unverified")).toBe(true);
  });

  it("4b. robots.txt ausente (404) → sin reglas, explícito", async () => {
    mockSite(site);
    const res = await crawlSite({ rootUrl: "https://x.com", limit: 10, respectRobots: true });
    expect(res.coverage.robots?.policy).toBe("no-rules");
    expect(res.pages).toHaveLength(3);
  });

  it("4c. desactivado → política 'ignored'", () => {
    expect(resolveRobotsPolicy(parseRobotsTxt("User-agent: *\nDisallow: /"), false)).toBe("ignored");
  });
});

describe("noindex vs bloqueo", () => {
  const noindexRule = RULES.find((r) => r.id === "noindex")!;

  it("5. noindex detectado en página accesible (meta y X-Robots-Tag)", async () => {
    mockSite({
      "/": { status: 200, body: page(["/b"], '<meta name="robots" content="noindex">') },
      "/b": { status: 200, body: page([]), headers: { "x-robots-tag": "noindex" } },
    });
    const res = await crawlSite({ rootUrl: "https://x.com", limit: 10, respectRobots: true });
    const flagged = res.pages.filter((p) => noindexRule.check(p, {} as never));
    expect(flagged).toHaveLength(2);
  });

  it("6. página bloqueada: no se marca noindex, queda como no verificada", async () => {
    mockSite({ ...site, "/robots.txt": { status: 200, body: "User-agent: *\nDisallow: /privado/" } });
    const res = await crawlSite({ rootUrl: "https://x.com", limit: 10, respectRobots: true });
    expect(res.pages.some((p) => p.url.includes("/privado/"))).toBe(false);
    const ex = res.coverage.excluded.find((e) => e.url.includes("/privado/x"));
    expect(ex?.reason).toBe("robots-disallow");
  });

  it("7. auditoría parcial continúa con las rutas permitidas", async () => {
    mockSite({ ...site, "/robots.txt": { status: 200, body: "User-agent: *\nDisallow: /privado/" } });
    const res = await crawlSite({ rootUrl: "https://x.com", limit: 10, respectRobots: true });
    expect(res.pages.map((p) => new URL(p.url).pathname).sort()).toEqual(["/", "/a"]);
    expect(res.coverage.blocked).toBe(1);
  });

  it("parseHtml sin noindex no dispara la regla", () => {
    const p = parseHtml({ url: "https://x.com/", html: page([]), statusCode: 200, depth: 0, responseMs: 1 });
    expect(noindexRule.check(p, {} as never)).toBeNull();
  });
});
