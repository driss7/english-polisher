# Privacy Policy — English Polisher

_Last updated: 2026-07-04 (added local popup-draft persistence)_

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
extension does not retain your text after the request completes, with one local
exception: text typed into the popup (and the latest result) is kept as a draft in
the browser's session storage so it isn't lost if the popup closes. Drafts never
leave your device, are deleted when you close the browser, and can be removed at
any time with the popup's "clear" button.

**Your API key.** The key you paste in settings is stored using Chrome's
`storage.sync` API (so it syncs across your own signed-in Chrome browsers). It is
sent only to the matching provider's API endpoint as an authentication header. It
is never transmitted anywhere else and is never seen by the author of this
extension.

**Your preferences.** Your selected provider, model, and optional style
instructions are stored the same way (`storage.sync`).

**Popup drafts.** Text you type in the popup is saved locally in `storage.session`
(in-memory, this browser only) purely so an accidental click doesn't wipe your
draft. It is never synced or transmitted, disappears when the browser exits, and
the popup's "clear" button deletes it immediately.

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
change or clear them (removing the extension deletes them). Popup drafts are kept
locally only until the browser closes (or you press "clear"). Beyond that it keeps
no copies of the text you rewrite. Any retention of request data on the provider
side is governed by that provider's policy, linked above.

## Contact

Questions or issues: https://github.com/driss7/english-polisher/issues
