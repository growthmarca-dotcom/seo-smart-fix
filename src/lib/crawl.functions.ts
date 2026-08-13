import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { analyzeSingleUrl, crawlSite } from "./crawl.server";

const crawlInput = z.object({
  rootUrl: z.string().min(3),
  limit: z.number().int().min(1).max(1000),
  respectRobots: z.boolean(),
});

export const crawlSiteFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => crawlInput.parse(data))
  .handler(async ({ data }) => {
    try {
      return { ok: true as const, result: await crawlSite(data) };
    } catch (e) {
      return { ok: false as const, error: e instanceof Error ? e.message : "No se pudo rastrear el sitio." };
    }
  });

export const analyzeUrlFn = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ url: z.string().min(3) }).parse(data))
  .handler(async ({ data }) => {
    try {
      const page = await analyzeSingleUrl(data.url);
      return { ok: true as const, page };
    } catch (e) {
      return { ok: false as const, error: e instanceof Error ? e.message : "No se pudo analizar la URL." };
    }
  });
