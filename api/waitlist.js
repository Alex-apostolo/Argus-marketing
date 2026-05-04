import { kv } from "@vercel/kv";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "method not allowed" });
  }

  const { email, wtp, pain } = req.body ?? {};

  if (typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: "invalid email" });
  }

  const normalized = email.trim().toLowerCase();
  const added = await kv.sadd("waitlist:emails", normalized);

  if (added === 1) {
    await kv.hset(`waitlist:meta:${normalized}`, {
      email: normalized,
      wtp: wtp ?? null,
      pain: pain ?? null,
      ts: Date.now(),
      ua: req.headers["user-agent"] ?? null,
    });
  }

  return res.status(200).json({ ok: true, duplicate: added === 0 });
}
