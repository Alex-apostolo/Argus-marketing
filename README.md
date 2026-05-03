# argus-marketing

Single-page marketing site for Argus. Static HTML + Tailwind via CDN. Zero build step.

## Edit
- All copy and styling: `index.html`
- Reload the file in your browser.

## Run locally
Any of these — pick one:
```
python3 -m http.server 8000      # then open http://localhost:8000
npx serve .                      # then open the URL it prints
```
Or just double-click `index.html`.

## Deploy
Drag this folder into Vercel / Netlify / Cloudflare Pages — done. No config needed.

Or via CLI:
```
npx vercel --prod
```

## Wire the waitlist form
The form currently `console.log`s the email. Pick one:
- **Formspree** (free tier, 50/mo): replace `onsubmit` with `action="https://formspree.io/f/<id>"` and `method="POST"`.
- **Tally**: embed a Tally form instead of the inline `<form>`.
- **ConvertKit**: paste their form embed.

## Track conversion
Add Plausible / Umami / Posthog before driving traffic, otherwise you can't measure what's working.
