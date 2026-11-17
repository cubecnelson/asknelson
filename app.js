    const MODELS = [
      { id: "grok-4.7", label: "grok-4.7 (recommended)" },
      { id: "grok-4.6", label: "grok-4.6" },
      { id: "grok-4.5", label: "grok-4.5" },
      { id: "grok-4.3", label: "grok-4.3" }
    ];
    const K = {
      key: "asknelson:apiKey",
      settings: "asknelson:settings",
      convos: "asknelson:conversations",
      active: "asknelson:activeId",
      tasks: "asknelson:tasks",
      notes: "asknelson:notes",
      view: "asknelson:lastView"
    };
    const LEGACY_K = {
      key: "grok-chatbox:apiKey",
      settings: "grok-chatbox:settings",
      convos: "grok-chatbox:conversations",
      active: "grok-chatbox:activeId"
    };
    const CRED_ID = "asknelson-xai";
    const OLD_DEFAULT_PROMPT = "You are AskNelson, a helpful, clear, and slightly witty assistant powered by xAI Grok.";
    const DEFAULT_PROMPT = "You are AskNelson, a helpful, clear, and slightly witty personal productivity assistant powered by xAI Grok. You can manage the user's tasks and notes in this browser workspace with your tools (list_tasks, create_task, update_task, complete_task, list_notes, search_notes, create_note, update_note). When they ask you to add, list, update, complete, or find tasks or notes, use those tools instead of only describing what you would do. Confirm what you changed briefly. Task due dates use YYYY-MM-DD in the Asia/Hong_Kong calendar. You are not an embed of any desktop bot.";
    const DEFAULT_BASE = "https://api.x.ai/v1";
    const PROXY_BASE = "https://asknelson-proxy.cubecnelson.workers.dev/v1";
    const DB_NAME = "asknelson";
    const DB_STORE = "kv";
    const TZ = "Asia/Hong_Kong";
    const MAX_TOOL_ROUNDS = 8;

    const $ = (id) => document.getElementById(id);
    const MAX_FILE_BYTES = 50 * 1024 * 1024;
    const MAX_IMAGE_BYTES = 20 * 1024 * 1024;
    const REMOVED_PLACEHOLDER = "This message was removed";
    const FILE_EXTS = /\.(pdf|txt|text|md|markdown|csv|tsv|json|xml|html|htm|rtf|log|yml|yaml|toml|ini|cfg|conf|py|js|mjs|cjs|ts|tsx|jsx|java|c|cc|cpp|h|hpp|cs|go|rs|rb|php|sh|bash|zsh|sql|css|scss|less|docx?|xlsx?|pptx?)$/i;
    const IMAGE_EXTS = /\.(jpe?g|png|gif|webp|bmp)$/i;
    const IMAGE_MIMES = /^image\/(jpeg|jpg|png|gif|webp|bmp)$/i;
    const NATIVE_VISION_MIMES = /^image\/(jpeg|jpg|png)$/i;

    const WORKSPACE_TOOLS = [
      {
        type: "function",
        name: "list_tasks",
        description: "List the user's tasks. Filters: inbox (open, no due date), today, upcoming, overdue, done, open, or all.",
        parameters: {
          type: "object",
          properties: {
            filter: {
              type: "string",
              enum: ["inbox", "today", "upcoming", "overdue", "done", "open", "all"],
              description: "Which tasks to return. Defaults to open."
            }
          }
        }
      },
      {
        type: "function",
        name: "create_task",
        description: "Create a new task in the user's local task list.",
        parameters: {
          type: "object",
          properties: {
            title: { type: "string", description: "Task title" },
            notes: { type: "string", description: "Optional notes or details" },
            due: { type: "string", description: "Optional due date as YYYY-MM-DD (Asia/Hong_Kong calendar)" },
            priority: { type: "string", enum: ["normal", "high"] },
            status: { type: "string", enum: ["todo", "in-progress", "done"] }
          },
          required: ["title"]
        }
      },
      {
        type: "function",
        name: "update_task",
        description: "Update an existing task by id. Only provided fields are changed. Pass an empty due string to clear the due date.",
        parameters: {
          type: "object",
          properties: {
            id: { type: "string", description: "Task id" },
            title: { type: "string" },
            notes: { type: "string" },
            due: { type: "string", description: "YYYY-MM-DD, or empty string to clear" },
            priority: { type: "string", enum: ["normal", "high"] },
            status: { type: "string", enum: ["todo", "in-progress", "done"] }
          },
          required: ["id"]
        }
      },
      {
        type: "function",
        name: "complete_task",
        description: "Mark a task as done by id, or by unique title match if id is omitted.",
        parameters: {
          type: "object",
          properties: {
            id: { type: "string", description: "Task id" },
            title: { type: "string", description: "Used to find the task if id is not provided" }
          }
        }
      },
      {
        type: "function",
        name: "list_notes",
        description: "List the user's notes with titles, metadata, and a short excerpt.",
        parameters: {
          type: "object",
          properties: {
            limit: { type: "integer", description: "Max notes to return, default 20" }
          }
        }
      },
      {
        type: "function",
        name: "search_notes",
        description: "Search notes by title or body text.",
        parameters: {
          type: "object",
          properties: {
            query: { type: "string", description: "Search text" }
          },
          required: ["query"]
        }
      },
      {
        type: "function",
        name: "create_note",
        description: "Create a new markdown note in the user's local notebook.",
        parameters: {
          type: "object",
          properties: {
            title: { type: "string", description: "Note title" },
            body: { type: "string", description: "Markdown body" },
            pinned: { type: "boolean" }
          },
          required: ["title"]
        }
      },
      {
        type: "function",
        name: "update_note",
        description: "Update an existing note by id. Only provided fields are changed.",
        parameters: {
          type: "object",
          properties: {
            id: { type: "string", description: "Note id" },
            title: { type: "string" },
            body: { type: "string" },
            pinned: { type: "boolean" }
          },
          required: ["id"]
        }
      }
    ];

    const state = {
      conversations: [],
      activeId: null,
      sending: false,
      abort: null,
      apiKey: "",
      pendingFiles: [],
      tasks: [],
      notes: [],
      view: "today",
      taskFilter: "inbox",
      editingTaskId: null,
      activeNoteId: null,
      noteQuery: "",
      notePreview: false,
      openThreadId: null,
      pinsOpen: false,
      highlightMsgId: null,
      threadPendingFiles: []
    };
    let pendingImport = null;
    let noteSaveTimer = null;
    let confirmResolver = null;

    function todayISO(d) {
      return (d || new Date()).toLocaleDateString("en-CA", { timeZone: TZ });
    }
    function formatLongDate(d) {
      return (d || new Date()).toLocaleDateString("en-US", {
        weekday: "long", year: "numeric", month: "long", day: "numeric", timeZone: TZ
      });
    }
    function formatShortDate(iso) {
      if (!iso) return "";
      const parts = String(iso).split("-").map(Number);
      if (parts.length !== 3 || parts.some((n) => !n && n !== 0)) return String(iso);
      const dt = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2], 12));
      return dt.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
    }

    function formatBytes(n) {
      if (!n && n !== 0) return "";
      if (n < 1024) return n + " B";
      if (n < 1024 * 1024) return (n / 1024).toFixed(1) + " KB";
      return (n / (1024 * 1024)).toFixed(1) + " MB";
    }
    function isImageFile(file) {
      const name = (file && file.name) || "";
      const type = (file && file.type) || "";
      return IMAGE_MIMES.test(type) || IMAGE_EXTS.test(name);
    }
    function isAllowedFile(file) {
      return isImageFile(file) || FILE_EXTS.test((file && file.name) || "");
    }
    function needsImageConversion(file) {
      const type = ((file && file.type) || "").toLowerCase();
      const name = (file && file.name) || "";
      if (NATIVE_VISION_MIMES.test(type)) return false;
      if (!type && /\.(jpe?g|png)$/i.test(name)) return false;
      return true;
    }
    function dataUrlBytes(dataUrl) {
      const str = String(dataUrl || "");
      const i = str.indexOf(",");
      const b64 = i >= 0 ? str.slice(i + 1) : str;
      const padding = b64.endsWith("==") ? 2 : b64.endsWith("=") ? 1 : 0;
      return Math.max(0, Math.floor(b64.length * 3 / 4) - padding);
    }
    function readFileAsDataUrl(file) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error(file.name + ": could not read the image."));
        reader.readAsDataURL(file);
      });
    }
    function loadImageElement(url) {
      return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error("Could not decode the image."));
        img.src = url;
      });
    }
    async function imageToDataUrl(file) {
      if (file.size > MAX_IMAGE_BYTES) {
        throw new Error(file.name + " is larger than 20 MB, the xAI image limit.");
      }
      if (!needsImageConversion(file)) {
        return await readFileAsDataUrl(file);
      }
      const srcUrl = URL.createObjectURL(file);
      try {
        const img = await loadImageElement(srcUrl);
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth || img.width;
        canvas.height = img.naturalHeight || img.height;
        if (!canvas.width || !canvas.height) {
          throw new Error(file.name + " could not be converted. xAI vision accepts JPEG and PNG.");
        }
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0);
        let dataUrl = canvas.toDataURL("image/png");
        if (dataUrlBytes(dataUrl) > MAX_IMAGE_BYTES) {
          dataUrl = canvas.toDataURL("image/jpeg", 0.9);
        }
        if (dataUrlBytes(dataUrl) > MAX_IMAGE_BYTES) {
          throw new Error(file.name + " is larger than 20 MB after conversion, the xAI image limit.");
        }
        return dataUrl;
      } catch (err) {
        if (err && /20 MB|xAI image limit|could not be converted|could not read/i.test(err.message || "")) throw err;
        throw new Error(file.name + " could not be converted. xAI vision accepts JPEG and PNG.");
      } finally {
        URL.revokeObjectURL(srcUrl);
      }
    }
    function revokePreview(item) {
      if (item && item.previewUrl) {
        URL.revokeObjectURL(item.previewUrl);
        item.previewUrl = "";
      }
    }
    function pendingKey(which) {
      return which === "thread" ? "threadPendingFiles" : "pendingFiles";
    }
    function showComposerStatus(msg, which) {
      const el = $((which === "thread" ? "threadComposerStatus" : "composerStatus"));
      if (el) el.textContent = msg || "";
    }
    function renderAttachList(which) {
      if (!which) {
        renderAttachList("main");
        renderAttachList("thread");
        return;
      }
      const box = $((which === "thread" ? "threadAttachList" : "attachList"));
      if (!box) return;
      const list = state[pendingKey(which)] || [];
      box.innerHTML = "";
      for (const item of list) {
        const chip = document.createElement("span");
        chip.className = "file-chip" + (isImageFile(item.file) ? " is-image" : "");
        if (isImageFile(item.file)) {
          if (!item.previewUrl) item.previewUrl = URL.createObjectURL(item.file);
          const thumb = document.createElement("img");
          thumb.className = "thumb";
          thumb.alt = "";
          thumb.src = item.previewUrl;
          chip.appendChild(thumb);
        }
        const fn = document.createElement("span");
        fn.className = "fn";
        fn.textContent = item.file.name;
        fn.title = item.file.name;
        const sz = document.createElement("span");
        sz.className = "sz";
        sz.textContent = formatBytes(item.file.size);
        const x = document.createElement("button");
        x.className = "x";
        x.type = "button";
        x.title = "Remove";
        x.setAttribute("aria-label", "Remove " + item.file.name);
        x.textContent = "\u2715";
        x.addEventListener("click", () => {
          revokePreview(item);
          state[pendingKey(which)] = (state[pendingKey(which)] || []).filter((f) => f.id !== item.id);
          renderAttachList(which);
        });
        chip.append(fn, sz, x);
        box.appendChild(chip);
      }
    }
    function addPendingFiles(fileList, which) {
      which = which || "main";
      const key = pendingKey(which);
      const errors = [];
      for (const file of fileList || []) {
        if (!isAllowedFile(file)) {
          errors.push(file.name + " is not a supported image or document type. Images can be JPEG, PNG, GIF, or WebP.");
          continue;
        }
        if (isImageFile(file)) {
          if (file.size > MAX_IMAGE_BYTES) {
            errors.push(file.name + " is larger than 20 MB, the xAI image limit.");
            continue;
          }
        } else if (file.size > MAX_FILE_BYTES) {
          errors.push(file.name + " is larger than 50 MB.");
          continue;
        }
        if ((state[key] || []).some((f) => f.file.name === file.name && f.file.size === file.size && f.file.lastModified === file.lastModified)) {
          continue;
        }
        state[key].push({ id: crypto.randomUUID(), file });
      }
      renderAttachList(which);
      showComposerStatus(errors.join(" "), which);
    }
    function slimMessage(m) {
      const replies = (m.replies || []).map(slimMessage);
      const atts = m.attachments || [];
      if (!atts.some((a) => a && a.dataUrl)) {
        return { ...m, replies };
      }
      return {
        ...m,
        replies,
        attachments: atts.map((a) => {
          if (!a || !a.dataUrl) return a;
          const copy = { ...a };
          delete copy.dataUrl;
          return copy;
        })
      };
    }
    function slimConversations(convos) {
      return (convos || []).map((c) => ({
        ...c,
        messages: (c.messages || []).map(slimMessage)
      }));
    }
    function walkMessages(list, fn) {
      for (const m of list || []) {
        fn(m);
        if (m.replies && m.replies.length) walkMessages(m.replies, fn);
      }
    }
    function convoRecency(list) {
      let msgs = 0, last = 0, images = 0;
      for (const c of list || []) {
        walkMessages(c.messages, (m) => {
          msgs += 1;
          if (m.ts > last) last = m.ts;
          if ((m.attachments || []).some((a) => a && a.dataUrl)) images += 1;
        });
      }
      return { msgs, last, images };
    }
    function preferConvoList(a, b) {
      const lists = [a, b].filter((list) => Array.isArray(list) && list.length);
      if (!lists.length) return [];
      if (lists.length === 1) return lists[0];
      const ra = convoRecency(a);
      const rb = convoRecency(b);
      if (ra.last !== rb.last) return ra.last >= rb.last ? a : b;
      if (ra.images !== rb.images) return ra.images > rb.images ? a : b;
      return ra.msgs >= rb.msgs ? a : b;
    }
    function preferRecordList(a, b) {
      const lists = [a, b].filter((list) => Array.isArray(list) && list.length);
      if (!lists.length) return [];
      if (lists.length === 1) return lists[0];
      const maxU = (list) => list.reduce((m, x) => Math.max(m, Number(x.updatedAt) || 0), 0);
      const ua = maxU(a), ub = maxU(b);
      if (ua !== ub) return ua >= ub ? a : b;
      return a.length >= b.length ? a : b;
    }

    function migrateStorage() {
      for (const name of Object.keys(K)) {
        if (!LEGACY_K[name]) continue;
        const fresh = localStorage.getItem(K[name]);
        const legacy = localStorage.getItem(LEGACY_K[name]);
        if (!fresh && legacy) localStorage.setItem(K[name], legacy);
      }
    }
    function openDb() {
      return new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, 1);
        req.onupgradeneeded = () => {
          if (!req.result.objectStoreNames.contains(DB_STORE)) {
            req.result.createObjectStore(DB_STORE);
          }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
    }
    async function idbGet(key) {
      try {
        const db = await openDb();
        return await new Promise((resolve, reject) => {
          const tx = db.transaction(DB_STORE, "readonly");
          const r = tx.objectStore(DB_STORE).get(key);
          r.onsuccess = () => resolve(r.result);
          r.onerror = () => reject(r.error);
        });
      } catch {
        return undefined;
      }
    }
    async function idbSet(key, value) {
      try {
        const db = await openDb();
        await new Promise((resolve, reject) => {
          const tx = db.transaction(DB_STORE, "readwrite");
          const r = tx.objectStore(DB_STORE).put(value, key);
          r.onsuccess = () => resolve();
          r.onerror = () => reject(r.error);
          tx.onerror = () => reject(tx.error);
        });
      } catch {}
    }
    async function idbDel(key) {
      try {
        const db = await openDb();
        await new Promise((resolve, reject) => {
          const tx = db.transaction(DB_STORE, "readwrite");
          const r = tx.objectStore(DB_STORE).delete(key);
          r.onsuccess = () => resolve();
          r.onerror = () => reject(r.error);
        });
      } catch {}
    }

    function loadSettings() {
      let s = {};
      try { s = JSON.parse(localStorage.getItem(K.settings) || "{}"); } catch {}
      const savedPrompt = s.systemPrompt;
      const systemPrompt = !savedPrompt || savedPrompt === OLD_DEFAULT_PROMPT
        ? DEFAULT_PROMPT
        : savedPrompt;
      return {
        model: s.model || "grok-4.7",
        baseUrl: s.baseUrl || DEFAULT_BASE,
        systemPrompt,
        liveWeb: s.liveWeb !== false,
        liveX: s.liveX !== false
      };
    }
    function requestInstructions(s, threadParent) {
      let text = (s.systemPrompt || DEFAULT_PROMPT)
        + "\n\nToday is " + formatLongDate() + " (Asia/Hong_Kong). The workspace tools operate on the user's local tasks and notes in this browser.";
      if (threadParent) {
        text += "\n\nThe user is replying in a thread. The input includes earlier channel messages up to the parent message being discussed, then the thread replies after that parent. Stay focused on the thread topic unless asked otherwise.";
      }
      return text;
    }
    function saveSettingsObj(s) {
      localStorage.setItem(K.settings, JSON.stringify(s));
      idbSet("settings", s);
    }
    function getKey() { return state.apiKey || localStorage.getItem(K.key) || ""; }
    async function setKey(v) {
      state.apiKey = v || "";
      if (v) {
        localStorage.setItem(K.key, v);
        await idbSet("apiKey", v);
        try {
          if (window.PasswordCredential && navigator.credentials && navigator.credentials.store) {
            await navigator.credentials.store(new PasswordCredential({
              id: CRED_ID,
              name: "AskNelson xAI API key",
              password: v
            }));
          }
        } catch {}
      } else {
        localStorage.removeItem(K.key);
        await idbDel("apiKey");
      }
    }
    async function restoreKey() {
      migrateStorage();
      state.apiKey = localStorage.getItem(K.key) || "";
      if (!state.apiKey) {
        const fromIdb = await idbGet("apiKey");
        if (fromIdb) {
          state.apiKey = fromIdb;
          localStorage.setItem(K.key, fromIdb);
        }
      }
      if (!state.apiKey) {
        try {
          if (navigator.credentials && navigator.credentials.get) {
            const cred = await navigator.credentials.get({
              password: true,
              mediation: "silent"
            });
            if (cred && cred.password) {
              state.apiKey = cred.password;
              localStorage.setItem(K.key, cred.password);
              await idbSet("apiKey", cred.password);
            }
          }
        } catch {}
      }
      return state.apiKey;
    }
    async function loadConvos() {
      migrateStorage();
      let fromLs = [];
      try { fromLs = JSON.parse(localStorage.getItem(K.convos) || "[]"); }
      catch { fromLs = []; }
      const fromIdb = await idbGet("conversations");
      const list = preferConvoList(fromIdb, fromLs);
      state.conversations = (list || []).map((c) => ensureConvoShape(c));
      if (!state.conversations.length) {
        const first = makeConvo("general");
        state.conversations = [first];
        state.activeId = first.id;
        persistConvos();
      } else {
        const fromIdbActive = await idbGet("activeId");
        state.activeId = localStorage.getItem(K.active) || fromIdbActive || state.conversations[0].id;
        if (!state.conversations.some((c) => c.id === state.activeId)) {
          state.activeId = state.conversations[0].id;
        }
        persistConvos();
      }
    }
    function persistConvos() {
      try {
        localStorage.setItem(K.convos, JSON.stringify(slimConversations(state.conversations)));
        if (state.activeId) localStorage.setItem(K.active, state.activeId);
      } catch {}
      idbSet("conversations", state.conversations);
      if (state.activeId) idbSet("activeId", state.activeId);
    }
    function makeConvo(name) {
      return {
        id: crypto.randomUUID(),
        name: name || "new-chat",
        messages: [],
        pinnedIds: [],
        createdAt: Date.now()
      };
    }
    function active() {
      return state.conversations.find((c) => c.id === state.activeId);
    }
    function makeMessage(fields) {
      return Object.assign({
        id: crypto.randomUUID(),
        role: "user",
        content: "",
        ts: Date.now(),
        attachments: [],
        replies: []
      }, fields || {});
    }
    function ensureMessageShape(m) {
      if (!m || typeof m !== "object") return m;
      if (!m.id) m.id = crypto.randomUUID();
      if (!Array.isArray(m.replies)) m.replies = [];
      else m.replies.forEach(ensureMessageShape);
      if (m.deleted) {
        m.deleted = true;
        m.content = REMOVED_PLACEHOLDER;
        m.attachments = [];
        delete m.sources;
        delete m.toolLog;
      }
      return m;
    }
    function ensureConvoShape(c) {
      if (!c || typeof c !== "object") return c;
      if (!Array.isArray(c.messages)) c.messages = [];
      c.messages.forEach(ensureMessageShape);
      const live = new Set();
      walkMessages(c.messages, (m) => { if (m && m.id && !m.deleted) live.add(m.id); });
      const src = Array.isArray(c.pinnedIds) ? c.pinnedIds : [];
      c.pinnedIds = src.filter((id, i) => typeof id === "string" && live.has(id) && src.indexOf(id) === i);
      return c;
    }
    function findMessage(c, id) {
      if (!c || !id) return null;
      for (const m of c.messages || []) {
        if (m.id === id) return { msg: m, parent: null };
        for (const r of m.replies || []) {
          if (r.id === id) return { msg: r, parent: m };
        }
      }
      return null;
    }
    function isPinned(c, id) {
      return !!(c && Array.isArray(c.pinnedIds) && c.pinnedIds.includes(id));
    }
    function togglePin(id) {
      const c = active();
      const hit = c && id && findMessage(c, id);
      if (!hit || hit.msg.deleted) return;
      if (!Array.isArray(c.pinnedIds)) c.pinnedIds = [];
      const i = c.pinnedIds.indexOf(id);
      if (i >= 0) c.pinnedIds.splice(i, 1);
      else c.pinnedIds.push(id);
      persistConvos();
      renderChat();
    }
    function unpinId(c, id) {
      if (!c || !id || !Array.isArray(c.pinnedIds)) return;
      c.pinnedIds = c.pinnedIds.filter((x) => x !== id);
    }
    function softDeleteMessage(m) {
      if (!m) return;
      m.deleted = true;
      m.content = REMOVED_PLACEHOLDER;
      m.attachments = [];
      delete m.sources;
      delete m.toolLog;
      delete m.pending;
      delete m.searching;
      delete m.toolRunning;
      delete m.upload;
    }
    function dropMessageFromList(list, id) {
      if (!list) return false;
      const i = list.findIndex((m) => m && m.id === id);
      if (i < 0) return false;
      list.splice(i, 1);
      return true;
    }
    function clearPointerIds(id) {
      if (state.highlightMsgId === id) state.highlightMsgId = null;
    }
    function pruneDeletedParent(c, parent) {
      if (!c || !parent || !parent.deleted) return false;
      if (parent.replies && parent.replies.length) return false;
      dropMessageFromList(c.messages, parent.id);
      unpinId(c, parent.id);
      clearPointerIds(parent.id);
      if (state.openThreadId === parent.id) closeThread({ keepHighlight: true });
      return true;
    }
    function removeMessage(id) {
      const c = active();
      if (!c || !id) return;
      const hit = findMessage(c, id);
      if (!hit || !hit.msg || hit.msg.pending || hit.msg.deleted) return;
      const msg = hit.msg;
      const parent = hit.parent;
      if (parent) {
        dropMessageFromList(parent.replies || [], id);
        unpinId(c, id);
        clearPointerIds(id);
        pruneDeletedParent(c, parent);
      } else if (msg.replies && msg.replies.length) {
        softDeleteMessage(msg);
        unpinId(c, id);
      } else {
        dropMessageFromList(c.messages, id);
        unpinId(c, id);
        clearPointerIds(id);
        if (state.openThreadId === id) closeThread();
      }
      persistConvos();
      renderChat();
    }
    function closeConfirm(result) {
      const modal = $("confirmModal");
      if (modal) modal.classList.remove("open");
      const resolve = confirmResolver;
      confirmResolver = null;
      if (resolve) resolve(!!result);
    }
    function askConfirm(opts) {
      const options = opts || {};
      return new Promise((resolve) => {
        if (confirmResolver) closeConfirm(false);
        confirmResolver = resolve;
        const title = $("confirmTitle");
        const body = $("confirmBody");
        const ok = $("confirmOk");
        if (title) title.textContent = options.title || "Remove this message?";
        if (body) body.textContent = options.body || "This only removes it from this browser.";
        if (ok) ok.textContent = options.okLabel || "Remove";
        const modal = $("confirmModal");
        if (modal) modal.classList.add("open");
        const cancel = $("confirmCancel");
        if (cancel) cancel.focus();
      });
    }
    async function requestRemove(id) {
      const c = active();
      const hit = c && id && findMessage(c, id);
      if (!hit || !hit.msg || hit.msg.pending || hit.msg.deleted) return;
      const ok = await askConfirm({
        title: "Remove this message?",
        body: "This only removes it from this browser.",
        okLabel: "Remove"
      });
      if (ok) removeMessage(id);
    }
    function messageExcerpt(m, n) {
      if (m && m.deleted) return REMOVED_PLACEHOLDER;
      const limit = n || 140;
      const t = String((m && m.content) || "").replace(/\s+/g, " ").trim();
      if (t) return t.length > limit ? t.slice(0, limit) + "\u2026" : t;
      const atts = (m && m.attachments) || [];
      if (atts.length) return atts.map((a) => a.filename || a.kind || "attachment").join(", ");
      return "(No text)";
    }
    function messageWho(m) {
      return m && m.role === "user" ? "You" : m && m.role === "assistant" ? "AskNelson" : "Error";
    }
    function setSendingUi(on) {
      state.sending = on;
      if ($("send")) $("send").disabled = on;
      if ($("threadSend")) $("threadSend").disabled = on;
    }
    function closePins() {
      state.pinsOpen = false;
      const panel = $("pinsPanel");
      if (panel) panel.hidden = true;
      const btn = $("pinsBtn");
      if (btn) btn.classList.remove("is-on");
    }
    function updatePinsButton(c) {
      const btn = $("pinsBtn");
      if (!btn) return;
      const show = state.view === "channels" && !!c;
      btn.hidden = !show;
      const n = (c && c.pinnedIds && c.pinnedIds.length) || 0;
      btn.textContent = n ? "Pins (" + n + ")" : "Pins";
      btn.classList.toggle("is-on", !!(show && state.pinsOpen));
      btn.setAttribute("aria-expanded", show && state.pinsOpen ? "true" : "false");
    }
    function renderPinsPanel() {
      const panel = $("pinsPanel");
      const list = $("pinsList");
      const c = active();
      if (!panel || !list) return;
      if (!state.pinsOpen || state.view !== "channels" || !c) {
        panel.hidden = true;
        return;
      }
      panel.hidden = false;
      list.innerHTML = "";
      const ids = (c.pinnedIds || []).slice().reverse();
      const found = [];
      for (const id of ids) {
        const hit = findMessage(c, id);
        if (hit) found.push({ id, ...hit });
      }
      if (!found.length) {
        list.innerHTML = `<div class="pins-empty">No pinned messages in this channel. Hover a message (or use the buttons under it on mobile) and click Pin.</div>`;
        return;
      }
      for (const item of found) {
        const row = document.createElement("div");
        row.className = "pin-item";
        row.tabIndex = 0;
        row.setAttribute("role", "button");
        row.innerHTML = `<div class="pin-meta"><span></span></div><div class="pin-ex"></div>`;
        row.querySelector(".pin-meta span").textContent = messageWho(item.msg) + " · " + fmtTime(item.msg.ts) + (item.parent ? " · thread" : "");
        row.querySelector(".pin-ex").textContent = messageExcerpt(item.msg);
        row.addEventListener("click", () => jumpToMessage(item.id));
        row.addEventListener("keydown", (e) => {
          if (e.key === "Enter" || e.key === " ") { e.preventDefault(); jumpToMessage(item.id); }
        });
        const unpin = document.createElement("button");
        unpin.type = "button";
        unpin.className = "unpin";
        unpin.textContent = "Unpin";
        unpin.addEventListener("click", (e) => {
          e.stopPropagation();
          togglePin(item.id);
        });
        row.querySelector(".pin-meta").appendChild(unpin);
        list.appendChild(row);
      }
    }
    function openPins() {
      if (state.view !== "channels") return;
      state.pinsOpen = !state.pinsOpen;
      updatePinsButton(active());
      renderPinsPanel();
    }
    function closeThread(opts) {
      state.openThreadId = null;
      if (!(opts && opts.keepHighlight)) state.highlightMsgId = null;
      const pane = $("threadPane");
      if (pane) pane.hidden = true;
      const split = $("chatSplit");
      if (split) split.classList.remove("with-thread");
    }
    function openThread(parentId, highlightId) {
      const c = active();
      if (!c || !parentId) return;
      const hit = findMessage(c, parentId);
      if (!hit) return;
      const parent = hit.parent || hit.msg;
      state.openThreadId = parent.id;
      if (highlightId) state.highlightMsgId = highlightId;
      state.pinsOpen = false;
      renderChat();
      const input = $("threadInput");
      if (input) input.focus();
    }
    function jumpToMessage(id) {
      const c = active();
      const hit = c && findMessage(c, id);
      if (!hit) return;
      closePins();
      if (hit.parent) {
        openThread(hit.parent.id, id);
        return;
      }
      state.highlightMsgId = id;
      if (state.view !== "channels") setView("channels");
      else renderChat();
    }
    function threadContextMessages(c, parent, pending) {
      const prior = [];
      for (const m of c.messages || []) {
        if (m === pending) continue;
        prior.push(m);
        if (m.id === parent.id) break;
      }
      const replies = (parent.replies || []).filter((m) => m !== pending);
      return prior.concat(replies);
    }
    function applyHighlight(root) {
      if (!state.highlightMsgId || !root) return false;
      const el = root.querySelector('[data-msg-id="' + CSS.escape(state.highlightMsgId) + '"]');
      if (!el) return false;
      el.classList.add("msg-flash");
      el.scrollIntoView({ block: "center", behavior: "smooth" });
      return true;
    }

    function normalizeDue(value) {
      if (value == null) return "";
      const s = String(value).trim();
      if (!s) return "";
      const m = s.match(/^(\d{4}-\d{2}-\d{2})/);
      return m ? m[1] : "";
    }
    function normalizeTask(raw, i) {
      if (!raw || typeof raw !== "object") return null;
      const title = String(raw.title || "").trim();
      if (!title && !raw.id) return null;
      const status = ["todo", "in-progress", "done"].includes(raw.status) ? raw.status : "todo";
      return {
        id: String(raw.id || crypto.randomUUID()),
        title: title || "Untitled task",
        notes: String(raw.notes || ""),
        due: normalizeDue(raw.due),
        status,
        priority: raw.priority === "high" ? "high" : "normal",
        createdAt: Number(raw.createdAt) || Date.now() + (i || 0),
        updatedAt: Number(raw.updatedAt) || Date.now() + (i || 0),
        completedAt: status === "done" ? (Number(raw.completedAt) || Date.now()) : null
      };
    }
    function normalizeNote(raw, i) {
      if (!raw || typeof raw !== "object") return null;
      const title = String(raw.title || "").trim();
      const body = String(raw.body || "");
      if (!title && !body && !raw.id) return null;
      return {
        id: String(raw.id || crypto.randomUUID()),
        title: title || "Untitled",
        body,
        pinned: !!raw.pinned,
        createdAt: Number(raw.createdAt) || Date.now() + (i || 0),
        updatedAt: Number(raw.updatedAt) || Date.now() + (i || 0)
      };
    }
    async function loadTasks() {
      let fromLs = [];
      try { fromLs = JSON.parse(localStorage.getItem(K.tasks) || "[]"); }
      catch { fromLs = []; }
      const fromIdb = await idbGet("tasks");
      state.tasks = preferRecordList(fromIdb, fromLs).map((t, i) => normalizeTask(t, i)).filter(Boolean);
    }
    async function loadNotes() {
      let fromLs = [];
      try { fromLs = JSON.parse(localStorage.getItem(K.notes) || "[]"); }
      catch { fromLs = []; }
      const fromIdb = await idbGet("notes");
      state.notes = preferRecordList(fromIdb, fromLs).map((n, i) => normalizeNote(n, i)).filter(Boolean);
    }
    function persistTasks() {
      try { localStorage.setItem(K.tasks, JSON.stringify(state.tasks)); } catch {}
      idbSet("tasks", state.tasks);
    }
    function persistNotes() {
      try { localStorage.setItem(K.notes, JSON.stringify(state.notes)); } catch {}
      idbSet("notes", state.notes);
    }
    async function loadLastView() {
      let v = null;
      try { v = JSON.parse(localStorage.getItem(K.view) || "null"); } catch {}
      const fromIdb = await idbGet("lastView");
      if (!v && fromIdb) v = fromIdb;
      if (typeof v === "string") v = { view: v };
      if (v && ["today", "tasks", "notes", "channels"].includes(v.view)) {
        state.view = v.view;
      } else {
        state.view = "today";
      }
    }
    function persistLastView() {
      const v = { view: state.view };
      try { localStorage.setItem(K.view, JSON.stringify(v)); } catch {}
      idbSet("lastView", v);
    }

    function isOpenTask(t) { return t && t.status !== "done"; }
    function taskMatchesFilter(t, filter) {
      const today = todayISO();
      switch (filter) {
        case "inbox": return isOpenTask(t) && !t.due;
        case "today": return isOpenTask(t) && t.due === today;
        case "upcoming": return isOpenTask(t) && t.due && t.due > today;
        case "overdue": return isOpenTask(t) && t.due && t.due < today;
        case "done": return t.status === "done";
        case "open": return isOpenTask(t);
        case "all": return true;
        default: return isOpenTask(t);
      }
    }
    function sortTasks(list) {
      return list.slice().sort((a, b) => {
        const ap = a.priority === "high" ? 0 : 1;
        const bp = b.priority === "high" ? 0 : 1;
        if (ap !== bp) return ap - bp;
        if (a.due && b.due && a.due !== b.due) return a.due < b.due ? -1 : 1;
        if (a.due && !b.due) return -1;
        if (!a.due && b.due) return 1;
        return (a.createdAt || 0) - (b.createdAt || 0);
      });
    }
    function publicTask(t) {
      return {
        id: t.id,
        title: t.title,
        notes: t.notes || "",
        due: t.due || null,
        status: t.status,
        priority: t.priority || "normal"
      };
    }
    function publicNote(n, excerptLen) {
      const body = n.body || "";
      const excerpt = excerptLen == null ? body : (body.length > excerptLen ? body.slice(0, excerptLen) + "\u2026" : body);
      return {
        id: n.id,
        title: n.title,
        body: excerptLen == null ? body : undefined,
        excerpt: excerptLen == null ? undefined : excerpt,
        pinned: !!n.pinned,
        updatedAt: n.updatedAt
      };
    }
    function createTaskRecord({ title, notes, due, priority, status }) {
      const t = normalizeTask({
        title,
        notes,
        due,
        priority,
        status: status || "todo",
        createdAt: Date.now(),
        updatedAt: Date.now()
      });
      if (!t) return { error: "A task title is required." };
      state.tasks.unshift(t);
      persistTasks();
      return { ok: true, task: publicTask(t) };
    }
    function findTask(id, title) {
      if (id) {
        const exact = state.tasks.find((t) => t.id === id);
        if (exact) return exact;
      }
      if (title && String(title).trim()) {
        const q = String(title).trim().toLowerCase();
        const open = state.tasks.filter(isOpenTask);
        const exact = open.filter((t) => t.title.toLowerCase() === q);
        if (exact.length === 1) return exact[0];
        if (exact.length > 1) return { ambiguous: exact };
        const partial = open.filter((t) => t.title.toLowerCase().includes(q));
        if (partial.length === 1) return partial[0];
        if (partial.length > 1) return { ambiguous: partial };
      }
      return null;
    }
    function updateTaskRecord(id, patch) {
      const t = state.tasks.find((x) => x.id === id);
      if (!t) return { error: "Task not found: " + id };
      if (patch.title != null) {
        const title = String(patch.title).trim();
        if (!title) return { error: "Title cannot be empty." };
        t.title = title;
      }
      if (patch.notes != null) t.notes = String(patch.notes);
      if (patch.due != null) t.due = normalizeDue(patch.due);
      if (patch.priority != null) t.priority = patch.priority === "high" ? "high" : "normal";
      if (patch.status != null) {
        if (!["todo", "in-progress", "done"].includes(patch.status)) return { error: "Invalid status." };
        t.status = patch.status;
        t.completedAt = t.status === "done" ? Date.now() : null;
      }
      t.updatedAt = Date.now();
      persistTasks();
      return { ok: true, task: publicTask(t) };
    }
    function completeTaskRecord(id, title) {
      const found = findTask(id, title);
      if (!found) return { error: "Task not found." };
      if (found.ambiguous) {
        return {
          error: "Multiple tasks matched that title. Use an id.",
          matches: found.ambiguous.map(publicTask)
        };
      }
      found.status = "done";
      found.completedAt = Date.now();
      found.updatedAt = Date.now();
      persistTasks();
      return { ok: true, task: publicTask(found) };
    }
    function deleteTaskRecord(id) {
      const next = state.tasks.filter((t) => t.id !== id);
      if (next.length === state.tasks.length) return false;
      state.tasks = next;
      if (state.editingTaskId === id) state.editingTaskId = null;
      persistTasks();
      return true;
    }
    function createNoteRecord({ title, body, pinned }) {
      const n = normalizeNote({
        title: title || "Untitled",
        body: body || "",
        pinned: !!pinned,
        createdAt: Date.now(),
        updatedAt: Date.now()
      });
      if (!n) return { error: "A note title or body is required." };
      state.notes.unshift(n);
      persistNotes();
      return { ok: true, note: publicNote(n) };
    }
    function updateNoteRecord(id, patch) {
      const n = state.notes.find((x) => x.id === id);
      if (!n) return { error: "Note not found: " + id };
      if (patch.title != null) n.title = String(patch.title).trim() || "Untitled";
      if (patch.body != null) n.body = String(patch.body);
      if (patch.pinned != null) n.pinned = !!patch.pinned;
      n.updatedAt = Date.now();
      persistNotes();
      return { ok: true, note: publicNote(n) };
    }
    function deleteNoteRecord(id) {
      const next = state.notes.filter((n) => n.id !== id);
      if (next.length === state.notes.length) return false;
      state.notes = next;
      if (state.activeNoteId === id) state.activeNoteId = null;
      persistNotes();
      return true;
    }
    function notesSorted() {
      return state.notes.slice().sort((a, b) => {
        if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
        return (b.updatedAt || 0) - (a.updatedAt || 0);
      });
    }

    function runWorkspaceTool(name, args) {
      args = args || {};
      try {
        if (name === "list_tasks") {
          const filter = args.filter || "open";
          const tasks = sortTasks(state.tasks.filter((t) => taskMatchesFilter(t, filter))).map(publicTask);
          return { ok: true, filter, count: tasks.length, tasks };
        }
        if (name === "create_task") return createTaskRecord(args);
        if (name === "update_task") {
          if (!args.id) return { error: "id is required." };
          return updateTaskRecord(args.id, args);
        }
        if (name === "complete_task") return completeTaskRecord(args.id, args.title);
        if (name === "list_notes") {
          const limit = Math.max(1, Math.min(100, Number(args.limit) || 20));
          const notes = notesSorted().slice(0, limit).map((n) => publicNote(n, 160));
          return { ok: true, count: notes.length, total: state.notes.length, notes };
        }
        if (name === "search_notes") {
          const q = String(args.query || "").trim().toLowerCase();
          if (!q) return { error: "query is required." };
          const notes = notesSorted().filter((n) =>
            (n.title || "").toLowerCase().includes(q) || (n.body || "").toLowerCase().includes(q)
          ).map((n) => publicNote(n, 200));
          return { ok: true, query: args.query, count: notes.length, notes };
        }
        if (name === "create_note") return createNoteRecord(args);
        if (name === "update_note") {
          if (!args.id) return { error: "id is required." };
          return updateNoteRecord(args.id, args);
        }
        return { error: "Unknown function: " + name };
      } catch (err) {
        return { error: String(err && err.message || err) };
      }
    }
    function toolSummary(name, args, result) {
      if (result && result.error) return "Tool error: " + result.error;
      if (name === "create_task") return "Created task: " + ((result.task && result.task.title) || args.title || "");
      if (name === "update_task") return "Updated task: " + ((result.task && result.task.title) || args.id || "");
      if (name === "complete_task") return "Completed task: " + ((result.task && result.task.title) || "");
      if (name === "list_tasks") return "Listed " + ((result.tasks && result.tasks.length) || 0) + " task(s)";
      if (name === "create_note") return "Created note: " + ((result.note && result.note.title) || args.title || "");
      if (name === "update_note") return "Updated note: " + ((result.note && result.note.title) || args.id || "");
      if (name === "list_notes") return "Listed " + ((result.notes && result.notes.length) || 0) + " note(s)";
      if (name === "search_notes") return "Found " + ((result.notes && result.notes.length) || 0) + " note(s)";
      return "Used " + name;
    }
    function overdueCount() {
      return state.tasks.filter((t) => taskMatchesFilter(t, "overdue")).length;
    }
    function updateBadges() {
      const el = $("todayBadge");
      if (el) el.textContent = overdueCount() ? String(overdueCount()) : "";
    }
    function refreshWorkspace() {
      updateBadges();
      if (state.view === "today") renderToday();
      else if (state.view === "tasks") renderTasks();
      else if (state.view === "notes") renderNotes({ listOnly: true });
    }

    function setView(view, opts) {
      if (!["today", "tasks", "notes", "channels"].includes(view)) view = "today";
      const prevId = state.activeId;
      state.view = view;
      if (opts && opts.channelId) {
        if (state.conversations.some((c) => c.id === opts.channelId)) state.activeId = opts.channelId;
        persistConvos();
      }
      if (state.activeId !== prevId) closeThread();
      if (view !== "channels") closePins();
      persistLastView();
      $("sidebar").classList.remove("open");
      $("viewToday").hidden = view !== "today";
      $("viewTasks").hidden = view !== "tasks";
      $("viewNotes").hidden = view !== "notes";
      $("viewChat").hidden = view !== "channels";
      updatePinsButton(view === "channels" ? active() : null);
      renderNav();
      renderChannels();
      if (view === "today") renderToday();
      else if (view === "tasks") renderTasks();
      else if (view === "notes") renderNotes();
      else renderChat();
    }
    function renderNav() {
      for (const id of ["navToday", "navTasks", "navNotes"]) {
        const btn = $(id);
        if (btn) btn.classList.toggle("active", btn.dataset.view === state.view);
      }
      updateBadges();
    }
    function setTopbar(title, subtitle) {
      $("title").innerHTML = title + (subtitle ? ` <span id="subtitle">${subtitle}</span>` : "");
    }

    function renderChannels() {
      const box = $("channels");
      box.innerHTML = "";
      for (const c of state.conversations) {
        const b = document.createElement("button");
        const isActive = state.view === "channels" && c.id === state.activeId;
        b.className = "channel" + (isActive ? " active" : "");
        b.innerHTML = `<span class="hash">#</span><span class="name"></span><span class="channel-actions"></span>`;
        b.querySelector(".name").textContent = c.name;
        const actions = b.querySelector(".channel-actions");
        const ren = document.createElement("button");
        ren.className = "tiny";
        ren.title = "Rename";
        ren.textContent = "\u270e";
        ren.addEventListener("click", (e) => {
          e.stopPropagation();
          const next = prompt("Channel name", c.name);
          if (next && next.trim()) {
            c.name = next.trim().replace(/\s+/g, "-").replace(/^#/, "");
            persistConvos();
            renderChannels();
            if (state.view === "channels") renderChat();
          }
        });
        const del = document.createElement("button");
        del.className = "tiny";
        del.title = "Delete";
        del.textContent = "\u2715";
        del.addEventListener("click", (e) => {
          e.stopPropagation();
          if (state.conversations.length === 1) {
            c.messages = [];
            c.name = "general";
          } else {
            state.conversations = state.conversations.filter((x) => x.id !== c.id);
            if (state.activeId === c.id) state.activeId = state.conversations[0].id;
          }
          persistConvos();
          renderChannels();
          if (state.view === "channels") renderChat();
        });
        actions.append(ren, del);
        b.addEventListener("click", () => {
          setView("channels", { channelId: c.id });
        });
        box.appendChild(b);
      }
    }

    function md(text) {
      const raw = marked.parse(text || "", { breaks: true, gfm: true });
      return DOMPurify.sanitize(raw);
    }
    function fmtTime(ts) {
      return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    }
    function shouldGroup(prev, cur) {
      return prev && cur && prev.role === cur.role && !prev.deleted && !cur.deleted && (cur.ts - prev.ts) < 5 * 60 * 1000;
    }

    function emptyBox(text) {
      const d = document.createElement("div");
      d.className = "muted-empty";
      d.textContent = text;
      return d;
    }
    function taskRowEl(t, opts) {
      const optsSafe = opts || {};
      const row = document.createElement("div");
      const today = todayISO();
      const overdue = isOpenTask(t) && t.due && t.due < today;
      row.className = "task-row" + (t.status === "done" ? " done" : "");
      const box = document.createElement("input");
      box.type = "checkbox";
      box.checked = t.status === "done";
      box.title = t.status === "done" ? "Mark as to-do" : "Mark done";
      box.addEventListener("change", () => {
        updateTaskRecord(t.id, { status: box.checked ? "done" : "todo" });
        refreshWorkspace();
      });
      const main = document.createElement("div");
      main.className = "task-main";
      if (state.editingTaskId === t.id && !optsSafe.readOnly) {
        const title = document.createElement("input");
        title.className = "edit-title";
        title.type = "text";
        title.value = t.title;
        const notes = document.createElement("textarea");
        notes.className = "edit-notes";
        notes.value = t.notes || "";
        notes.placeholder = "Notes (optional)";
        const meta = document.createElement("div");
        meta.className = "task-meta";
        const due = document.createElement("input");
        due.type = "date";
        due.value = t.due || "";
        const pri = document.createElement("select");
        pri.innerHTML = `<option value="normal">Normal</option><option value="high">High</option>`;
        pri.value = t.priority || "normal";
        const st = document.createElement("select");
        st.innerHTML = `<option value="todo">To-do</option><option value="in-progress">In progress</option><option value="done">Done</option>`;
        st.value = t.status;
        const save = document.createElement("button");
        save.className = "save";
        save.type = "button";
        save.textContent = "Save";
        save.addEventListener("click", () => {
          updateTaskRecord(t.id, { title: title.value, notes: notes.value, due: due.value, priority: pri.value, status: st.value });
          state.editingTaskId = null;
          refreshWorkspace();
        });
        const cancel = document.createElement("button");
        cancel.className = "ghost";
        cancel.type = "button";
        cancel.textContent = "Cancel";
        cancel.addEventListener("click", () => {
          state.editingTaskId = null;
          renderTasks();
        });
        meta.append(due, pri, st, save, cancel);
        main.append(title, notes, meta);
      } else {
        const title = document.createElement("div");
        title.className = "task-title";
        title.textContent = t.title;
        const meta = document.createElement("div");
        meta.className = "task-meta";
        if (t.priority === "high") {
          const p = document.createElement("span");
          p.className = "pri-high";
          p.textContent = "High";
          meta.appendChild(p);
        }
        if (t.status === "in-progress") {
          const p = document.createElement("span");
          p.textContent = "In progress";
          meta.appendChild(p);
        }
        if (t.due) {
          const p = document.createElement("span");
          p.className = overdue ? "due-overdue" : "";
          p.textContent = (overdue ? "Overdue \u00b7 " : "") + formatShortDate(t.due);
          meta.appendChild(p);
        }
        main.appendChild(title);
        if (meta.childNodes.length) main.appendChild(meta);
        if (t.notes) {
          const n = document.createElement("div");
          n.className = "task-notes";
          n.textContent = t.notes;
          main.appendChild(n);
        }
      }
      const actions = document.createElement("div");
      actions.className = "task-actions";
      if (!optsSafe.readOnly) {
        if (state.editingTaskId !== t.id) {
          const edit = document.createElement("button");
          edit.className = "tiny";
          edit.type = "button";
          edit.title = "Edit";
          edit.textContent = "\u270e";
          edit.addEventListener("click", () => {
            state.editingTaskId = t.id;
            renderTasks();
          });
          actions.appendChild(edit);
        }
        const del = document.createElement("button");
        del.className = "tiny";
        del.type = "button";
        del.title = "Delete";
        del.textContent = "\u2715";
        del.addEventListener("click", () => {
          if (confirm("Delete this task?")) {
            deleteTaskRecord(t.id);
            refreshWorkspace();
          }
        });
        actions.appendChild(del);
      }
      row.append(box, main, actions);
      return row;
    }

    function renderToday() {
      setTopbar("Today", "Asia/Hong_Kong");
      $("todayDate").innerHTML = escapeHtml(formatLongDate()) + "<small>Hong Kong time</small>";
      const overdue = sortTasks(state.tasks.filter((t) => taskMatchesFilter(t, "overdue")));
      const dueToday = sortTasks(state.tasks.filter((t) => taskMatchesFilter(t, "today")));
      const overdueBox = $("todayOverdue");
      overdueBox.innerHTML = "";
      if (!overdue.length) overdueBox.appendChild(emptyBox("Nothing overdue."));
      else overdue.forEach((t) => overdueBox.appendChild(taskRowEl(t)));
      const dueBox = $("todayDue");
      dueBox.innerHTML = "";
      if (!dueToday.length) dueBox.appendChild(emptyBox("No tasks due today. Add one above."));
      else dueToday.forEach((t) => dueBox.appendChild(taskRowEl(t)));
      const notesBox = $("todayNotes");
      notesBox.innerHTML = "";
      const recent = notesSorted().slice(0, 5);
      if (!recent.length) notesBox.appendChild(emptyBox("No notes yet."));
      else {
        recent.forEach((n) => {
          const card = document.createElement("button");
          card.className = "note-card";
          card.type = "button";
          card.style.width = "100%";
          card.style.textAlign = "left";
          const t = document.createElement("div");
          t.className = "task-title";
          t.textContent = (n.pinned ? "\ud83d\udccc " : "") + (n.title || "Untitled");
          const s = document.createElement("div");
          s.className = "task-notes";
          s.textContent = (n.body || "").replace(/\s+/g, " ").slice(0, 140) || "Empty note";
          card.append(t, s);
          card.addEventListener("click", () => {
            state.activeNoteId = n.id;
            setView("notes");
          });
          notesBox.appendChild(card);
        });
      }
    }

    function renderTasks() {
      const filters = [
        ["inbox", "Inbox"],
        ["today", "Today"],
        ["upcoming", "Upcoming"],
        ["overdue", "Overdue"],
        ["done", "Done"]
      ];
      const bar = $("taskFilters");
      bar.innerHTML = "";
      for (const [id, label] of filters) {
        const b = document.createElement("button");
        b.type = "button";
        b.className = state.taskFilter === id ? "active" : "";
        const count = state.tasks.filter((t) => taskMatchesFilter(t, id)).length;
        b.textContent = label;
        const pill = document.createElement("span");
        pill.className = "count-pill";
        pill.textContent = String(count);
        b.appendChild(pill);
        b.addEventListener("click", () => {
          state.taskFilter = id;
          state.editingTaskId = null;
          renderTasks();
        });
        bar.appendChild(b);
      }
      const label = filters.find((f) => f[0] === state.taskFilter);
      setTopbar("Tasks", label ? label[1] : "");
      const list = $("taskList");
      list.innerHTML = "";
      const items = sortTasks(state.tasks.filter((t) => taskMatchesFilter(t, state.taskFilter)));
      if (!items.length) list.appendChild(emptyBox("No tasks in this list."));
      else items.forEach((t) => list.appendChild(taskRowEl(t)));
    }
    function renderNoteList() {
      const box = $("noteList");
      if (!box) return;
      box.innerHTML = "";
      const q = (state.noteQuery || "").trim().toLowerCase();
      const items = notesSorted().filter((n) => {
        if (!q) return true;
        return (n.title || "").toLowerCase().includes(q) || (n.body || "").toLowerCase().includes(q);
      });
      if (!items.length) {
        box.appendChild(emptyBox(q ? "No matching notes." : "No notes yet."));
        return;
      }
      for (const n of items) {
        const b = document.createElement("button");
        b.className = "note-item" + (n.id === state.activeNoteId ? " active" : "");
        b.type = "button";
        const t = document.createElement("div");
        t.className = "nt";
        if (n.pinned) {
          const pin = document.createElement("span");
          pin.className = "pin";
          pin.textContent = "\ud83d\udccc";
          t.appendChild(pin);
        }
        const name = document.createElement("span");
        name.textContent = n.title || "Untitled";
        t.appendChild(name);
        const s = document.createElement("div");
        s.className = "ns";
        s.textContent = (n.body || "").replace(/\s+/g, " ").slice(0, 80) || "Empty note";
        b.append(t, s);
        b.addEventListener("click", () => {
          state.activeNoteId = n.id;
          state.notePreview = false;
          $("notesLayout").classList.add("editing");
          renderNotes();
        });
        box.appendChild(b);
      }
    }
    function renderNoteEditor() {
      const host = $("noteEditor");
      const n = state.notes.find((x) => x.id === state.activeNoteId);
      if (!n) {
        host.className = "note-editor empty-ed";
        host.innerHTML = "<p>Select a note or create a new one.</p>";
        $("notesLayout").classList.remove("editing");
        return;
      }
      host.className = "note-editor";
      host.innerHTML = "";
      const bar = document.createElement("div");
      bar.className = "note-toolbar";
      const back = document.createElement("button");
      back.className = "icon-btn note-back";
      back.type = "button";
      back.title = "Back to notes";
      back.textContent = "\u2190";
      back.addEventListener("click", () => {
        $("notesLayout").classList.remove("editing");
      });
      const title = document.createElement("input");
      title.id = "noteTitle";
      title.type = "text";
      title.value = n.title;
      title.placeholder = "Note title";
      const pin = document.createElement("button");
      pin.className = "ghost";
      pin.type = "button";
      pin.textContent = n.pinned ? "Unpin" : "Pin";
      pin.addEventListener("click", () => {
        updateNoteRecord(n.id, { pinned: !n.pinned });
        renderNotes();
      });
      const prev = document.createElement("button");
      prev.className = "ghost";
      prev.type = "button";
      prev.textContent = state.notePreview ? "Edit" : "Preview";
      prev.addEventListener("click", () => {
        const titleEl = $("noteTitle");
        const bodyEl = $("noteBody");
        if (titleEl && bodyEl && !state.notePreview) {
          updateNoteRecord(n.id, { title: titleEl.value, body: bodyEl.value });
        }
        state.notePreview = !state.notePreview;
        renderNotes();
      });
      const del = document.createElement("button");
      del.className = "ghost";
      del.type = "button";
      del.textContent = "Delete";
      del.addEventListener("click", () => {
        if (!confirm("Delete this note?")) return;
        deleteNoteRecord(n.id);
        $("notesLayout").classList.remove("editing");
        renderNotes();
        refreshWorkspace();
      });
      bar.append(back, title, pin, prev, del);
      const wrap = document.createElement("div");
      wrap.className = "note-body-wrap";
      if (state.notePreview) {
        const preview = document.createElement("div");
        preview.className = "note-preview bubble";
        preview.innerHTML = n.body ? md(n.body) : "<p class='muted-empty'>Nothing to preview.</p>";
        wrap.appendChild(preview);
      } else {
        const body = document.createElement("textarea");
        body.id = "noteBody";
        body.value = n.body || "";
        body.placeholder = "Write in Markdown\u2026";
        wrap.appendChild(body);
      }
      host.append(bar, wrap);
      const scheduleSave = () => {
        clearTimeout(noteSaveTimer);
        noteSaveTimer = setTimeout(() => {
          const titleEl = $("noteTitle");
          const bodyEl = $("noteBody");
          if (!titleEl) return;
          updateNoteRecord(n.id, { title: titleEl.value, body: bodyEl ? bodyEl.value : n.body });
          renderNoteList();
        }, 300);
      };
      title.addEventListener("input", scheduleSave);
      const bodyEl = $("noteBody");
      if (bodyEl) bodyEl.addEventListener("input", scheduleSave);
    }
    function renderNotes(opts) {
      setTopbar("Notes", state.notes.length ? state.notes.length + " saved" : "AskNelson");
      renderNoteList();
      if (!(opts && opts.listOnly)) renderNoteEditor();
    }

    function messageEl(m, prev, opts) {
      const options = opts || {};
      const c = active();
      if (m && !m.id) m.id = crypto.randomUUID();
      const grouped = shouldGroup(prev, m);
      const el = document.createElement("article");
      const pinned = c && isPinned(c, m.id);
      el.className = "msg" + (grouped ? " grouped" : "") + (pinned ? " is-pinned" : "") + (m.deleted ? " is-deleted" : "");
      el.dataset.msgId = m.id;
      const who = messageWho(m);
      const avClass = m.role === "user" ? "you" : m.role === "assistant" ? "grok" : "error";
      const bodyClass = m.deleted ? "bubble" : (m.role === "error" ? "bubble err" : (m.pending ? "bubble pending" : "bubble"));
      const pendingLabel = m.upload
        ? (m.upload === "image" ? "Preparing image\u2026" : "Uploading attachment\u2026")
        : (m.toolRunning ? "Updating your workspace\u2026" : (m.searching ? "Searching live sources\u2026" : "AskNelson is thinking\u2026"));
      const filesHtml = (!m.deleted && m.attachments && m.attachments.length)
        ? `<div class="msg-files">${m.attachments.map(attachmentHtml).join("")}</div>`
        : "";
      const sources = (!m.deleted && Array.isArray(m.sources)) ? m.sources.filter(Boolean) : [];
      const sourcesHtml = sources.length
        ? `<div class="msg-sources"><strong>Sources</strong><ol>${sources.map((u) =>
            `<li><a href="${escapeHtml(u)}" target="_blank" rel="noopener noreferrer">${escapeHtml(u)}</a></li>`
          ).join("")}</ol></div>`
        : "";
      const toolsHtml = (!m.deleted && m.toolLog && m.toolLog.length)
        ? `<div class="msg-tools">${m.toolLog.map((line) => `<div>${escapeHtml(line)}</div>`).join("")}</div>`
        : "";
      const pinLabel = pinned ? "Unpin" : "Pin";
      const canAct = !m.deleted;
      const replyBtn = (canAct && !options.inThread) ? `<button type="button" class="tiny" data-action="reply" data-id="${escapeHtml(m.id)}">Reply</button>` : "";
      const removeBtn = (canAct && !m.pending) ? `<button type="button" class="tiny danger" data-action="remove" data-id="${escapeHtml(m.id)}">Remove</button>` : "";
      const replies = m.replies || [];
      const replyCount = (!options.inThread && replies.length)
        ? `<button type="button" class="thread-count" data-action="open-thread" data-id="${escapeHtml(m.id)}"><span class="thread-n">${replies.length} ${replies.length === 1 ? "reply" : "replies"}</span><span class="thread-last">${escapeHtml(fmtTime(replies[replies.length - 1].ts))}</span></button>`
        : "";
      const pinFlag = pinned ? `<span class="pin-flag" title="Pinned">📌</span>` : "";
      const actions = canAct
        ? `<div class="msg-actions">
              <button type="button" class="tiny" data-action="pin" data-id="${escapeHtml(m.id)}">${pinLabel}</button>
              ${replyBtn}
              ${removeBtn}
            </div>`
        : "";
      const bodyHtml = m.deleted ? escapeHtml(REMOVED_PLACEHOLDER) : (m.pending && !m.content ? pendingLabel : md(m.content));
      el.innerHTML = `
          <div>${grouped ? "" : `<div class="avatar ${avClass}">${escapeHtml(who[0])}</div>`}</div>
          <div>
            ${grouped ? (pinned ? `<div class="meta">${pinFlag}</div>` : "") : `<div class="meta"><span class="who">${escapeHtml(who)}</span><span class="when">${escapeHtml(fmtTime(m.ts))}</span>${pinFlag}</div>`}
            <div class="${bodyClass}">${bodyHtml}</div>
            ${toolsHtml}
            ${filesHtml}
            ${sourcesHtml}
            ${replyCount}
            ${actions}
          </div>`;
      return el;
    }
    function renderThreadPane() {
      const pane = $("threadPane");
      const box = $("threadMessages");
      const split = $("chatSplit");
      const sub = $("threadSub");
      const c = active();
      if (!pane || !box) return;
      if (state.view !== "channels" || !c || !state.openThreadId) {
        pane.hidden = true;
        if (split) split.classList.remove("with-thread");
        return;
      }
      const hit = findMessage(c, state.openThreadId);
      const parent = hit ? (hit.parent || hit.msg) : null;
      if (!parent) {
        closeThread();
        return;
      }
      if (state.openThreadId !== parent.id) state.openThreadId = parent.id;
      pane.hidden = false;
      if (split) split.classList.add("with-thread");
      if (sub) sub.textContent = messageWho(parent) + " \u00b7 " + messageExcerpt(parent, 48);
      box.innerHTML = "";
      box.appendChild(messageEl(parent, null, { inThread: true, isParent: true }));
      const replies = parent.replies || [];
      const div = document.createElement("div");
      div.className = "thread-divider";
      div.textContent = replies.length ? (replies.length + (replies.length === 1 ? " reply" : " replies")) : "Replies";
      box.appendChild(div);
      replies.forEach((m, i) => box.appendChild(messageEl(m, replies[i - 1], { inThread: true })));
      if (!applyHighlight(box)) box.scrollTop = box.scrollHeight;
    }
    function renderChat() {
      const c = active();
      if (!c) return;
      setTopbar("# " + escapeHtml(c.name), escapeHtml(loadSettings().model));
      updatePinsButton(c);
      const box = $("messages");
      box.innerHTML = "";
      if (!getKey() && !c.messages.length) {
        box.innerHTML = `<div class="empty">
          <h3>Welcome to AskNelson</h3>
          <p>This is a personal productivity workspace powered by xAI Grok. Open Settings, paste an API key from <a href="https://console.x.ai" target="_blank" rel="noopener">console.x.ai</a>, then send a message \u2014 or add a task from Today.</p>
          <p>AskNelson can manage your tasks and notes from chat. Live web and X search are on by default. Your key, rooms, tasks, and notes stay in this browser. The key is never stored in the GitHub repo.</p>
        </div>`;
        renderThreadPane();
        renderPinsPanel();
        return;
      }
      if (!c.messages.length) {
        box.innerHTML = `<div class="empty"><h3>#${escapeHtml(c.name)}</h3><p>This channel is empty. Say hello, or ask AskNelson to add a task or a note.</p></div>`;
        renderThreadPane();
        renderPinsPanel();
        return;
      }
      c.messages.forEach((m, i) => box.appendChild(messageEl(m, c.messages[i - 1], {})));
      const jumped = applyHighlight(box);
      if (!jumped) box.scrollTop = box.scrollHeight;
      renderThreadPane();
      renderPinsPanel();
      if (state.highlightMsgId) {
        const hid = state.highlightMsgId;
        setTimeout(() => {
          if (state.highlightMsgId === hid) state.highlightMsgId = null;
        }, 1800);
      }
    }
    function escapeHtml(s) {
      return String(s).replace(/[&<>"']/g, (ch) => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
      }[ch]));
    }
    function attachmentHtml(f) {
      if (f && f.kind === "image" && f.dataUrl) {
        return `<a class="msg-thumb-link" href="${escapeHtml(f.dataUrl)}" target="_blank" rel="noopener"><img class="msg-thumb" src="${escapeHtml(f.dataUrl)}" alt="${escapeHtml(f.filename || "image")}"></a>`;
      }
      return `<span class="file-chip" title="${escapeHtml((f && f.filename) || "")}"><span class="fn">${escapeHtml((f && f.filename) || "document")}</span></span>`;
    }
    function defaultAttachmentPrompt(attachments) {
      const list = attachments || [];
      const images = list.filter((a) => a.kind === "image").length;
      const docs = list.length - images;
      if (images && docs) return "Please review the attached images and documents.";
      if (images > 1) return "What's in these images?";
      if (images === 1) return "What's in this image?";
      if (docs > 1) return "Please review the attached documents.";
      return "Please review the attached document.";
    }
    function hasImageAttachments(messages, pending) {
      return (messages || []).some((m) => m !== pending && (m.attachments || []).some((a) => a && a.kind === "image" && a.dataUrl));
    }

    function fillModels() {
      const sel = $("modelSelect");
      const cur = loadSettings().model;
      sel.innerHTML = MODELS.map((m) =>
        `<option value="${m.id}" ${m.id === cur ? "selected" : ""}>${m.label}</option>`
      ).join("");
    }

    function openSettings() {
      const s = loadSettings();
      $("apiKey").value = getKey();
      $("baseUrl").value = s.baseUrl;
      $("sysPrompt").value = s.systemPrompt;
      $("liveWeb").checked = s.liveWeb !== false;
      $("liveX").checked = s.liveX !== false;
      $("settingsStatus").className = "status";
      $("modal").classList.add("open");
      $("apiKey").focus();
    }
    function closeSettings() { $("modal").classList.remove("open"); }
    function buildBackup() {
      const settings = loadSettings();
      return {
        app: "asknelson",
        version: 2,
        exportedAt: new Date().toISOString(),
        tasks: state.tasks,
        notes: state.notes,
        conversations: state.conversations,
        settings,
        activeId: state.activeId,
        lastView: state.view
      };
    }
    function exportBackup() {
      const data = buildBackup();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const a = document.createElement("a");
      const day = todayISO();
      a.href = URL.createObjectURL(blob);
      a.download = "asknelson-backup-" + day + ".json";
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        URL.revokeObjectURL(a.href);
        a.remove();
      }, 1000);
      $("settingsStatus").textContent = "Backup downloaded. It includes tasks, notes, conversations, and settings, but not your API key.";
      $("settingsStatus").className = "status ok";
    }
    function parseBackup(raw) {
      let data;
      try { data = JSON.parse(raw); }
      catch { throw new Error("That file is not valid JSON."); }
      if (!data || typeof data !== "object" || Array.isArray(data)) {
        throw new Error("That file is not an AskNelson backup.");
      }
      const tasks = Array.isArray(data.tasks) ? data.tasks.map(normalizeTask).filter(Boolean) : [];
      const notes = Array.isArray(data.notes) ? data.notes.map(normalizeNote).filter(Boolean) : [];
      const conversations = Array.isArray(data.conversations) ? data.conversations.filter((c) => c && typeof c === "object") : [];
      if (!tasks.length && !notes.length && !conversations.length && !data.settings) {
        throw new Error("That file has no tasks, notes, conversations, or settings to import.");
      }
      function parseImportedMessage(m) {
        if (!m || !m.role) return null;
        const deleted = !!m.deleted;
        return {
          id: String(m.id || crypto.randomUUID()),
          role: m.role,
          content: deleted ? REMOVED_PLACEHOLDER : String(m.content || ""),
          ts: Number(m.ts) || Date.now(),
          attachments: deleted ? [] : (Array.isArray(m.attachments) ? m.attachments : []),
          sources: deleted ? undefined : (Array.isArray(m.sources) ? m.sources.filter((u) => typeof u === "string") : undefined),
          toolLog: deleted ? undefined : (Array.isArray(m.toolLog) ? m.toolLog.map(String) : undefined),
          deleted: deleted || undefined,
          replies: Array.isArray(m.replies) ? m.replies.map(parseImportedMessage).filter(Boolean) : []
        };
      }
      const cleanConvos = conversations.map((c, i) => ensureConvoShape({
        id: String(c.id || crypto.randomUUID()),
        name: String(c.name || ("chat-" + (i + 1))).replace(/\s+/g, "-").replace(/^#/, "") || "chat",
        createdAt: Number(c.createdAt) || Date.now(),
        pinnedIds: Array.isArray(c.pinnedIds) ? c.pinnedIds.filter((id) => typeof id === "string") : [],
        messages: Array.isArray(c.messages) ? c.messages.map(parseImportedMessage).filter(Boolean) : []
      }));
      return {
        tasks,
        notes,
        conversations: cleanConvos,
        settings: (data.settings && typeof data.settings === "object") ? data.settings : null,
        activeId: data.activeId || null
      };
    }
    function lastMsgTs(c) {
      let last = Number(c && c.createdAt) || 0;
      walkMessages((c && c.messages) || [], (x) => {
        if (Number(x.ts) > last) last = Number(x.ts) || 0;
      });
      return last;
    }
    function mergeById(existing, incoming, pick) {
      const map = new Map();
      for (const item of existing) map.set(item.id, item);
      for (const item of incoming) {
        if (!map.has(item.id)) map.set(item.id, item);
        else map.set(item.id, pick(map.get(item.id), item));
      }
      return [...map.values()];
    }
    function applyImport(parsed, mode) {
      if (mode === "replace") {
        state.tasks = parsed.tasks.slice();
        state.notes = parsed.notes.slice();
        if (parsed.conversations.length) {
          state.conversations = parsed.conversations.slice();
          state.activeId = parsed.activeId && state.conversations.some((c) => c.id === parsed.activeId)
            ? parsed.activeId
            : state.conversations[0].id;
        } else if (!state.conversations.length) {
          const first = makeConvo("general");
          state.conversations = [first];
          state.activeId = first.id;
        }
      } else {
        state.tasks = mergeById(state.tasks, parsed.tasks, (a, b) => (b.updatedAt || 0) >= (a.updatedAt || 0) ? b : a);
        state.notes = mergeById(state.notes, parsed.notes, (a, b) => (b.updatedAt || 0) >= (a.updatedAt || 0) ? b : a);
        if (parsed.conversations.length) {
          state.conversations = mergeById(state.conversations, parsed.conversations, (a, b) => lastMsgTs(b) >= lastMsgTs(a) ? b : a);
          if (!state.conversations.some((c) => c.id === state.activeId)) {
            state.activeId = state.conversations[0].id;
          }
        }
      }
      if (parsed.settings) {
        const cur = loadSettings();
        const incoming = parsed.settings;
        saveSettingsObj({
          model: incoming.model || cur.model,
          baseUrl: incoming.baseUrl || cur.baseUrl,
          systemPrompt: (!incoming.systemPrompt || incoming.systemPrompt === OLD_DEFAULT_PROMPT)
            ? cur.systemPrompt
            : incoming.systemPrompt,
          liveWeb: incoming.liveWeb !== false,
          liveX: incoming.liveX !== false
        });
        fillModels();
      }
      persistTasks();
      persistNotes();
      persistConvos();
      state.editingTaskId = null;
      if (state.activeNoteId && !state.notes.some((n) => n.id === state.activeNoteId)) state.activeNoteId = null;
      setView(state.view);
    }

    function apiBases(s) {
      const bases = [];
      const add = (u) => {
        if (!u) return;
        const n = String(u).replace(/\/$/, "");
        if (n && !bases.includes(n)) bases.push(n);
      };
      const saved = s && s.baseUrl;
      if (saved && saved !== DEFAULT_BASE) add(saved);
      add(PROXY_BASE);
      add(DEFAULT_BASE);
      return bases;
    }
    function isCorsFailure(err) {
      const msg = String(err && (err.message || err) || "");
      return err && (err.name === "TypeError" || /Failed to fetch|NetworkError|CORS|Load failed/i.test(msg));
    }
    async function apiPostJson(path, payload, s, signal, accept) {
      const body = JSON.stringify(payload);
      const headers = {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + getKey()
      };
      if (accept) headers.Accept = accept;
      const bases = apiBases(s);
      const rel = path.startsWith("/") ? path : "/" + path;
      let lastErr = null;
      for (let i = 0; i < bases.length; i++) {
        try {
          const res = await fetch(bases[i] + rel, {
            method: "POST",
            headers,
            body,
            signal
          });
          return res;
        } catch (err) {
          if (err && err.name === "AbortError") throw err;
          lastErr = err;
          if (!isCorsFailure(err) || i === bases.length - 1) throw err;
        }
      }
      throw lastErr || new Error("Request failed");
    }
    async function uploadFile(file, s, signal) {
      const bases = apiBases(s);
      let lastErr = null;
      for (let i = 0; i < bases.length; i++) {
        const form = new FormData();
        form.append("expires_after", "604800");
        form.append("purpose", "assistants");
        form.append("file", file, file.name);
        try {
          const res = await fetch(bases[i] + "/files", {
            method: "POST",
            headers: {
              Authorization: "Bearer " + getKey(),
              Accept: "application/json"
            },
            body: form,
            signal
          });
          if (!res.ok) {
            let detail = await res.text();
            try { detail = JSON.parse(detail).error || detail; } catch {}
            if (typeof detail === "object") detail = detail.message || JSON.stringify(detail);
            throw new Error((file.name + ": " + res.status + " " + (detail || res.statusText)).trim());
          }
          const meta = await res.json();
          if (!meta || !meta.id) throw new Error(file.name + ": upload did not return a file id.");
          return meta;
        } catch (err) {
          if (err && err.name === "AbortError") throw err;
          lastErr = err;
          if (!isCorsFailure(err) || i === bases.length - 1) throw err;
        }
      }
      throw lastErr || new Error("Upload failed");
    }
    function textFromCompleted(json) {
      const output = (json && json.response && json.response.output) || (json && json.output) || [];
      let t = "";
      for (const item of output) {
        for (const part of item.content || []) {
          if ((part.type === "output_text" || part.type === "text") && part.text) t += part.text;
        }
      }
      return t;
    }
    function toResponsesInput(messages, pending) {
      const input = [];
      for (const m of messages) {
        if (m === pending) continue;
        if (m.deleted) {
          input.push({ role: m.role === "assistant" ? "assistant" : "user", content: REMOVED_PLACEHOLDER });
          continue;
        }
        if (m.role === "user") {
          const parts = [];
          if (m.content) parts.push({ type: "input_text", text: m.content });
          for (const f of m.attachments || []) {
            if (f.kind === "image" && f.dataUrl) {
              parts.push({ type: "input_image", image_url: f.dataUrl, detail: "high" });
            } else if (f.id) {
              parts.push({ type: "input_file", file_id: f.id });
            }
          }
          if (!parts.length) continue;
          input.push({ role: "user", content: parts });
        } else if (m.role === "assistant" && m.content) {
          input.push({ role: "assistant", content: m.content });
        }
      }
      return input;
    }
    function liveTools(s) {
      const tools = [];
      if (s.liveWeb !== false) tools.push({ type: "web_search" });
      if (s.liveX !== false) tools.push({ type: "x_search" });
      return tools;
    }
    function addSource(pending, url) {
      if (!url || typeof url !== "string") return;
      if (!pending.sources) pending.sources = [];
      if (!pending.sources.includes(url)) pending.sources.push(url);
    }
    function collectSourcesFromEvent(pending, json) {
      if (!json || typeof json !== "object") return;
      if (Array.isArray(json.citations)) {
        for (const c of json.citations) {
          if (typeof c === "string") addSource(pending, c);
          else if (c && typeof c.url === "string") addSource(pending, c.url);
        }
      }
      const resp = json.response;
      if (resp && Array.isArray(resp.citations)) {
        for (const c of resp.citations) {
          if (typeof c === "string") addSource(pending, c);
          else if (c && typeof c.url === "string") addSource(pending, c.url);
        }
      }
      if (json.annotation && json.annotation.url) addSource(pending, json.annotation.url);
      if (json.item && json.item.action && json.item.action.url) addSource(pending, json.item.action.url);
      if (json.action && json.action.url) addSource(pending, json.action.url);
      if (Array.isArray(json.item && json.item.action && json.item.action.sources)) {
        for (const src of json.item.action.sources) {
          if (typeof src === "string") addSource(pending, src);
          else if (src && src.url) addSource(pending, src.url);
        }
      }
    }
    function isSearchEvent(type) {
      return /web_search_call|x_search_call|file_search_call|searching|in_progress/.test(type || "");
    }
    async function streamResponsesOnce(payload, s, signal, pending) {
      const res = await apiPostJson("/responses", payload, s, signal, "text/event-stream");
      if (!res.ok) {
        let detail = await res.text();
        try { detail = JSON.parse(detail).error || detail; } catch {}
        if (typeof detail === "object") detail = detail.message || JSON.stringify(detail);
        throw new Error(res.status + " " + (detail || res.statusText));
      }
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      let completed = null;
      const functionCalls = new Map();
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const parts = buf.split("\n");
        buf = parts.pop();
        for (const line of parts) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data:")) continue;
          const data = trimmed.slice(5).trim();
          if (data === "[DONE]") continue;
          let json;
          try { json = JSON.parse(data); } catch { continue; }
          const type = json.type || "";
          collectSourcesFromEvent(pending, json);
          if (type === "response.output_text.delta" && json.delta) {
            pending.content += json.delta;
            pending.searching = false;
            pending.pending = false;
            pending.toolRunning = false;
            persistConvos();
            if (state.view === "channels") renderChat();
          } else if (isSearchEvent(type) && !pending.content) {
            pending.searching = true;
            if (state.view === "channels") renderChat();
          } else if (type === "response.failed" || type === "error") {
            const msg = json.message || (json.error && json.error.message) || json.error || "Response failed";
            throw new Error(typeof msg === "string" ? msg : JSON.stringify(msg));
          } else if (type === "response.output_item.added" || type === "response.output_item.done") {
            const item = json.item;
            if (item && item.type === "function_call" && item.call_id) {
              functionCalls.set(item.call_id, item);
              if (!pending.content) {
                pending.toolRunning = true;
                pending.searching = false;
                if (state.view === "channels") renderChat();
              }
            }
          } else if (type === "response.completed" || type === "response.incomplete") {
            completed = json.response || json;
            if (!pending.content) {
              const textOut = json.text || textFromCompleted(completed) || textFromCompleted(json);
              if (textOut) pending.content = textOut;
            }
            collectSourcesFromEvent(pending, json);
            collectSourcesFromEvent(pending, completed);
            pending.searching = false;
            pending.pending = false;
            persistConvos();
            if (state.view === "channels") renderChat();
          }
        }
      }
      const output = (completed && completed.output) || [];
      for (const item of output) {
        if (item && item.type === "function_call" && item.call_id) {
          functionCalls.set(item.call_id, item);
        }
      }
      return { response: completed, functionCalls: [...functionCalls.values()] };
    }

    async function sendMessage(presetText, opts) {
      if (state.sending) return;
      const options = opts || {};
      const threadParentId = options.threadParentId || null;
      const which = threadParentId ? "thread" : "main";
      const inputEl = $(which === "thread" ? "threadInput" : "input");
      const fromPreset = presetText != null;
      const text = (fromPreset ? String(presetText) : (inputEl ? inputEl.value : "")).trim();
      const pendingKeyName = pendingKey(which);
      const toUpload = fromPreset ? [] : (state[pendingKeyName] || []).slice();
      if (!text && !toUpload.length) return;
      if (!getKey()) {
        openSettings();
        $("settingsStatus").textContent = "Add an xAI API key before chatting.";
        $("settingsStatus").className = "status bad";
        return;
      }
      if (!active()) {
        const first = makeConvo("general");
        state.conversations = [first];
        state.activeId = first.id;
        persistConvos();
      }
      const c = active();
      let threadParent = null;
      if (threadParentId) {
        const hit = findMessage(c, threadParentId);
        threadParent = hit ? (hit.parent || hit.msg) : null;
        if (!threadParent) return;
        if (!Array.isArray(threadParent.replies)) threadParent.replies = [];
      }
      const targetList = threadParent ? threadParent.replies : c.messages;
      const userMsg = makeMessage({ role: "user", content: text, ts: Date.now(), attachments: [] });
      targetList.push(userMsg);
      const pending = makeMessage({
        role: "assistant",
        content: "",
        ts: Date.now(),
        pending: true,
        upload: toUpload.length
          ? (toUpload.every((item) => isImageFile(item.file)) ? "image" : "file")
          : false,
        toolLog: []
      });
      targetList.push(pending);
      if (!fromPreset) {
        if (inputEl) inputEl.value = "";
        (state[pendingKeyName] || []).forEach(revokePreview);
        state[pendingKeyName] = [];
        autosize(inputEl);
        renderAttachList(which);
        showComposerStatus("", which);
      }
      persistConvos();
      if (threadParent && state.openThreadId !== threadParent.id) state.openThreadId = threadParent.id;
      if (state.view !== "channels") setView("channels");
      else renderChat();
      setSendingUi(true);
      const s = loadSettings();
      const ctrl = new AbortController();
      state.abort = ctrl;
      try {
        if (toUpload.length) {
          for (const item of toUpload) {
            if (isImageFile(item.file)) {
              const dataUrl = await imageToDataUrl(item.file);
              userMsg.attachments.push({
                kind: "image",
                filename: item.file.name,
                bytes: item.file.size,
                mime: item.file.type || "",
                dataUrl
              });
            } else {
              const meta = await uploadFile(item.file, s, ctrl.signal);
              userMsg.attachments.push({
                kind: "file",
                id: meta.id,
                filename: meta.filename || item.file.name,
                bytes: meta.bytes || item.file.size
              });
            }
            persistConvos();
            renderChat();
          }
          pending.upload = false;
          if (!userMsg.content) userMsg.content = defaultAttachmentPrompt(userMsg.attachments);
          persistConvos();
          renderChat();
        }
        const tools = liveTools(s).concat(WORKSPACE_TOOLS);
        const contextMessages = threadParent
          ? threadContextMessages(c, threadParent, pending)
          : c.messages;
        const hasImages = hasImageAttachments(contextMessages, pending);
        let input = toResponsesInput(contextMessages, pending);
        let previousId = null;
        for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
          const payload = {
            model: s.model || "grok-4.7",
            instructions: requestInstructions(s, threadParent),
            input,
            stream: true,
            tools
          };
          if (c.id) payload.prompt_cache_key = threadParent ? (c.id + ":t:" + threadParent.id) : c.id;
          if (hasImages || !previousId) {
            if (hasImages) {
              payload.store = false;
              payload.include = ["reasoning.encrypted_content"];
            }
          } else {
            payload.previous_response_id = previousId;
          }
          const { response, functionCalls } = await streamResponsesOnce(payload, s, ctrl.signal, pending);
          if (response && response.id) previousId = response.id;
          if (!functionCalls.length) break;
          if (!pending.toolLog) pending.toolLog = [];
          pending.toolRunning = true;
          pending.searching = false;
          if (!pending.content) pending.pending = true;
          renderChat();
          const outputs = [];
          for (const call of functionCalls) {
            let args = {};
            try { args = call.arguments ? JSON.parse(call.arguments) : {}; }
            catch { args = {}; }
            const result = runWorkspaceTool(call.name, args);
            pending.toolLog.push(toolSummary(call.name, args, result));
            outputs.push({
              type: "function_call_output",
              call_id: call.call_id,
              output: JSON.stringify(result)
            });
            persistConvos();
            renderChat();
            refreshWorkspace();
          }
          pending.toolRunning = false;
          const outputItems = (response && Array.isArray(response.output) && response.output.length)
            ? response.output
            : functionCalls;
          if (hasImages || !previousId) {
            input = input.concat(outputItems).concat(outputs);
            previousId = null;
          } else {
            input = outputs;
          }
        }
        if (!pending.content) pending.content = "(No response)";
        pending.pending = false;
        pending.toolRunning = false;
      } catch (err) {
        if (err.name === "AbortError") {
          if (!pending.content) pending.content = "(Stopped)";
        } else {
          targetList.pop();
          const uploaded = (userMsg.attachments || []).length;
          if (toUpload.length && uploaded < toUpload.length) {
            state[pendingKeyName] = toUpload.slice(uploaded).concat(state[pendingKeyName] || []);
            renderAttachList(which);
            if (!uploaded && !text) {
              targetList.pop();
              if (inputEl) inputEl.value = text;
              autosize(inputEl);
            }
          }
          const cors = isCorsFailure(err);
          targetList.push(makeMessage({
            role: "error",
            content: cors
              ? "The browser blocked the request to api.x.ai (CORS preflight failed). AskNelson will retry through a small proxy once it is deployed; you can also paste a proxy API base URL in Settings. If you use Microsoft Edge, try turning off Tracking Prevention for this site, or use Chrome."
              : "Request failed: " + (err.message || err),
            ts: Date.now()
          }));
        }
      } finally {
        pending.pending = false;
        pending.toolRunning = false;
        state.abort = null;
        setSendingUi(false);
        persistConvos();
        renderChat();
        refreshWorkspace();
        if (inputEl) inputEl.focus();
      }
    }

    function autosize(el) {
      el = el || $("input");
      if (!el) return;
      el.style.height = "auto";
      el.style.height = Math.min(el.scrollHeight, 160) + "px";
    }
    async function init() {
      await restoreKey();
      await loadConvos();
      await loadTasks();
      await loadNotes();
      await loadLastView();
      fillModels();
      setView(state.view);
      $("navToday").addEventListener("click", () => setView("today"));
      $("navTasks").addEventListener("click", () => setView("tasks"));
      $("navNotes").addEventListener("click", () => setView("notes"));
      $("newChat").addEventListener("click", () => {
        const c = makeConvo("chat-" + (state.conversations.length + 1));
        state.conversations.unshift(c);
        state.activeId = c.id;
        closeThread();
        closePins();
        persistConvos();
        setView("channels");
        $("input").focus();
      });
      $("todayQuickAdd").addEventListener("submit", (e) => {
        e.preventDefault();
        const title = $("todayTaskTitle").value.trim();
        if (!title) return;
        createTaskRecord({
          title,
          notes: $("todayTaskNote").value.trim(),
          due: todayISO(),
          priority: "normal"
        });
        $("todayTaskTitle").value = "";
        $("todayTaskNote").value = "";
        refreshWorkspace();
        $("todayTaskTitle").focus();
      });
      $("todayAskForm").addEventListener("submit", (e) => {
        e.preventDefault();
        const text = $("todayAskInput").value.trim();
        if (!text) return;
        $("todayAskInput").value = "";
        setView("channels");
        sendMessage(text);
      });
      $("taskAddForm").addEventListener("submit", (e) => {
        e.preventDefault();
        const title = $("taskAddTitle").value.trim();
        if (!title) return;
        const result = createTaskRecord({
          title,
          due: $("taskAddDue").value,
          priority: $("taskAddPriority").value
        });
        $("taskAddTitle").value = "";
        if (result.task && result.task.due) {
          if (taskMatchesFilter(result.task, "today")) state.taskFilter = "today";
          else if (taskMatchesFilter(result.task, "upcoming")) state.taskFilter = "upcoming";
          else if (taskMatchesFilter(result.task, "overdue")) state.taskFilter = "overdue";
        } else {
          state.taskFilter = "inbox";
        }
        refreshWorkspace();
        $("taskAddTitle").focus();
      });
      $("newNote").addEventListener("click", () => {
        const result = createNoteRecord({ title: "Untitled", body: "" });
        if (result.note) {
          state.activeNoteId = result.note.id;
          state.notePreview = false;
          $("notesLayout").classList.add("editing");
        }
        renderNotes();
        const title = $("noteTitle");
        if (title) {
          title.focus();
          title.select();
        }
      });
      $("noteSearch").addEventListener("input", () => {
        state.noteQuery = $("noteSearch").value;
        renderNoteList();
      });
      $("settingsBtn").addEventListener("click", openSettings);
      $("settingsBtn2").addEventListener("click", openSettings);
      $("cancelSettings").addEventListener("click", closeSettings);
      $("modal").addEventListener("click", (e) => { if (e.target === $("modal")) closeSettings(); });
      $("toggleKey").addEventListener("click", () => {
        const i = $("apiKey");
        i.type = i.type === "password" ? "text" : "password";
        $("toggleKey").textContent = i.type === "password" ? "Show" : "Hide";
      });
      $("exportBtn").addEventListener("click", exportBackup);
      $("importBtn").addEventListener("click", () => $("importFile").click());
      $("importFile").addEventListener("change", async () => {
        const file = $("importFile").files && $("importFile").files[0];
        $("importFile").value = "";
        if (!file) return;
        try {
          const raw = await file.text();
          pendingImport = parseBackup(raw);
          $("importSummary").textContent = "This backup has "
            + pendingImport.tasks.length + " task(s), "
            + pendingImport.notes.length + " note(s), and "
            + pendingImport.conversations.length + " conversation(s). Your API key will not be imported.";
          $("importStatus").textContent = "";
          $("importStatus").className = "status";
          $("importModal").classList.add("open");
        } catch (err) {
          $("settingsStatus").textContent = "Import failed: " + (err.message || err) + " Existing data was left unchanged.";
          $("settingsStatus").className = "status bad";
        }
      });
      $("cancelImport").addEventListener("click", () => {
        pendingImport = null;
        $("importModal").classList.remove("open");
      });
      $("importModal").addEventListener("click", (e) => {
        if (e.target === $("importModal")) {
          pendingImport = null;
          $("importModal").classList.remove("open");
        }
      });
      function finishImport(mode) {
        if (!pendingImport) return;
        try {
          applyImport(pendingImport, mode);
          pendingImport = null;
          $("importModal").classList.remove("open");
          $("settingsStatus").textContent = mode === "replace"
            ? "Workspace replaced from the backup. Your API key was not changed."
            : "Backup merged with your existing workspace. Your API key was not changed.";
          $("settingsStatus").className = "status ok";
        } catch (err) {
          $("importStatus").textContent = "Import failed: " + (err.message || err) + " Existing data was left unchanged.";
          $("importStatus").className = "status bad";
        }
      }
      $("mergeImport").addEventListener("click", () => finishImport("merge"));
      $("replaceImport").addEventListener("click", () => {
        if (!confirm("Replace tasks, notes, and conversations with this backup? This cannot be undone.")) return;
        finishImport("replace");
      });
      $("settingsForm").addEventListener("submit", async (e) => {
        e.preventDefault();
        const key = $("apiKey").value.trim();
        await setKey(key);
        const s = loadSettings();
        s.baseUrl = $("baseUrl").value.trim() || DEFAULT_BASE;
        s.systemPrompt = $("sysPrompt").value.trim() || DEFAULT_PROMPT;
        s.liveWeb = $("liveWeb").checked;
        s.liveX = $("liveX").checked;
        saveSettingsObj(s);
        $("settingsStatus").textContent = key
          ? "Saved on this device. Your API key, chat rooms, tasks, and notes will still be here next time."
          : "Key cleared.";
        $("settingsStatus").className = "status ok";
        fillModels();
        if (state.view === "channels") renderChat();
      });
      $("apiKey").addEventListener("change", async () => {
        const key = $("apiKey").value.trim();
        if (key) await setKey(key);
      });
      $("modelSelect").addEventListener("change", () => {
        const s = loadSettings();
        s.model = $("modelSelect").value;
        saveSettingsObj(s);
        if (state.view === "channels") renderChat();
      });
      function bindComposer(which) {
        const isThread = which === "thread";
        const input = $(isThread ? "threadInput" : "input");
        const send = $(isThread ? "threadSend" : "send");
        const attachBtn = $(isThread ? "threadAttachBtn" : "attachBtn");
        const fileInput = $(isThread ? "threadFileInput" : "fileInput");
        const composer = $(isThread ? "threadComposer" : "composer");
        if (!input || !send || !attachBtn || !fileInput || !composer) return;
        send.addEventListener("click", () => {
          if (isThread && !state.openThreadId) return;
          sendMessage(null, isThread ? { threadParentId: state.openThreadId } : {});
        });
        input.addEventListener("input", () => autosize(input));
        input.addEventListener("keydown", (e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            if (isThread && !state.openThreadId) return;
            sendMessage(null, isThread ? { threadParentId: state.openThreadId } : {});
          }
        });
        attachBtn.addEventListener("click", () => fileInput.click());
        fileInput.addEventListener("change", () => {
          addPendingFiles(fileInput.files, which);
          fileInput.value = "";
        });
        composer.addEventListener("dragover", (e) => {
          if (e.dataTransfer && [...e.dataTransfer.types].includes("Files")) {
            e.preventDefault();
            composer.classList.add("dragover");
          }
        });
        composer.addEventListener("dragleave", (e) => {
          if (!composer.contains(e.relatedTarget)) composer.classList.remove("dragover");
        });
        composer.addEventListener("drop", (e) => {
          e.preventDefault();
          composer.classList.remove("dragover");
          if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length) {
            addPendingFiles(e.dataTransfer.files, which);
          }
        });
      }
      bindComposer("main");
      bindComposer("thread");
      $("pinsBtn").addEventListener("click", (e) => {
        e.stopPropagation();
        openPins();
      });
      $("closePins").addEventListener("click", (e) => {
        e.stopPropagation();
        closePins();
      });
      $("closeThread").addEventListener("click", () => closeThread());
      $("viewChat").addEventListener("click", (e) => {
        const btn = e.target.closest("[data-action]");
        if (!btn || !$("viewChat").contains(btn)) return;
        const action = btn.dataset.action;
        const id = btn.dataset.id;
        if (action === "pin") togglePin(id);
        else if (action === "reply" || action === "open-thread") openThread(id);
        else if (action === "remove") requestRemove(id);
      });
      $("confirmCancel").addEventListener("click", () => closeConfirm(false));
      $("confirmOk").addEventListener("click", () => closeConfirm(true));
      $("confirmModal").addEventListener("click", (e) => {
        if (e.target === $("confirmModal")) closeConfirm(false);
      });
      document.addEventListener("click", (e) => {
        if (!state.pinsOpen) return;
        if (e.target.closest("#pinsPanel") || e.target.closest("#pinsBtn")) return;
        closePins();
      });
      document.addEventListener("keydown", (e) => {
        if (e.key !== "Escape") return;
        if ($("modal").classList.contains("open") || $("importModal").classList.contains("open")) return;
        if ($("confirmModal") && $("confirmModal").classList.contains("open")) { closeConfirm(false); return; }
        if (state.pinsOpen) { closePins(); return; }
        if (state.openThreadId) closeThread();
      });
      $("menuBtn").addEventListener("click", () => $("sidebar").classList.toggle("open"));
    }
    init();
