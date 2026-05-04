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
          text: [
            `email: ${normalized}`,
            `wtp:   ${wtp ?? "—"}`,
            `pain:  ${pain ?? "—"}`,
            `total: ${total}`,
          ].join("\n"),
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
