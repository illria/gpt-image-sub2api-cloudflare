interface Env {
  SUB2API_BASE_URL?: string;
  SUB2API_API_KEY?: string;
  SUB2API_MODEL?: string;
  ALLOW_CLIENT_CONFIG?: string;
}

function enabled(value?: string) {
  return ["1", "true", "yes", "on"].includes(String(value || "").toLowerCase());
}

export const onRequestGet: PagesFunction<Env> = async ({ env }) => {
  const serverConfigured = Boolean(env.SUB2API_BASE_URL && env.SUB2API_API_KEY);

  return Response.json({
    ok: true,
    model: env.SUB2API_MODEL || "gpt-image-2",
    serverConfigured,
    allowClientConfig: enabled(env.ALLOW_CLIENT_CONFIG) || !serverConfigured
  });
};
