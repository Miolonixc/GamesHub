const chat = {
  panel: null,
  messages: null,
  input: null,
  ws: null,
  maxMessages: 50,

  init(ws) {
    this.ws = ws;
    this.panel = document.getElementById("chatPanel");
    this.messages = document.getElementById("chatMessages");
    this.input = document.getElementById("chatInput");

    document.getElementById("chatToggle").onclick = () => {
      this.panel.classList.toggle("hidden");
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
