import { app as e } from "/scripts/app.js";
//#region src/editorWorker.ts?sharedworker&url
var t = "/extensions/tag_prompt/assets/editorWorker.js", n = {
	container: "_container_1wpqu_13",
	linenoView: "_lineno-view_1wpqu_81",
	selected: "_selected_1wpqu_83",
	headerView: "_header-view_1wpqu_97",
	bodyContainer: "_body-container_1wpqu_183",
	highlightView: "_highlight-view_1wpqu_261",
	suggestionView: "_suggestion-view_1wpqu_313"
};
//#endregion
//#region src/utils.ts
function r(e) {
	return e === " " || e === "," || e === "\n" || 256 <= e.charCodeAt(0);
}
function i(e, t, n, r) {
	let i = document.createElement(e);
	return t && (i.className = t), n && Object.entries(n).forEach(([e, t]) => {
		i.setAttribute(e, t);
	}), r && r.forEach((e) => i.appendChild(e)), i;
}
function a(e, t) {
	let n = e.substring(0, t);
	return {
		position: t,
		row: (n.match(/\n/g) || []).length,
		column: t - n.lastIndexOf("\n") - 1
	};
}
//#endregion
//#region src/editor.ts
function o(e) {
	return typeof e == "object" && !!e && "text" in e && "selectionStart" in e && "selectionEnd" in e && "scrollTop" in e && "scrollLeft" in e;
}
var s = class extends HTMLElement {
	container;
	headerView;
	headerViewSelect;
	headerViewListenerChange;
	headerViewState;
	linenoView;
	linenoViewPre;
	linenoViewCode;
	linenoViewState;
	bodyContainer;
	highlightView;
	highlightViewPre;
	highlightViewCode;
	highlightViewState;
	textarea;
	textareaListenerKeydown;
	textareaListenerInput;
	textareaListenerScroll;
	textareaResizeObserver;
	textareaListenerSelectionchange;
	textareaContent;
	textareaSelectionStart;
	textareaSelectionEnd;
	textareaScrollSize;
	textareaClientSize;
	textareaScrollPosition;
	suggestionView;
	suggestionViewSelect;
	suggestionViewListenerKeydown;
	suggestionViewListenerClick;
	suggestionViewState;
	worker;
	tickAnimationFrameID;
	constructor() {
		super(), this.headerViewListenerChange = (e) => this.handleHeaderViewChange(e), this.headerViewState = {
			content: "",
			dirty: !1
		}, this.linenoViewState = {
			content: "",
			rows: [],
			dirty: !1
		}, this.highlightViewState = {
			content: "",
			rows: [],
			viewport_top: 0,
			viewport_bottom: 0,
			row_start: 0,
			row_end: 0,
			dirty: !1
		}, this.textareaListenerKeydown = (e) => this.handleTextareaKeyDown(e), this.textareaListenerInput = (e) => this.handleTextareaInput(e), this.textareaListenerScroll = (e) => this.handleTextareaScroll(e), this.textareaResizeObserver = new ResizeObserver((e) => this.handleTextareaReSize(e)), this.textareaListenerSelectionchange = (e) => this.handleTextareaSelectionchange(e), this.textareaContent = {
			value: "",
			dirty: !0
		}, this.textareaSelectionStart = {
			position: 0,
			column: 0,
			row: 0,
			dirty: !1
		}, this.textareaSelectionEnd = {
			position: 0,
			column: 0,
			row: 0,
			dirty: !1
		}, this.textareaScrollSize = {
			width: 0,
			height: 0,
			dirty: !1
		}, this.textareaClientSize = {
			width: 0,
			height: 0,
			dirty: !1
		}, this.textareaScrollPosition = {
			top: 0,
			left: 0,
			dirty_top: !1,
			dirty_left: !1
		}, this.suggestionViewListenerKeydown = (e) => this.handleSuggestionViewKeyDown(e), this.suggestionViewListenerClick = (e) => this.handleSuggestionViewClick(e), this.suggestionViewState = {
			content: "",
			visible: !1,
			dirty: !1
		}, this.tickAnimationFrameID = 0;
	}
	connectedCallback() {
		this.container = i("div", n.container, void 0, [
			this.headerView = i("div", n.headerView, void 0, [this.headerViewSelect = i("select")]),
			this.linenoView = i("div", n.linenoView, void 0, [this.linenoViewPre = i("pre", void 0, void 0, [this.linenoViewCode = i("code")])]),
			this.bodyContainer = i("div", n.bodyContainer, void 0, [
				this.highlightView = i("div", n.highlightView, void 0, [this.highlightViewPre = i("pre", void 0, void 0, [this.highlightViewCode = i("code")])]),
				this.textarea = i("textarea", "comfy-multiline-input", {
					spellcheck: "false",
					"data-capture-wheel": "true"
				}),
				this.suggestionView = i("div", n.suggestionView, void 0, [this.suggestionViewSelect = i("select", void 0, { size: "10" })])
			])
		]), this.appendChild(this.container), this.worker = new SharedWorker(t), this.worker.port.onmessage = (e) => this.handleWorkerMessage(e), this.tickAnimationFrameID = 0, this.addHeaderViewEvents(), this.addTextareaEvents(), this.addSuggestionViewEvents(), this.reflectContentToTextarea(), this.reflectScrollPositionToTextarea();
	}
	disconnectedCallback() {
		this.worker?.port.close(), this.removeSuggestionViewEvents(), this.removeTextareaEvents(), this.removeHeaderViewEvents(), this.suggestionViewSelect.parentElement?.removeChild(this.suggestionViewSelect), this.suggestionView.parentElement?.removeChild(this.suggestionView), this.textarea.parentElement?.removeChild(this.textarea), this.highlightViewCode.parentElement?.removeChild(this.highlightViewCode), this.highlightViewPre.parentElement?.removeChild(this.highlightViewPre), this.highlightView.parentElement?.removeChild(this.highlightView), this.bodyContainer.parentElement?.removeChild(this.bodyContainer), this.linenoViewCode.parentElement?.removeChild(this.linenoViewCode), this.linenoViewPre.parentElement?.removeChild(this.linenoViewPre), this.linenoView.parentElement?.removeChild(this.linenoView), this.headerViewSelect.parentElement?.removeChild(this.headerViewSelect), this.headerView.parentElement?.removeChild(this.headerView), this.container.parentElement?.removeChild(this.container);
	}
	get state() {
		return JSON.stringify({
			text: this.textarea ? this.textarea.value : this.textareaContent.value,
			selectionStart: this.textarea ? this.textarea.selectionStart : this.textareaSelectionStart.position,
			selectionEnd: this.textarea ? this.textarea.selectionEnd : this.textareaSelectionEnd.position,
			scrollTop: this.textareaScrollPosition.top,
			scrollLeft: this.textareaScrollPosition.left
		});
	}
	set state(e) {
		let t = {
			text: e,
			selectionStart: 0,
			selectionEnd: 0,
			scrollTop: 0,
			scrollLeft: 0
		};
		try {
			let n = JSON.parse(e);
			o(n) && (t = n);
		} catch {}
		this.textareaContent.dirty = this.textareaContent.value !== t.text, this.textareaContent.value = t.text;
		let n = a(t.text, t.selectionStart), r = a(t.text, t.selectionEnd);
		this.textareaSelectionStart.dirty = this.textareaSelectionStart.position !== n.position, this.textareaSelectionStart.position = n.position, this.textareaSelectionStart.column = n.column, this.textareaSelectionStart.row = n.row, this.textareaSelectionEnd.dirty = this.textareaSelectionEnd.position !== r.position, this.textareaSelectionEnd.position = r.position, this.textareaSelectionEnd.column = r.column, this.textareaSelectionEnd.row = r.row, this.textareaScrollPosition.dirty_top = this.textareaScrollPosition.top !== t.scrollTop, this.textareaScrollPosition.dirty_left = this.textareaScrollPosition.left !== t.scrollLeft, this.textareaScrollPosition.top = t.scrollTop, this.textareaScrollPosition.left = t.scrollLeft, this.reflectContentToTextarea(), this.reflectScrollPositionToTextarea();
	}
	addHeaderViewEvents() {
		this.headerViewSelect.addEventListener("change", this.headerViewListenerChange);
	}
	removeHeaderViewEvents() {
		this.headerViewSelect.removeEventListener("change", this.headerViewListenerChange);
	}
	handleHeaderViewChange(e) {
		let t = parseInt(e.target.value);
		if (0 <= t && t < this.linenoViewState.rows.length) {
			let e = this.linenoViewState.rows[t].top;
			window.requestAnimationFrame(() => {
				this.textarea.scrollTop = e;
			});
		}
	}
	reflectContentToHeaderView() {
		if (this.headerViewState.dirty) {
			let e = this.headerViewSelect.selectedIndex;
			this.headerViewSelect.innerHTML = this.headerViewState.content, this.headerViewSelect.selectedIndex = e, this.headerViewState.dirty = !1;
		}
	}
	reflectScrollSizeToLinenoView() {
		this.textareaScrollSize.dirty && this.linenoViewPre && (this.linenoViewPre.style.height = this.textareaScrollSize.height + "px");
	}
	reflectClientSizeToLinenoView() {
		this.textareaClientSize.dirty && this.linenoView && (this.linenoView.style.height = this.textareaClientSize.height + "px");
	}
	reflectScrollPositionToLinenoView() {
		this.textareaScrollPosition.dirty_top && this.linenoView && (this.linenoView.scrollTop = this.textareaScrollPosition.top);
	}
	reflectContentToLinenoView() {
		let e = this.linenoViewState.dirty, t = this.linenoViewState.dirty || this.textareaSelectionStart.dirty || this.textareaSelectionEnd.dirty;
		if (e) {
			this.linenoViewCode.innerHTML = this.linenoViewState.content;
			let e = this.linenoViewCode.querySelectorAll("span"), t = e.length, n = [];
			for (let r = 0; r < t; r++) {
				let t = e[r];
				n.push({
					top: t.offsetTop,
					bottom: t.offsetTop + t.offsetHeight
				});
			}
			this.linenoViewState.rows = n, this.linenoViewState.dirty = !1;
		}
		if (t) {
			let e = this.textareaSelectionStart, t = this.textareaSelectionEnd, r = e.row, i = e.row < t.row && t.column === 0 ? t.row - 1 : t.row;
			this.linenoViewCode.querySelectorAll("span." + n.selected).forEach((e) => e.classList.toggle(n.selected, !1)), this.linenoViewCode.querySelectorAll("span:nth-of-type(n+" + (r + 1) + "):nth-of-type(-n+" + (i + 1) + ")").forEach((e) => e.classList.toggle(n.selected, !0));
		}
	}
	reflectScrollSizeToHighlightView() {
		this.textareaScrollSize.dirty && (this.highlightViewPre.style.width = this.textareaScrollSize.width + "px");
	}
	reflectClientSizeToHighlightView() {
		this.textareaClientSize.dirty && (this.highlightView.style.width = this.textareaClientSize.width + "px", this.highlightView.style.height = this.textareaClientSize.height + "px");
	}
	reflectScrollPositionToHighlightView() {
		this.textareaScrollPosition.dirty_left && (this.highlightView.scrollLeft = this.textareaScrollPosition.left);
	}
	reflectContentToHighlightView() {
		if (this.textareaClientSize.dirty || this.textareaScrollPosition.dirty_top || this.highlightViewState.dirty) {
			let e = this.textareaScrollPosition.top, t = e + this.textareaClientSize.height, n = Math.max(0, this.linenoViewState.rows.findIndex((t) => e < t.bottom)), r = Math.max(0, this.linenoViewState.rows.findLastIndex((e) => e.top < t)), i = this.highlightViewState.row_end - this.highlightViewState.row_start, a = r - n, o = this.highlightViewState.viewport_top - (this.highlightViewState.row_start < this.linenoViewState.rows.length ? this.linenoViewState.rows[this.highlightViewState.row_start].top : 0), s = e - (n < this.linenoViewState.rows.length ? this.linenoViewState.rows[n].top : 0);
			(this.highlightViewState.row_start !== n || this.highlightViewState.row_end !== r) && (this.highlightViewState.row_start = n, this.highlightViewState.row_end = r, this.highlightViewState.dirty = !0), (this.highlightViewState.viewport_top !== e || this.highlightViewState.viewport_bottom !== t) && (this.highlightViewState.viewport_top = e, this.highlightViewState.viewport_bottom = t), a !== i && (this.highlightViewPre.style.height = (r < this.linenoViewState.rows.length ? this.linenoViewState.rows[r].bottom : 0) - (n < this.linenoViewState.rows.length ? this.linenoViewState.rows[n].top : 0) + "px"), s !== o && (this.highlightView.scrollTop = s), this.highlightViewState.dirty && (this.highlightViewCode.innerHTML = this.highlightViewState.rows.filter((e, t) => n <= t && t <= r).join("\n"), this.highlightViewState.dirty = !1);
		}
	}
	addTextareaEvents() {
		this.textarea.addEventListener("keydown", this.textareaListenerKeydown), this.textarea.addEventListener("input", this.textareaListenerInput), this.textarea.addEventListener("scroll", this.textareaListenerScroll), this.textareaResizeObserver.observe(this.textarea), this.textarea.addEventListener("selectionchange", this.textareaListenerSelectionchange);
	}
	removeTextareaEvents() {
		this.textarea.removeEventListener("keydown", this.textareaListenerKeydown), this.textarea.removeEventListener("input", this.textareaListenerInput), this.textarea.removeEventListener("scroll", this.textareaListenerScroll), this.textareaResizeObserver.unobserve(this.textarea), this.textareaResizeObserver.disconnect(), this.textarea.removeEventListener("selectionchange", this.textareaListenerSelectionchange);
	}
	handleTextareaKeyDown(e) {
		if (!(e.defaultPrevented || e.repeat)) if (e.ctrlKey || e.metaKey) e.key === "/" && (this.toggleComment(), e.preventDefault());
		else if (this.isVisibleSuggestionView()) {
			if (e.key === "Tab") this.hiddenSuggestionView(), this.insertValue("    "), e.preventDefault();
			else if (e.key === "Escape" || e.key === "ArrowLeft" || e.key === "ArrowRight" || e.key === "ArrowUp") this.hiddenSuggestionView();
			else if (e.key === "ArrowDown") this.focusSuggestionView(), e.preventDefault();
			else if (e.key === "Enter") {
				let t = this.getSelectSuggestionWord(0);
				t && (this.hiddenSuggestionView(), this.textarea.focus(), this.applySuggestionWordToTextarea(t), e.preventDefault());
			}
		} else e.key === "Tab" && (this.insertValue("    "), e.preventDefault());
	}
	handleTextareaInput(e) {
		this.requestTickAnimationFrame(), this.postWorkerInput();
	}
	handleTextareaScroll(e) {
		this.requestTickAnimationFrame();
	}
	handleTextareaReSize(e) {
		this.requestTickAnimationFrame();
	}
	handleTextareaSelectionchange(e) {
		this.requestTickAnimationFrame();
	}
	reflectContentToTextarea() {
		this.textareaContent.dirty && this.textarea && (this.textarea.value = this.textareaContent.value, this.textarea.selectionStart = this.textareaSelectionStart.position, this.textarea.selectionEnd = this.textareaSelectionEnd.position, this.textareaContent.dirty = !0, this.postWorkerUpdate());
	}
	storeSelection() {
		let e = this.textarea.selectionStart, t = this.textarea.selectionEnd, n = this.textarea.value, r = a(n, e), i = a(n, t);
		this.textareaSelectionStart.position !== r.position && (this.textareaSelectionStart.position = r.position, this.textareaSelectionStart.column = r.column, this.textareaSelectionStart.row = r.row, this.textareaSelectionStart.dirty = !0), this.textareaSelectionEnd.position !== i.position && (this.textareaSelectionEnd.position = i.position, this.textareaSelectionEnd.column = i.column, this.textareaSelectionEnd.row = i.row, this.textareaSelectionEnd.dirty = !0);
	}
	reflectedSelection() {
		this.textareaSelectionStart.dirty = !1, this.textareaSelectionEnd.dirty = !1;
	}
	storeScrollSize() {
		let e = this.textarea.scrollWidth, t = this.textarea.scrollHeight;
		(this.textareaScrollSize.width !== e || this.textareaScrollSize.height !== t) && (this.textareaScrollSize.width = e, this.textareaScrollSize.height = t, this.textareaScrollSize.dirty = !0);
	}
	reflectedScrollSize() {
		this.textareaScrollSize.dirty = !1;
	}
	storeClientSize() {
		let e = this.textarea.clientWidth, t = this.textarea.clientHeight;
		(this.textareaClientSize.width !== e || this.textareaClientSize.height !== t) && (this.textareaClientSize.width = e, this.textareaClientSize.height = t, this.textareaClientSize.dirty = !0);
	}
	reflectedClientSize() {
		this.textareaClientSize.dirty = !1;
	}
	storeScrollPosition() {
		let e = this.textarea.scrollTop, t = this.textarea.scrollLeft;
		this.textareaScrollPosition.top !== e && (this.textareaScrollPosition.top = e, this.textareaScrollPosition.dirty_top = !0), this.textareaScrollPosition.left !== t && (this.textareaScrollPosition.left = t, this.textareaScrollPosition.dirty_left = !0);
	}
	reflectScrollPositionToTextarea() {
		(this.textareaScrollPosition.dirty_top || this.textareaScrollPosition.dirty_left) && this.textarea && window.requestAnimationFrame(() => {
			this.textarea.scrollTop = this.textareaScrollPosition.top, this.textarea.scrollLeft = this.textareaScrollPosition.left;
		});
	}
	reflectedScrollPosition() {
		this.textareaScrollPosition.dirty_top = !1, this.textareaScrollPosition.dirty_left = !1;
	}
	toggleComment() {
		let e = this.textarea.selectionStart, t = this.textarea.selectionEnd, n = this.textarea.value, r = [n.substring(0, e).lastIndexOf("\n")].reduce((e, t) => t === -1 ? e : t + 1, 0), i = [n.substring(0, t).lastIndexOf("\n"), n.indexOf("\n", t)].reduce((e, n) => n !== -1 && r < n && t - 1 <= n && n < e ? n : e, n.length), a = n.substring(r, i).split("\n"), o = a.reduce((e, t) => e || !t.trimStart().startsWith("//"), !1), s = a.map((e) => e.replace(/^(\s*)(.*)/, "$1").length).reduce((e, t, n) => n === 0 || t < e ? t : e, 0), c = e, l = t;
		if (o) for (let n = 0, i = r; n < a.length; n++) {
			let r = a[n];
			a[n] = " ".repeat(s) + "// " + r.substring(s), i < e && (c += 3), i < t && (l += 3), i += r.length + 1;
		}
		else for (let n = 0, i = r; n < a.length; n++) {
			let r = a[n];
			a[n] = r.replace(/\/\/\s?/, (n) => (i < e && (c -= n.length), i < t && (l -= n.length), "")), i += r.length + 1;
		}
		this.textarea.value = n.substring(0, r) + a.join("\n") + n.substring(i), this.textarea.selectionStart = c, this.textarea.selectionEnd = l, this.requestTickAnimationFrame(), this.postWorkerUpdate();
	}
	insertValue(e, t, n) {
		t ??= this.textarea.selectionStart, n ??= this.textarea.selectionEnd;
		let r = this.textarea.value;
		this.textarea.value = r.substring(0, t) + e + r.substring(n), this.textarea.selectionStart = this.textarea.selectionEnd = t + e.length, this.requestTickAnimationFrame(), this.postWorkerUpdate();
	}
	applySuggestionWordToTextarea(e) {
		let t = this.textarea.value, n = this.textarea.selectionStart, i = this.textarea.selectionEnd;
		for (let e = n - 1; 0 <= e && !r(t.charAt(e)); n = e--);
		for (; i < t.length && !r(t.charAt(i)); i++);
		let a = e + (t.charAt(i) === "," ? "" : ",");
		this.insertValue(a, n, i);
	}
	addSuggestionViewEvents() {
		this.suggestionViewSelect.addEventListener("keydown", this.suggestionViewListenerKeydown), document.addEventListener("click", this.suggestionViewListenerClick);
	}
	removeSuggestionViewEvents() {
		this.suggestionViewSelect.removeEventListener("keydown", this.suggestionViewListenerKeydown), document.removeEventListener("click", this.suggestionViewListenerClick);
	}
	handleSuggestionViewKeyDown(e) {
		if (!(e.defaultPrevented || e.repeat)) {
			if (e.key === "Escape") this.hiddenSuggestionView(), this.textarea.focus(), e.preventDefault();
			else if (e.key === "Backspace") this.hiddenSuggestionView(), this.textarea.focus(), e.preventDefault(), e.stopPropagation();
			else if (e.key === "Enter") {
				let t = this.getSelectSuggestionWord();
				t && (this.hiddenSuggestionView(), this.textarea.focus(), this.applySuggestionWordToTextarea(t), e.preventDefault());
			}
		}
	}
	handleSuggestionViewClick(e) {
		this.suggestionView.contains(e.target) || this.hiddenSuggestionView();
	}
	reflectContentToSuggestionView() {
		if (this.textareaContent.dirty || this.suggestionViewState.dirty) {
			let e = this.highlightViewCode.querySelector("span.caret");
			this.suggestionViewState.visible && e ? (this.suggestionViewSelect.innerHTML = this.suggestionViewState.content, this.suggestionView.style.visibility !== "visible" && (this.suggestionViewSelect.selectedIndex = -1, this.suggestionViewSelect.scrollTop = 0), this.suggestionView.style.top = e.offsetTop + e.offsetHeight - this.highlightView.scrollTop + "px", this.suggestionView.style.left = e.offsetLeft - this.highlightView.scrollLeft + "px", this.suggestionView.style.visibility = "visible") : this.suggestionView.style.visibility === "visible" && (this.suggestionView.style.visibility = "hidden");
		}
		this.suggestionViewState.dirty = !1;
	}
	isVisibleSuggestionView() {
		return this.suggestionView.style.visibility === "visible";
	}
	hiddenSuggestionView() {
		this.suggestionViewState.visible && (this.suggestionViewState.visible = !1, this.suggestionViewState.dirty = !0, this.requestTickAnimationFrame());
	}
	focusSuggestionView() {
		this.isVisibleSuggestionView() && (this.suggestionViewSelect.selectedIndex = 0, this.suggestionViewSelect.scrollTop = 0, this.suggestionViewSelect.focus());
	}
	getSelectSuggestionWord(e) {
		return e ??= this.suggestionViewSelect.selectedIndex, 0 <= e && e < this.suggestionViewSelect.options.length ? this.suggestionViewSelect.options[e].value : null;
	}
	handleWorkerMessage(e) {
		this.headerViewState.content !== e.data.headerViewHtml && (this.headerViewState.content = e.data.headerViewHtml, this.headerViewState.dirty = !0, this.requestTickAnimationFrame()), this.linenoViewState.content !== e.data.linenoViewHtml && (this.linenoViewState.content = e.data.linenoViewHtml, this.linenoViewState.dirty = !0, this.requestTickAnimationFrame()), this.highlightViewState.content !== e.data.highlightViewHtml && (this.highlightViewState.content = e.data.highlightViewHtml, this.highlightViewState.rows = e.data.highlightViewHtml.split("\n"), this.highlightViewState.dirty = !0, this.requestTickAnimationFrame()), this.suggestionViewState.content !== e.data.suggestionViewHtml && (this.suggestionViewState.content = e.data.suggestionViewHtml, this.suggestionViewState.visible = e.data.suggestionViewHtml.length !== 0, this.suggestionViewState.dirty = !0, this.requestTickAnimationFrame());
	}
	postWorkerInput() {
		let e = this.textarea.selectionStart, t = this.textarea.selectionEnd, n = this.textarea.value;
		this.worker.port.postMessage({
			suggestion: !0,
			selectionStart: e,
			selectionEnd: t,
			text: n
		});
	}
	postWorkerUpdate() {
		let e = this.textarea.selectionStart, t = this.textarea.selectionEnd, n = this.textarea.value;
		this.worker.port.postMessage({
			suggestion: !1,
			selectionStart: e,
			selectionEnd: t,
			text: n
		});
	}
	requestTickAnimationFrame() {
		this.tickAnimationFrameID === 0 && (this.tickAnimationFrameID = window.requestAnimationFrame((e) => this.handleTickAnimationFrame(e)));
	}
	handleTickAnimationFrame(e) {
		this.tickAnimationFrameID = 0, this.storeSelection(), this.storeScrollSize(), this.storeClientSize(), this.storeScrollPosition(), this.reflectContentToHeaderView(), this.reflectScrollSizeToLinenoView(), this.reflectClientSizeToLinenoView(), this.reflectScrollPositionToLinenoView(), this.reflectContentToLinenoView(), this.reflectScrollSizeToHighlightView(), this.reflectClientSizeToHighlightView(), this.reflectScrollPositionToHighlightView(), this.reflectContentToHighlightView(), this.reflectContentToSuggestionView(), this.reflectedSelection(), this.reflectedScrollSize(), this.reflectedClientSize(), this.reflectedScrollPosition();
	}
};
//#endregion
//#region src/index.ts
customElements.define("yossq236-custom-editor-element", s), e.registerExtension({
	name: "yossq236.TagPromptNode",
	setup: async (e) => {
		let t = document.createElement("link");
		t.rel = "stylesheet", t.type = "text/css", t.href = "/extensions/tag_prompt/assets/index.css", document.head.appendChild(t);
	},
	getCustomWidgets: async (e) => ({ "YOSSQ236-CUSTOM-EDITOR": (e, t, n, r, i) => {
		let a = document.createElement("yossq236-custom-editor-element");
		return {
			widget: e.addDOMWidget(t, n[0], a, {
				getValue: () => a.state,
				setValue: (e) => {
					a.state = e;
				}
			}),
			minWidth: 400,
			minHeight: 300
		};
	} })
});
//#endregion
