import worker, { createPass, readPass } from "./worker/index.js";
const env = { STRIPE_SECRET_KEY: "sk_test_abc", ASSETS: { fetch: async () => new Response("asset") } };
let fails = 0;
const check = (l, c) => { console.log((c ? "PASS" : "FAIL") + " - " + l); if (!c) fails++; };

const pass = await createPass(env, "a@b.com");
check("valid pass reads back", (await readPass(env, pass))?.email === "a@b.com");
check("tampered pass rejected", (await readPass(env, pass.slice(0, -2) + "xx")) === null);
const forged = Buffer.from(JSON.stringify({ email: "x@y.com", exp: Date.now() + 1e9 })).toString("base64url") + "." + pass.split(".")[1];
check("forged payload rejected", (await readPass(env, forged)) === null);
check("expired pass rejected", (await readPass(env, await createPass(env, "a@b.com", Date.now() - 9 * 86400000))) === null);
check("pass signed with another key rejected", (await readPass({ STRIPE_SECRET_KEY: "sk_other" }, pass)) === null);

const noPass = await worker.fetch(new Request("https://x/api/deck?lang=en"), env);
check("deck without pass -> 401", noPass.status === 401);
const bad = await worker.fetch(new Request("https://x/api/deck?lang=en", { headers: { Authorization: "Bearer junk" } }), env);
check("deck with junk pass -> 401", bad.status === 401);
const ok = await worker.fetch(new Request("https://x/api/deck?lang=de", { headers: { Authorization: "Bearer " + pass } }), env);
const cards = await ok.json();
check("deck with valid pass -> full localized deck", ok.status === 200 && cards.length === 400 && !cards[0].translations);
check("static assets still pass through", (await (await worker.fetch(new Request("https://x/index.html"), env)).text()) === "asset");
process.exitCode = fails ? 1 : 0;
