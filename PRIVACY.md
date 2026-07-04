# Privacy Policy — English Polisher

_Last updated: 2026-07-04_

English Polisher is a browser extension that fixes and rewrites text using an AI
provider of your choice. This policy explains what data it handles and where that
data goes. It is written to be read, not to hide behind legalese.

## The short version

- The extension has **no backend server** of its own and collects **no analytics**.
- It sends the text you choose to polish/rewrite **only** to the AI provider you
  configure — and to **nobody else**.
- If you use **Chrome's built-in AI (Gemini Nano)**, your text never leaves your
  device at all.
- Your **API key** is stored locally in your browser profile and is used only to
  authenticate your requests to your chosen provider.

## What data the extension handles

**Text you submit.** When you run Fix / Humanize / Shorten, or use Ask mode, the
text (and any context you provide) is sent to the AI provider you selected in the
extension's settings, over an HTTPS request, so it can return a rewrite. The
extension does not store your text after the request completes.

**Your API key.** The key you paste in settings is stored using Chrome's
`storage.sync` API (so it syncs across your own signed-in Chrome browsers). It is
sent only to the matching provider's API endpoint as an authentication header. It
is never transmitted anywhere else and is never seen by the author of this
extension.

**Your preferences.** Your selected provider, model, and optional style
instructions are stored the same way (`storage.sync`).

The extension does **not** collect names, emails, browsing history, analytics,
telemetry, or advertising identifiers.

## Where your data goes

Depending on the provider you choose, your submitted text is sent to that
provider and is subject to that provider's own privacy policy:

- **Google Gemini** — https://ai.google.dev/gemini-api/terms and https://policies.google.com/privacy
- **Chrome built-in AI (Gemini Nano)** — runs locally on your device; text is not sent anywhere
- **Groq** — https://groq.com/privacy-policy/
- **OpenRouter** — https://openrouter.ai/privacy
- **Anthropic Claude** — https://www.anthropic.com/legal/privacy

You control which provider is used, and you can switch or remove it at any time in
the extension's settings.

## Data retention

The extension itself retains only your settings and API key locally, until you
change or clear them (removing the extension deletes them). It does not keep copies
of the text you rewrite. Any retention of request data on the provider side is
governed by that provider's policy, linked above.

## Contact

Questions or issues: https://github.com/driss7/english-polisher/issues
