# AskNelson

A Slack-style chat UI for [xAI Grok](https://docs.x.ai/docs/models), hosted as a static site on GitHub Pages.

Live site: [https://cubecnelson.github.io/asknelson/](https://cubecnelson.github.io/asknelson/)

This page talks to the official xAI API from your browser. It is not an embed of the Grok Bot desktop app.

## How to use

1. Open the [live site](https://cubecnelson.github.io/asknelson/).
2. Click **Settings** and paste an API key from [console.x.ai](https://console.x.ai).
3. Start a channel and chat. The default model is `grok-4.7`.

Your API key is stored only in this browser (the Credential Management API when available, plus local storage and IndexedDB). Chat rooms are stored the same way, so they come back the next time you open the page. Nothing is committed to this repository. Anyone who opens the public page should use their own key; do not paste a shared production key into a computer you do not trust.

If you used the earlier Grok Chatbox name in this same browser, your existing key and rooms are migrated automatically.

## Run locally

```bash
python3 -m http.server 8080
```

Then open [http://localhost:8080](http://localhost:8080).

## Optional proxy

Direct browser calls to `https://api.x.ai/v1/chat/completions` currently work (CORS is allowed). If that ever changes, set a custom API base URL in Settings to a small backend or Cloudflare Worker that forwards to xAI and holds the key as a server secret.

## License

MIT
