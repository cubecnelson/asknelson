# AskNelson

A personal productivity workspace for [xAI Grok](https://docs.x.ai/docs/models), hosted as a static site on GitHub Pages. It includes a Today dashboard, tasks, markdown notes, and Slack-style chat channels — all running in the browser, with no accounts or backend of its own.

Live site: [https://cubecnelson.github.io/asknelson/](https://cubecnelson.github.io/asknelson/)

This page talks to the official xAI API from your browser. It is not an embed of the Grok Bot desktop app.

## How to use

1. Open the [live site](https://cubecnelson.github.io/asknelson/).
2. Click **Settings** and paste an API key from [console.x.ai](https://console.x.ai).
3. Start from **Today**, or open **Tasks**, **Notes**, or a chat **channel**. The default model is `grok-4.7`.
4. Ask AskNelson in a channel (or from the Ask Nelson box on Today) to add, list, update, or complete tasks and notes. It uses client-side function tools against data stored in this browser.
5. Live **web search** and **X search** are on by default via the xAI Responses API, so answers can use current sources. Turn either one off in Settings if you want model-only replies. Search usage may add xAI tool charges on top of tokens.
6. Attach an image or a document with the paperclip button, or drag a file onto the composer, then send. Grok can look at images and read documents in that channel, including when live web or X search is on, and can still manage tasks and notes in the same turn.

## Workspace

- **Today** is the home dashboard. It shows the current date in Asia/Hong_Kong, overdue and today’s tasks with checkboxes, a quick-add field, recent notes, and a short Ask Nelson box that sends into your last chat channel. The last area you opened is remembered in this browser; if you have not opened the workspace before, Today is the default.
- **Tasks** is a local task list: title, optional notes, optional due date, status (to-do / in progress / done), and optional priority (normal / high). Filters are Inbox (open, no due date), Today, Upcoming, Overdue, and Done. You can add, edit, complete, and delete tasks inline.
- **Notes** are local markdown notes with a title and body, a searchable list, an editor, optional pinning, and a safe preview (the same Markdown + DOMPurify renderer used in chat — raw HTML is not injected).
- **Channels** keep the existing Grok chat: rooms, the model picker, Settings, live web/X search, image upload + vision, document upload, drag-and-drop, and Sources under replies. The mobile sidebar still slides open from the menu button.
- **Pinned messages** are per channel. Hover a message (or use the buttons under it on mobile) and click Pin or Unpin. A pin marker appears on the message, and **Pins** in the channel header opens a list of pinned messages. Click one to jump to it in the transcript, or unpin it from the panel.
- **Threads** are Slack-style replies. Click Reply on a channel message to open a thread pane; the parent stays in the main channel, and replies live on that parent. A compact “N replies” control under the parent opens the same thread. The thread has its own composer, including attachments, drag-and-drop, and Enter to send. When you reply in a thread, AskNelson is given earlier channel messages up to the parent, then the thread replies, so it knows what is being discussed.

AskNelson is still a slightly witty assistant named AskNelson, now with tools to operate this workspace.

## Local data, export, and import

Your API key is stored only in this browser (the Credential Management API when available, plus local storage and IndexedDB). Chat rooms, tasks, and notes are stored the same way, so they come back the next time you open the page. Image bytes stay in IndexedDB with the conversation; they are not stored in the GitHub repo or on GitHub Pages. Nothing is sent to the proxy except the API request you already make for chat, search, or file upload.

In Settings you can **Export** a JSON backup of tasks, notes, conversations (including pinned messages and threads), and settings. The API key is **not** included in the backup. **Import** can merge with existing workspace data or replace tasks, notes, and conversations (with a confirm). Invalid files are rejected and leave the current workspace unchanged. Import never overwrites your API key.

If you used the earlier Grok Chatbox name in this same browser, your existing key and rooms are migrated automatically. The IndexedDB database stays at version 1 (`asknelson` / `kv`); tasks, notes, and the last view are extra keys in that same store, so existing chats and the API key are not wiped.

## Images and documents

Supported **images** are JPEG, PNG, GIF, and WebP (BMP is also accepted), up to 20 MB each — the official xAI vision limit. The Responses API image-understanding path is used: each image is sent as an `input_image` part with a `data:image/...;base64,...` `image_url` and `detail: "high"`. Official docs accept JPEG and PNG only, so GIF, WebP, and BMP are converted in the browser first (animated GIFs become a still first frame). When a request includes images, AskNelson also sets `store: false`, as xAI recommends, so the image is not kept in server-side response history.

The default model, `grok-4.7`, supports image input, as do the other models in the picker. Image tokens are billed as regular input tokens.

Supported **documents** include PDF, text, Markdown, CSV, JSON, HTML, common Office documents, and source-code files, up to 50 MB each. Documents are uploaded to the xAI Files API (`purpose: assistants`, expire after 7 days) and referenced as `input_file` with a `file_id`. You can attach images and documents in the same message. The document file itself is not stored in this repository or in GitHub Pages; only the file id and filename are kept in this browser with the chat room.

## AI tools

Chat uses the xAI Responses API (`POST /v1/responses`) with built-in `web_search` / `x_search` when those are enabled, plus these client-side function tools:

- `list_tasks`, `create_task`, `update_task`, `complete_task`
- `list_notes`, `search_notes`, `create_note`, `update_note`

When the model returns a `function_call`, AskNelson runs it against local IndexedDB state, shows a short in-thread line such as “Created task: …”, then submits a `function_call_output` and continues the reply. If the turn includes images (`store: false`), tool results are sent back in the next request’s `input` together with the previous `output` items, which is the documented path when server-side response storage is off. Function tools can run in the same turn as live search and attachments.

Anyone who opens the public page should use their own key; do not paste a shared production key into a computer you do not trust.

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
