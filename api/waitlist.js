import { Redis } from "@upstash/redis";
import { Resend } from "resend";
import disposableDomains from "disposable-email-domains" with { type: "json" };
import { promises as dns } from "node:dns";

const kv = Redis.fromEnv();
const disposableSet = new Set(disposableDomains);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "method not allowed" });
  }

  const { email, wtp, pain } = req.body ?? {};

  if (typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: "that doesn't look like a valid email address." });
  }

  const normalized = email.trim().toLowerCase();
  const domain = normalized.split("@")[1];

  if (disposableSet.has(domain)) {
    console.log("[waitlist] rejected disposable domain", { domain });
    return res.status(400).json({ error: "please use a non-disposable email address." });
  }

  try {
    const records = await dns.resolveMx(domain);
    if (!records || records.length === 0) {
      console.log("[waitlist] rejected no MX records", { domain });
      return res.status(400).json({ error: "that email domain doesn't look reachable, check the spelling?" });
    }
  } catch (err) {
    console.log("[waitlist] rejected MX lookup failed", { domain, code: err.code });
    return res.status(400).json({ error: "that email domain doesn't look reachable, check the spelling?" });
  }
  const added = await kv.sadd("waitlist:emails", normalized);
  const total = await kv.scard("waitlist:emails");

  console.log("[waitlist] signup", { normalized, added, total });

  if (added === 1) {
    await kv.hset(`waitlist:meta:${normalized}`, {
      email: normalized,
      wtp: wtp ?? null,
      pain: pain ?? null,
      ts: Date.now(),
      ua: req.headers["user-agent"] ?? null,
    });

    console.log("[waitlist] env check", {
      hasResendKey: Boolean(process.env.RESEND_API_KEY),
      hasNotifyEmail: Boolean(process.env.NOTIFY_EMAIL),
      notifyEmail: process.env.NOTIFY_EMAIL,
    });

    if (process.env.RESEND_API_KEY && process.env.NOTIFY_EMAIL) {
      console.log("[waitlist] sending resend notification");
      const resend = new Resend(process.env.RESEND_API_KEY);
      try {
        const result = await resend.emails.send({
          from: "argus waitlist <onboarding@resend.dev>",
          to: process.env.NOTIFY_EMAIL,
          subject: `+1 waitlist signup (${total} total)`,
          text: [`email: ${normalized}`, `wtp:   ${wtp ?? "—"}`, `pain:  ${pain ?? "—"}`, `total: ${total}`].join("\n"),
        });
        console.log("[waitlist] resend result", result);
      } catch (err) {
        console.error("[waitlist] resend notify failed:", err);
      }
    } else {
      console.warn("[waitlist] skipping resend — env vars missing");
    }
  } else {
    console.log("[waitlist] duplicate, skipping notification");
  }

  return res.status(200).json({ ok: true, duplicate: added === 0 });
}
