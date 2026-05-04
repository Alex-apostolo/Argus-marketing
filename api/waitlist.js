import { kv } from "@vercel/kv";
import { Resend } from "resend";

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
  const total = await kv.scard("waitlist:emails");

  if (added === 1) {
    await kv.hset(`waitlist:meta:${normalized}`, {
      email: normalized,
      wtp: wtp ?? null,
      pain: pain ?? null,
      ts: Date.now(),
      ua: req.headers["user-agent"] ?? null,
    });

    if (process.env.RESEND_API_KEY && process.env.NOTIFY_EMAIL) {
      const resend = new Resend(process.env.RESEND_API_KEY);
      resend.emails.send({
        from: "argus waitlist <onboarding@resend.dev>",
        to: process.env.NOTIFY_EMAIL,
        subject: `+1 waitlist signup (${total} total)`,
        text: [
          `email: ${normalized}`,
          `wtp:   ${wtp ?? "—"}`,
          `pain:  ${pain ?? "—"}`,
          `total: ${total}`,
        ].join("\n"),
      }).catch((err) => console.error("resend notify failed:", err));
    }
  }

  return res.status(200).json({ ok: true, duplicate: added === 0 });
}
