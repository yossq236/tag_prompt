import { app as w } from "/scripts/app.js";
const x = "/extensions/tag_prompt/assets/editorWorker.js";
class g {
  // containor
  container;
  // highlight view
  highlightViewContainer;
  highlightViewPre;
  highlightViewCode;
  // textarea
  textarea;
  textareaKeydownEvent;
  textareaInputEvent;
  textareaScrollEvent;
  textareaResizeObserver;
  // suggestion view
  suggestionViewContainer;
  suggestionViewSelect;
  suggestionViewKeydownEvent;
  suggestionViewClickEvent;
  // worker
  editorWorker;
  // constructor
  constructor() {
  }
  // property
  get element() {
    return this.container;
  }
  get state() {
    return JSON.stringify({
      text: this.textarea.value,
      selectionStart: this.textarea.selectionStart,
      selectionEnd: this.textarea.selectionEnd,
      scrollTop: this.textarea.scrollTop,
      scrollLeft: this.textarea.scrollLeft
    });
  }
  set state(t) {
    try {
      const e = JSON.parse(t);
      "text" in e && "selectionStart" in e && "selectionEnd" in e && "scrollTop" in e && "scrollLeft" in e ? (this.textarea.value = e.text, this.textarea.selectionStart = e.selectionStart, this.textarea.selectionEnd = e.selectionEnd, setTimeout(() => {
        this.textarea.scrollTop = e.scrollTop, this.textarea.scrollLeft = e.scrollLeft, this.postWorkerUpdateText(!1);
      }, 0)) : (this.textarea.value = t, this.postWorkerUpdateText(!1));
    } catch {
      this.textarea.value = t, this.postWorkerUpdateText(!1);
    }
  }
  // mount
  mount() {
    this.container = this.createContainer(), this.highlightViewContainer = this.createHighlightViewContainer(this.container), this.highlightViewPre = this.createHighlightViewPre(this.highlightViewContainer), this.highlightViewCode = this.createHighlightViewCode(this.highlightViewPre), this.textarea = this.createTextarea(this.container), this.suggestionViewContainer = this.createSuggestionViewContainer(this.container), this.suggestionViewSelect = this.createSuggestionViewSelect(this.suggestionViewContainer), this.editorWorker = new SharedWorker(x), this.reflectStyleToHighlightView(), this.reflectSizeToHighlightView(), this.reflectScrollToHighlightView(), this.setupEventTextarea(), this.setupEventSuggestionView(), this.setupEventWorker(), this.highlightViewCode.innerHTML = this.textarea.value, this.postWorkerUpdateText(!1);
  }
  // unmount
  unmount() {
    this.editorWorker.port.close(), this.removeEventSuggestionView(), this.removeEventTextarea(), this.suggestionViewSelect.parentElement?.removeChild(this.suggestionViewSelect), this.suggestionViewContainer.parentElement?.removeChild(this.suggestionViewContainer), this.textarea.parentElement?.removeChild(this.textarea), this.highlightViewCode.parentElement?.removeChild(this.highlightViewCode), this.highlightViewPre.parentElement?.removeChild(this.highlightViewPre), this.highlightViewContainer.parentElement?.removeChild(this.highlightViewContainer), this.container.parentElement?.removeChild(this.container);
  }
  // event 
  setupEventTextarea() {
    this.textareaKeydownEvent = (t) => {
      t.defaultPrevented || (t.ctrlKey || t.metaKey ? t.key === "/" && (this.toggleCommentToTextarea(), this.postWorkerUpdateText(!1), t.preventDefault()) : this.isVisibleSuggestionView() ? t.key === "Tab" || t.key === "Escape" || t.key === "ArrowLeft" || t.key === "ArrowRight" || t.key === "ArrowUp" ? this.hiddenSuggestionView() : t.key === "ArrowDown" && (this.focusSuggestionView(), t.preventDefault()) : t.key === "Tab" && (this.insertWordToTextarea("    "), this.postWorkerUpdateText(!1), t.preventDefault()));
    }, this.textarea.addEventListener("keydown", this.textareaKeydownEvent), this.textareaInputEvent = (t) => {
      this.postWorkerUpdateText(!0);
    }, this.textarea.addEventListener("input", this.textareaInputEvent), this.textareaScrollEvent = (t) => {
      this.reflectScrollToHighlightView();
    }, this.textarea.addEventListener("scroll", this.textareaScrollEvent), this.textareaResizeObserver = new ResizeObserver(() => {
      this.reflectSizeToHighlightView();
    }), this.textareaResizeObserver.observe(this.textarea);
  }
  removeEventTextarea() {
    this.textarea.removeEventListener("keydown", this.textareaKeydownEvent), this.textarea.removeEventListener("input", this.textareaInputEvent), this.textarea.removeEventListener("scroll", this.textareaScrollEvent), this.textareaResizeObserver.unobserve(this.textarea), this.textareaResizeObserver.disconnect();
  }
  setupEventSuggestionView() {
    this.suggestionViewKeydownEvent = (t) => {
      if (!t.defaultPrevented) {
        if (t.key === "Escape")
          this.hiddenSuggestionView(), this.textarea.focus(), t.preventDefault();
        else if (t.key === "Backspace")
          this.hiddenSuggestionView(), this.textarea.focus(), t.preventDefault(), t.stopPropagation();
        else if (t.key === "Enter") {
          const e = this.getSelectSuggestionWord();
          e && (this.hiddenSuggestionView(), this.textarea.focus(), this.applySuggestionWordToTextarea(e), this.postWorkerUpdateText(!1), t.preventDefault());
        }
      }
    }, this.suggestionViewSelect.addEventListener("keydown", this.suggestionViewKeydownEvent), this.suggestionViewClickEvent = (t) => {
      this.suggestionViewContainer.contains(t.target) || this.hiddenSuggestionView();
    }, document.addEventListener("click", this.suggestionViewClickEvent);
  }
  removeEventSuggestionView() {
    this.suggestionViewSelect.removeEventListener("keydown", this.suggestionViewKeydownEvent), document.removeEventListener("click", this.suggestionViewClickEvent);
  }
  setupEventWorker() {
    this.editorWorker.port.onmessage = (t) => {
      this.highlightViewCode.innerHTML = t.data.highlightViewHtml, this.reflectSizeToHighlightView(), this.reflectScrollToHighlightView(), this.suggestionViewSelect.innerHTML = t.data.suggestionViewHtml, 0 < t.data.suggestionViewHtml.length ? this.visibleSuggestionView() : this.hiddenSuggestionView();
    };
  }
  // highlight view 
  reflectStyleToHighlightView() {
    this.highlightViewPre.style.fontFamily = this.textarea.style.fontFamily, this.highlightViewPre.style.tabSize = this.textarea.style.tabSize;
  }
  reflectSizeToHighlightView() {
    this.highlightViewPre.style.width = this.textarea.scrollWidth + "px", this.highlightViewPre.style.height = this.textarea.scrollHeight + "px", this.highlightViewContainer.style.width = this.textarea.clientWidth + "px", this.highlightViewContainer.style.height = this.textarea.clientHeight + "px";
  }
  reflectScrollToHighlightView() {
    this.highlightViewContainer.scrollLeft = this.textarea.scrollLeft, this.highlightViewContainer.scrollTop = this.textarea.scrollTop;
  }
  // textarea
  toggleCommentToTextarea() {
    const t = this.textarea.selectionStart, e = this.textarea.selectionEnd, r = this.textarea.value, s = r.split(`
`), o = g.getCursor(r, t), i = g.getCursor(r, e), n = o.row, l = o.row < i.row && i.column === 0 ? i.row - 1 : i.row;
    let h = !1;
    for (let a = n; a <= l; a++)
      s[a].trimStart().startsWith("//") || (h = !0);
    let u = t, c = e;
    for (let a = n; a <= l; a++)
      h ? (s[a] = "// " + s[a], c += 3) : s[a] = s[a].replace(/(\/\/\s)|(\/\/)/, (d) => (c -= d.length, ""));
    this.textarea.value = s.join(`
`), this.textarea.selectionStart = u, this.textarea.selectionEnd = c;
  }
  insertWordToTextarea(t, e, r) {
    e ??= this.textarea.selectionStart, r ??= this.textarea.selectionEnd;
    const s = this.textarea.value;
    this.textarea.value = s.substring(0, e) + t + s.substring(r), this.textarea.selectionStart = this.textarea.selectionEnd = e + t.length;
  }
  applySuggestionWordToTextarea(t) {
    const e = this.textarea.value;
    let r = this.textarea.selectionStart, s = this.textarea.selectionEnd;
    for (let i = r - 1; 0 <= i; i--) {
      const n = e.charAt(i);
      if (n === " " || n === "," || n === `
` || 255 < n.charCodeAt(0)) break;
      r = i;
    }
    for (let i = s; i < e.length; i++) {
      const n = e.charAt(i);
      if (n === " " || n === "," || n === `
` || 255 < n.charCodeAt(0)) break;
      s = i + 1;
    }
    const o = t + (e.charAt(s) !== "," ? "," : "");
    this.insertWordToTextarea(o, r, s);
  }
  static getCursor(t, e) {
    let r = 0, s = -1;
    for (let o = -1; (o = t.indexOf(`
`, o + 1)) !== -1 && o < e; s = o, r++) ;
    return { row: r, column: e - s - 1 };
  }
  // suggestion
  isVisibleSuggestionView() {
    return this.suggestionViewContainer.style.visibility === "visible";
  }
  visibleSuggestionView() {
    const t = this.highlightViewCode.querySelector("span.caret");
    t && (this.suggestionViewContainer.style.top = t.offsetTop + t.offsetHeight - this.textarea.scrollTop + "px", this.suggestionViewContainer.style.left = t.offsetLeft - this.textarea.scrollLeft + "px", this.isVisibleSuggestionView() || (this.suggestionViewContainer.style.visibility = "visible"));
  }
  hiddenSuggestionView() {
    this.isVisibleSuggestionView() && (this.suggestionViewContainer.style.visibility = "hidden");
  }
  focusSuggestionView() {
    this.isVisibleSuggestionView() && (this.suggestionViewSelect.selectedIndex = 0, this.suggestionViewSelect.focus());
  }
  getSelectSuggestionWord() {
    return 0 <= this.suggestionViewSelect.selectedIndex ? this.suggestionViewSelect.options[this.suggestionViewSelect.selectedIndex].value : null;
  }
  // worker
  postWorkerUpdateText(t) {
    this.editorWorker.port.postMessage({
      suggestion: t,
      selectionStart: this.textarea.selectionStart,
      selectionEnd: this.textarea.selectionEnd,
      text: this.textarea.value
    });
  }
  // create 
  createContainer() {
    const t = document.createElement("div");
    return t.style.position = "relative", t;
  }
  createTextarea(t) {
    const e = document.createElement("textarea");
    return t.appendChild(e), e.className = "comfy-multiline-input", e.style.width = "100%", e.style.height = "100%", e.style.overflowX = "auto", e.style.overflowY = "auto", e.style.whiteSpace = "nowrap", e.style.background = "transparent", e.style.color = "transparent", e.style.caretColor = "rgb(from var(--comfy-input-bg) calc(255 - r) calc(255 - g) calc(255 - b))", e;
  }
  createHighlightViewContainer(t) {
    const e = document.createElement("div");
    return t.appendChild(e), e.style.position = "absolute", e.style.left = "0", e.style.top = "0", e.style.overflowX = "hidden", e.style.overflowY = "hidden", e.style.zIndex = "-1", e;
  }
  createHighlightViewPre(t) {
    const e = document.createElement("pre");
    return t.appendChild(e), e.style.margin = "0", e.style.border = "none", e.style.padding = "2px", e.style.fontSize = "var(--comfy-textarea-font-size)", e.style.background = "var(--comfy-input-bg)", e.style.color = "var(--input-text)", e;
  }
  createHighlightViewCode(t) {
    const e = document.createElement("code");
    return t.appendChild(e), e;
  }
  createSuggestionViewContainer(t) {
    const e = document.createElement("div");
    return t.appendChild(e), e.style.position = "absolute", e.style.left = "0", e.style.top = "0", e.style.width = "fit-content", e.style.height = "auto", e.style.visibility = "hidden", e;
  }
  createSuggestionViewSelect(t) {
    const e = document.createElement("select");
    return t.appendChild(e), e.setAttribute("size", "5"), e.style.fontSize = "var(--comfy-textarea-font-size)", e.style.background = "var(--comfy-input-bg)", e.style.color = "var(--input-text)", e.style.appearance = "none", e;
  }
}
const p = {
  name: "yossq236.TagPromptNode",
  getCustomWidgets: async (V) => ({
    MY_STRING: (t, e, r, s, o) => {
      const i = new g();
      i.mount();
      const n = t.addDOMWidget(e, r[0], i.element, {
        getValue: () => i.state,
        setValue: (h) => {
          i.state = h;
        }
      }), l = t.onRemoved;
      return t.onRemoved = function() {
        i.unmount(), l?.call(this);
      }, { widget: n, minWidth: 400, minHeight: 300 };
    }
  })
};
w.registerExtension(p);
