const chat = {
  panel: null,
  messages: null,
  input: null,
  toggle: null,
  ws: null,
  maxMessages: 50,
  unread: 0,

  init(ws) {
    this.ws = ws;
    this.panel = document.getElementById("chatPanel");
    this.messages = document.getElementById("chatMessages");
    this.input = document.getElementById("chatInput");

    this.toggle = document.getElementById("chatToggle");
    this.toggle.onclick = () => {
      this.panel.classList.toggle("hidden");
      if (!this.panel.classList.contains("hidden")) this.clearUnread();
    };

    document.getElementById("chatSend").onclick = () => this.send();

    this.input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.stopPropagation();
        this.send();
      }
    });

    this.input.addEventListener("keyup", (e) => e.stopPropagation());
  },

  send() {
    const text = this.input.value.trim();
    if (!text || !this.ws || this.ws.readyState !== 1) return;
    this.ws.send(JSON.stringify({ type: "chat", text }));
    this.input.value = "";
  },

  addMessage(name, text) {
    const div = document.createElement("div");
    div.className = "chat-msg";
    div.innerHTML = `<span class="name">${this.escape(name)}:</span> ${this.escape(text)}`;
    this.messages.appendChild(this.messages.children.length >= this.maxMessages
      ? (this.messages.removeChild(this.messages.firstChild), div)
      : div);
    this.messages.scrollTop = this.messages.scrollHeight;
    // если панель свёрнута — подсветим кнопку счётчиком непрочитанных
    if (this.panel.classList.contains("hidden")) this.bumpUnread();
  },

  bumpUnread() {
    this.unread++;
    this.toggle.dataset.count = this.unread > 99 ? "99+" : String(this.unread);
    this.toggle.classList.add("has-unread");
  },

  clearUnread() {
    this.unread = 0;
    this.toggle.classList.remove("has-unread");
    delete this.toggle.dataset.count;
  },

  addSystem(text) {
    const div = document.createElement("div");
    div.className = "chat-msg system";
    div.textContent = text;
    this.messages.appendChild(div);
    this.messages.scrollTop = this.messages.scrollHeight;
  },

  escape(s) {
    const d = document.createElement("div");
    d.textContent = s;
    return d.innerHTML;
  }
};
