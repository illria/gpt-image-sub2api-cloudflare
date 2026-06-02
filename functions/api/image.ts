interface Env {
  SUB2API_BASE_URL?: string;
  SUB2API_API_KEY?: string;
  SUB2API_MODEL?: string;
  ALLOW_CLIENT_CONFIG?: string;
}

type UpstreamImageItem = {
  b64_json?: string;
  url?: string;
  revised_prompt?: string;
};

type UpstreamResponse = {
  data?: UpstreamImageItem[];
  error?: string | { message?: string; type?: string; code?: string };
};

const JSON_HEADERS = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store"
};

function json(data: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(data), {
    ...init,
    headers: {
      ...JSON_HEADERS,
      ...(init?.headers || {})
    }
  });
}

function normalizeBaseUrl(baseUrl: string) {
  const clean = baseUrl.trim().replace(/\/+$/, "");
  return clean.endsWith("/v1") ? clean : `${clean}/v1`;
}

function enabled(value?: string) {
  return ["1", "true", "yes", "on"].includes(String(value || "").toLowerCase());
}

function getField(form: FormData, name: string, fallback = "") {
  const value = form.get(name);
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function getNumberField(form: FormData, name: string, fallback: number, min: number, max: number) {
  const raw = Number(form.get(name));
  if (!Number.isFinite(raw)) return fallback;
  return Math.min(max, Math.max(min, Math.round(raw)));
}

function stripEmpty<T extends Record<string, unknown>>(input: T) {
  return Object.fromEntries(
    Object.entries(input).filter(([, value]) => value !== undefined && value !== null && value !== "")
  );
}

async function parseUpstreamResponse(response: Response) {
  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    return (await response.json()) as UpstreamResponse;
  }
  return { error: await response.text() } as UpstreamResponse;
}

function getErrorMessage(payload: UpstreamResponse) {
  if (typeof payload.error === "string") return payload.error;
  if (payload.error?.message) return payload.error.message;
  return "Image generation failed. Check your sub2api URL, key, model mapping, or upstream quota.";
}

function canUseClientConfig(env: Env) {
  const serverConfigured = Boolean(env.SUB2API_BASE_URL && env.SUB2API_API_KEY);
  return enabled(env.ALLOW_CLIENT_CONFIG) || !serverConfigured;
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  try {
    const form = await request.formData();

    const prompt = getField(form, "prompt");
    const mode = getField(form, "mode", "generate");
    const size = getField(form, "size", "1024x1024");
    const quality = getField(form, "quality", "auto");
    const outputFormat = getField(form, "output_format", "png");
    const background = getField(form, "background", "auto");
    const n = getNumberField(form, "n", 1, 1, 8);
    const outputCompression = getNumberField(form, "output_compression", 100, 0, 100);
    const model = getField(form, "model", env.SUB2API_MODEL || "gpt-image-2");

    if (!prompt) {
      return json({ error: "请输入提示词。" }, { status: 400 });
    }

    const allowClientConfig = canUseClientConfig(env);
    const clientBaseUrl = allowClientConfig ? getField(form, "baseUrl") : "";
    const clientApiKey = allowClientConfig ? getField(form, "apiKey") : "";

    const baseUrl = env.SUB2API_BASE_URL || clientBaseUrl;
    const apiKey = env.SUB2API_API_KEY || clientApiKey;

    if (!baseUrl) {
      return json({ error: "缺少 SUB2API_BASE_URL。请在 Cloudflare Pages 环境变量中配置，或启用 ALLOW_CLIENT_CONFIG。" }, { status: 400 });
    }

    if (!apiKey) {
      return json({ error: "缺少 SUB2API_API_KEY。请在 Cloudflare Pages 环境变量中配置，或启用 ALLOW_CLIENT_CONFIG。" }, { status: 400 });
    }

    const uploaded = form.get("image");
    const hasImage = uploaded instanceof File && uploaded.size > 0;
    const endpoint = hasImage && mode === "edit" ? "images/edits" : "images/generations";
    const url = `${normalizeBaseUrl(baseUrl)}/${endpoint}`;

    const common = stripEmpty({
      model,
      prompt,
      size,
      quality,
      n,
      output_format: outputFormat,
      background,
      output_compression:
        outputFormat === "jpeg" || outputFormat === "webp" ? outputCompression : undefined
    });

    let upstream: Response;

    if (endpoint === "images/edits" && uploaded instanceof File) {
      const upstreamForm = new FormData();
      Object.entries(common).forEach(([key, value]) => upstreamForm.set(key, String(value)));
      upstreamForm.set("image", uploaded, uploaded.name || "image.png");

      upstream = await fetch(url, {
        method: "POST",
        headers: {
          authorization: `Bearer ${apiKey}`
        },
        body: upstreamForm
      });
    } else {
      upstream = await fetch(url, {
        method: "POST",
        headers: {
          authorization: `Bearer ${apiKey}`,
          "content-type": "application/json"
        },
        body: JSON.stringify(common)
      });
    }

    const payload = await parseUpstreamResponse(upstream);

    if (!upstream.ok) {
      return json(
        {
          error: getErrorMessage(payload),
          status: upstream.status,
          detail: payload
        },
        { status: upstream.status }
      );
    }

    const images = (payload.data || [])
      .map((item) => {
        if (item.b64_json) return `data:image/${outputFormat};base64,${item.b64_json}`;
        if (item.url) return item.url;
        return null;
      })
      .filter(Boolean);

    return json({
      images,
      model,
      revisedPrompts: (payload.data || []).map((item) => item.revised_prompt).filter(Boolean),
      raw: payload
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown server error.";
    return json({ error: message }, { status: 500 });
  }
};
