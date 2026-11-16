# AskNelson

A Slack-style chat UI for [xAI Grok](https://docs.x.ai/docs/models), hosted as a static site on GitHub Pages.

Live site: [https://cubecnelson.github.io/asknelson/](https://cubecnelson.github.io/asknelson/)

This page talks to the official xAI API from your browser. It is not an embed of the Grok Bot desktop app.

## How to use

1. Open the [live site](https://cubecnelson.github.io/asknelson/).
2. Click **Settings** and paste an API key from [console.x.ai](https://console.x.ai).
3. Start a channel and chat. The default model is `grok-4.7`.
4. Live **web search** and **X search** are on by default via the xAI Responses API, so answers can use current sources. Turn either one off in Settings if you want offline/model-only replies. Search usage may add xAI tool charges on top of tokens.
5. Attach an image or a document with the paperclip button, or drag a file onto the composer, then send. Grok can look at images and read documents in that channel, including when live web or X search is on.

Supported **images** are JPEG, PNG, GIF, and WebP (BMP is also accepted), up to 20 MB each — the official xAI vision limit. The Responses API image-understanding path is used: each image is sent as an `input_image` part with a `data:image/...;base64,...` `image_url` and `detail: "high"`. Official docs accept JPEG and PNG only, so GIF, WebP, and BMP are converted in the browser first (animated GIFs become a still first frame). When a request includes images, AskNelson also sets `store: false`, as xAI recommends, so the image is not kept in server-side response history. Image bytes stay in this browser (IndexedDB) so follow-up questions in the same room can still see them; they are not stored in the GitHub repo or on GitHub Pages.

The default model, `grok-4.7`, supports image input, as do the other models in the picker. Image tokens are billed as regular input tokens.

Supported **documents** include PDF, text, Markdown, CSV, JSON, HTML, common Office documents, and source-code files, up to 50 MB each. Documents are uploaded to the xAI Files API (`purpose: assistants`, expire after 7 days) and referenced as `input_file` with a `file_id`. You can attach images and documents in the same message. The document file itself is not stored in this repository or in GitHub Pages; only the file id and filename are kept in this browser with the chat room.

Your API key is stored only in this browser (the Credential Management API when available, plus local storage and IndexedDB). Chat rooms are stored the same way, so they come back the next time you open the page. Nothing is committed to this repository. Anyone who opens the public page should use their own key; do not paste a shared production key into a computer you do not trust.

If you used the earlier Grok Chatbox name in this same browser, your existing key and rooms are migrated automatically.

## Run locally

```bash
python3 -m http.server 8080
```

Then open [http://localhost:8080](http://localhost:8080).

## API proxy

Some browsers (notably Microsoft Edge with Tracking Prevention) fail the CORS preflight to `https://api.x.ai`, even though the API itself returns the correct CORS headers. AskNelson can retry through a small Cloudflare Worker in `proxy/` that forwards `POST /v1/chat/completions`, `POST /v1/responses`, and `POST /v1/files`, and adds CORS for this GitHub Pages origin. Your API key still stays in the browser; the worker does not store it.

Deploy from `proxy/`:

```bash
npx wrangler deploy
```

The live proxy is `https://asknelson-proxy.cubecnelson.workers.dev/v1`. AskNelson uses it automatically. You can also paste that URL as the API base in Settings.

## License

MIT
