import { app } from "/scripts/app.js";
//#region src/utils.ts
function isDelimiter(c) {
	return c === " " || c === "," || c === "\n" || 256 <= c.charCodeAt(0);
}
function getCursor(text, position) {
	let row = 0;
	let last = -1;
	for (let i = -1; (i = text.indexOf("\n", i + 1)) !== -1 && i < position; last = i, row++);
	return {
		row,
		column: position - last - 1
	};
}
//#endregion
//#region src/editorWorker.ts?sharedworker&url
var editorWorker_default = "/extensions/tag_prompt/assets/editorWorker.js";
var editor_module_default = {
	container: "_container_141ns_1",
	bodyContainer: "_body-container_141ns_35",
	linenoView: "_lineno-view_141ns_45",
	highlightView: "_highlight-view_141ns_73",
	suggestionView: "_suggestion-view_141ns_127",
	selected: "_selected_141ns_155"
};
//#endregion
//#region src/editor.ts
function isValidState(obj) {
	return obj !== null && typeof obj === "object" && "text" in obj && "selectionStart" in obj && "selectionEnd" in obj && "scrollTop" in obj && "scrollLeft" in obj;
}
var Editor = class {
	container;
	bodyContainer;
	linenoView;
	linenoViewPre;
	linenoViewCode;
	highlightView;
	highlightViewPre;
	highlightViewCode;
	textarea;
	textareaListenerKeydown;
	textareaListenerInput;
	textareaListenerScroll;
	textareaResizeObserver;
	textareaListenerSelectionchange;
	textareaScrollSize;
	textareaClientSize;
	textareaScrollPosition;
	textareaCursorStart;
	textareaCursorEnd;
	suggestionView;
	suggestionViewSelect;
	suggestionViewListenerKeydown;
	suggestionViewListenerClick;
	worker;
	tickAnimationFrameID;
	constructor() {
		this.container = this.createContainer();
		this.linenoView = this.createLinenoView(this.container);
		this.linenoViewPre = this.createLinenoViewPre(this.linenoView);
		this.linenoViewCode = this.createLinenoViewCode(this.linenoViewPre);
		this.bodyContainer = this.createBodyContainer(this.container);
		this.highlightView = this.createHighlightView(this.bodyContainer);
		this.highlightViewPre = this.createHighlightViewPre(this.highlightView);
		this.highlightViewCode = this.createHighlightViewCode(this.highlightViewPre);
		this.textarea = this.createTextarea(this.bodyContainer);
		this.textareaListenerKeydown = (e) => this.handleTextareaKeyDown(e);
		this.textareaListenerInput = (e) => this.handleTextareaInput(e);
		this.textareaListenerScroll = (e) => this.handleTextareaScroll(e);
		this.textareaResizeObserver = new ResizeObserver((e) => this.handleTextareaReSize(e));
		this.textareaListenerSelectionchange = (e) => this.handleTextareaSelectionchange(e);
		this.textareaScrollSize = {
			width: 0,
			height: 0,
			dirty: false
		};
		this.textareaClientSize = {
			width: 0,
			height: 0,
			dirty: false
		};
		this.textareaScrollPosition = {
			top: 0,
			left: 0,
			dirty: false
		};
		this.textareaCursorStart = {
			column: 0,
			row: 0
		};
		this.textareaCursorEnd = {
			column: 0,
			row: 0
		};
		this.suggestionView = this.createSuggestionView(this.bodyContainer);
		this.suggestionViewSelect = this.createSuggestionViewSelect(this.suggestionView);
		this.suggestionViewListenerKeydown = (e) => this.handleSuggestionViewKeyDown(e);
		this.suggestionViewListenerClick = (e) => this.handleSuggestionViewClick(e);
		this.worker = new SharedWorker(editorWorker_default);
		this.worker.port.onmessage = (e) => this.handleWorkerMessage(e);
		this.tickAnimationFrameID = 0;
		this.addTextareaEvent();
		this.addSuggestionViewEvent();
	}
	get element() {
		return this.container;
	}
	get state() {
		return JSON.stringify({
			text: this.textarea.value,
			selectionStart: this.textarea.selectionStart,
			selectionEnd: this.textarea.selectionEnd,
			scrollTop: this.textareaScrollPosition.top,
			scrollLeft: this.textareaScrollPosition.left
		});
	}
	set state(newValue) {
		let stateObj = {
			text: newValue,
			selectionStart: 0,
			selectionEnd: 0,
			scrollTop: 0,
			scrollLeft: 0
		};
		try {
			const parseObj = JSON.parse(newValue);
			if (isValidState(parseObj)) stateObj = parseObj;
		} catch {}
		const change_text = this.textarea.value !== stateObj.text;
		this.textarea.value = stateObj.text;
		this.textarea.selectionStart = stateObj.selectionStart;
		this.textarea.selectionEnd = stateObj.selectionEnd;
		if (this.textareaScrollPosition.top !== stateObj.scrollTop || this.textareaScrollPosition.left !== stateObj.scrollLeft) window.requestAnimationFrame(() => {
			this.textarea.scrollTop = stateObj.scrollTop;
			this.textarea.scrollLeft = stateObj.scrollLeft;
		});
		if (change_text) this.postWorkerUpdateText(false);
	}
	unmount() {
		this.worker.port.close();
		this.worker.port.onmessage = null;
		this.removeSuggestionViewEvent();
		this.removeTextareaEvent();
		this.suggestionViewSelect.parentElement?.removeChild(this.suggestionViewSelect);
		this.suggestionView.parentElement?.removeChild(this.suggestionView);
		this.textarea.parentElement?.removeChild(this.textarea);
		this.highlightViewCode.parentElement?.removeChild(this.highlightViewCode);
		this.highlightViewPre.parentElement?.removeChild(this.highlightViewPre);
		this.highlightView.parentElement?.removeChild(this.highlightView);
		this.bodyContainer.parentElement?.removeChild(this.bodyContainer);
		this.linenoViewCode.parentElement?.removeChild(this.linenoViewCode);
		this.linenoViewPre.parentElement?.removeChild(this.linenoViewPre);
		this.linenoView.parentElement?.removeChild(this.linenoView);
		this.container.parentElement?.removeChild(this.container);
	}
	requestTickAnimationFrame() {
		if (this.tickAnimationFrameID === 0) this.tickAnimationFrameID = window.requestAnimationFrame((t) => this.handleTickAnimationFrame(t));
	}
	handleTickAnimationFrame(_time) {
		this.tickAnimationFrameID = 0;
		this.storeScrollSize();
		this.storeClientSize();
		this.storeScrollPosition();
		this.reflectScrollSizeToLinenoView();
		this.reflectClientSizeToLinenoView();
		this.reflectScrollPositionToLinenoView();
		this.reflectScrollSizeToHighlightView();
		this.reflectClientSizeToHighlightView();
		this.reflectScrollPositionToHighlightView();
		this.reflectedScrollSize();
		this.reflectedClientSize();
		this.reflectedScrollPosition();
	}
	reflectScrollSizeToLinenoView() {
		if (this.textareaScrollSize.dirty) this.linenoViewPre.style.height = this.textareaScrollSize.height + "px";
	}
	reflectClientSizeToLinenoView() {
		if (this.textareaClientSize.dirty) this.linenoView.style.height = this.textareaClientSize.height + "px";
	}
	reflectScrollPositionToLinenoView() {
		if (this.textareaScrollPosition.dirty) this.linenoView.scrollTop = this.textareaScrollPosition.top;
	}
	reflectScrollSizeToHighlightView() {
		if (this.textareaScrollSize.dirty) {
			this.highlightViewPre.style.width = this.textareaScrollSize.width + "px";
			this.highlightViewPre.style.height = this.textareaScrollSize.height + "px";
		}
	}
	reflectClientSizeToHighlightView() {
		if (this.textareaClientSize.dirty) {
			this.highlightView.style.width = this.textareaClientSize.width + "px";
			this.highlightView.style.height = this.textareaClientSize.height + "px";
		}
	}
	reflectScrollPositionToHighlightView() {
		if (this.textareaScrollPosition.dirty) {
			this.highlightView.scrollLeft = this.textareaScrollPosition.left;
			this.highlightView.scrollTop = this.textareaScrollPosition.top;
		}
	}
	addTextareaEvent() {
		this.textarea.addEventListener("keydown", this.textareaListenerKeydown);
		this.textarea.addEventListener("input", this.textareaListenerInput);
		this.textarea.addEventListener("scroll", this.textareaListenerScroll);
		this.textareaResizeObserver.observe(this.textarea);
		this.textarea.addEventListener("selectionchange", this.textareaListenerSelectionchange);
	}
	removeTextareaEvent() {
		this.textarea.removeEventListener("keydown", this.textareaListenerKeydown);
		this.textarea.removeEventListener("input", this.textareaListenerInput);
		this.textarea.removeEventListener("scroll", this.textareaListenerScroll);
		this.textareaResizeObserver.unobserve(this.textarea);
		this.textareaResizeObserver.disconnect();
		this.textarea.removeEventListener("selectionchange", this.textareaListenerSelectionchange);
	}
	handleTextareaKeyDown(event) {
		if (event.defaultPrevented || event.repeat) return;
		else if (event.ctrlKey || event.metaKey) {
			if (event.key === "/") {
				this.toggleComment();
				event.preventDefault();
			}
		} else if (this.isVisibleSuggestionView()) {
			if (event.key === "Tab") {
				this.hiddenSuggestionView();
				this.insertValue("    ");
				event.preventDefault();
			} else if (event.key === "Escape" || event.key === "ArrowLeft" || event.key === "ArrowRight" || event.key === "ArrowUp") this.hiddenSuggestionView();
			else if (event.key === "ArrowDown") {
				this.focusSuggestionView();
				event.preventDefault();
			}
		} else if (event.key === "Tab") {
			this.insertValue("    ");
			event.preventDefault();
		}
	}
	handleTextareaInput(_event) {
		this.requestTickAnimationFrame();
		this.postWorkerUpdateText(true);
	}
	handleTextareaScroll(_event) {
		this.requestTickAnimationFrame();
	}
	handleTextareaReSize(_entries) {
		this.requestTickAnimationFrame();
	}
	handleTextareaSelectionchange(_event) {
		const start = this.textarea.selectionStart;
		const end = this.textarea.selectionEnd;
		const text = this.textarea.value;
		const cursor_start = getCursor(text, start);
		const cursor_end = getCursor(text, end);
		const new_row_start = cursor_start.row;
		const new_row_end = cursor_start.row < cursor_end.row && cursor_end.column === 0 ? cursor_end.row - 1 : cursor_end.row;
		const old_row_start = this.textareaCursorStart.row;
		const old_row_end = this.textareaCursorStart.row < this.textareaCursorEnd.row && this.textareaCursorEnd.column === 0 ? this.textareaCursorEnd.row - 1 : this.textareaCursorEnd.row;
		if (new_row_start !== old_row_start || new_row_end !== old_row_end) {
			const spans = this.linenoViewCode.querySelectorAll("span");
			for (let i = old_row_start; i <= old_row_end; i++) spans[i].className = "";
			for (let i = new_row_start; i <= new_row_end; i++) spans[i].className = editor_module_default.selected;
			this.textareaCursorStart = cursor_start;
			this.textareaCursorEnd = cursor_end;
		}
	}
	storeScrollSize() {
		const width = this.textarea.scrollWidth;
		const height = this.textarea.scrollHeight;
		if (this.textareaScrollSize.width !== width || this.textareaScrollSize.height !== height) {
			this.textareaScrollSize.width = width;
			this.textareaScrollSize.height = height;
			this.textareaScrollSize.dirty = true;
		}
	}
	reflectedScrollSize() {
		this.textareaScrollSize.dirty = false;
	}
	storeClientSize() {
		const width = this.textarea.clientWidth;
		const height = this.textarea.clientHeight;
		if (this.textareaClientSize.width !== width || this.textareaClientSize.height !== height) {
			this.textareaClientSize.width = width;
			this.textareaClientSize.height = height;
			this.textareaClientSize.dirty = true;
		}
	}
	reflectedClientSize() {
		this.textareaClientSize.dirty = false;
	}
	storeScrollPosition() {
		const top = this.textarea.scrollTop;
		const left = this.textarea.scrollLeft;
		if (this.textareaScrollPosition.top !== top || this.textareaScrollPosition.left !== left) {
			this.textareaScrollPosition.top = top;
			this.textareaScrollPosition.left = left;
			this.textareaScrollPosition.dirty = true;
		}
	}
	reflectedScrollPosition() {
		this.textareaScrollPosition.dirty = false;
	}
	toggleComment() {
		const selection_start = this.textarea.selectionStart;
		const selection_end = this.textarea.selectionEnd;
		const text = this.textarea.value;
		const toggle_start = [text.substring(0, selection_start).lastIndexOf("\n")].reduce((a, v) => v !== -1 ? v + 1 : a, 0);
		const toggle_end = [text.substring(0, selection_end).lastIndexOf("\n"), text.indexOf("\n", selection_end)].reduce((a, v) => v !== -1 && toggle_start < v && selection_end - 1 <= v && v < a ? v : a, text.length);
		const toggle_lines = text.substring(toggle_start, toggle_end).split("\n");
		const commentout = toggle_lines.reduce((a, v) => a || !v.trimStart().startsWith("//"), false);
		const indent = toggle_lines.map((v) => v.replace(/^(\s*)(.*)/, "$1").length).reduce((a, v, i) => i === 0 || v < a ? v : a, 0);
		let new_selection_start = selection_start;
		let new_selection_end = selection_end;
		if (commentout) for (let i = 0, position = toggle_start; i < toggle_lines.length; i++) {
			const line = toggle_lines[i];
			toggle_lines[i] = " ".repeat(indent) + "// " + line.substring(indent);
			if (position < selection_start) new_selection_start += 3;
			if (position < selection_end) new_selection_end += 3;
			position += line.length + 1;
		}
		else for (let i = 0, position = toggle_start; i < toggle_lines.length; i++) {
			const line = toggle_lines[i];
			toggle_lines[i] = line.replace(/\/\/\s?/, (m) => {
				if (position < selection_start) new_selection_start -= m.length;
				if (position < selection_end) new_selection_end -= m.length;
				return "";
			});
			position += line.length + 1;
		}
		this.textarea.value = text.substring(0, toggle_start) + toggle_lines.join("\n") + text.substring(toggle_end);
		this.textarea.selectionStart = new_selection_start;
		this.textarea.selectionEnd = new_selection_end;
		this.requestTickAnimationFrame();
		this.postWorkerUpdateText(false);
	}
	insertValue(value, start, end) {
		start ??= this.textarea.selectionStart;
		end ??= this.textarea.selectionEnd;
		const text = this.textarea.value;
		this.textarea.value = text.substring(0, start) + value + text.substring(end);
		this.textarea.selectionStart = this.textarea.selectionEnd = start + value.length;
		this.requestTickAnimationFrame();
		this.postWorkerUpdateText(false);
	}
	applySuggestionWordToTextarea(word) {
		const text = this.textarea.value;
		let start = this.textarea.selectionStart;
		let end = this.textarea.selectionEnd;
		for (let i = start - 1; 0 <= i && !isDelimiter(text.charAt(i)); start = i--);
		for (; end < text.length && !isDelimiter(text.charAt(end)); end++);
		const insert_word = word + (text.charAt(end) !== "," ? "," : "");
		this.insertValue(insert_word, start, end);
	}
	addSuggestionViewEvent() {
		this.suggestionViewSelect.addEventListener("keydown", this.suggestionViewListenerKeydown);
		document.addEventListener("click", this.suggestionViewListenerClick);
	}
	removeSuggestionViewEvent() {
		this.suggestionViewSelect.removeEventListener("keydown", this.suggestionViewListenerKeydown);
		document.removeEventListener("click", this.suggestionViewListenerClick);
	}
	handleSuggestionViewKeyDown(event) {
		if (event.defaultPrevented || event.repeat) return;
		else if (event.key === "Escape") {
			this.hiddenSuggestionView();
			this.textarea.focus();
			event.preventDefault();
		} else if (event.key === "Backspace") {
			this.hiddenSuggestionView();
			this.textarea.focus();
			event.preventDefault();
			event.stopPropagation();
		} else if (event.key === "Enter") {
			const word = this.getSelectSuggestionWord();
			if (word) {
				this.hiddenSuggestionView();
				this.textarea.focus();
				this.applySuggestionWordToTextarea(word);
				event.preventDefault();
			}
		}
	}
	handleSuggestionViewClick(event) {
		if (this.suggestionView.contains(event.target)) {} else this.hiddenSuggestionView();
	}
	isVisibleSuggestionView() {
		return this.suggestionView.style.visibility === "visible";
	}
	visibleSuggestionView() {
		if (this.highlightViewCode.querySelector("span.caret")) {
			if (!this.isVisibleSuggestionView()) this.suggestionView.style.visibility = "visible";
		}
	}
	reflectCaretPositionToSuggestionView() {
		const caret = this.highlightViewCode.querySelector("span.caret");
		if (caret) {
			this.suggestionView.style.top = caret.offsetTop + caret.offsetHeight - this.textarea.scrollTop + "px";
			this.suggestionView.style.left = caret.offsetLeft - this.textarea.scrollLeft + "px";
		}
	}
	hiddenSuggestionView() {
		if (this.isVisibleSuggestionView()) this.suggestionView.style.visibility = "hidden";
	}
	focusSuggestionView() {
		if (this.isVisibleSuggestionView()) {
			this.suggestionViewSelect.selectedIndex = 0;
			this.suggestionViewSelect.focus();
		}
	}
	getSelectSuggestionWord() {
		if (0 <= this.suggestionViewSelect.selectedIndex) return this.suggestionViewSelect.options[this.suggestionViewSelect.selectedIndex].value;
		return null;
	}
	handleWorkerMessage(event) {
		this.linenoViewCode.innerHTML = event.data.linenoViewHtml;
		this.highlightViewCode.innerHTML = event.data.highlightViewHtml;
		if (0 < event.data.suggestionViewHtml.length) {
			this.suggestionViewSelect.innerHTML = event.data.suggestionViewHtml;
			this.suggestionViewSelect.selectedIndex = -1;
			this.visibleSuggestionView();
			window.requestAnimationFrame(() => {
				this.reflectCaretPositionToSuggestionView();
			});
		} else this.hiddenSuggestionView();
	}
	postWorkerUpdateText(suggestion) {
		this.worker.port.postMessage({
			suggestion,
			selectionStart: this.textarea.selectionStart,
			selectionEnd: this.textarea.selectionEnd,
			text: this.textarea.value
		});
	}
	createContainer() {
		const element = document.createElement("div");
		element.className = editor_module_default.container;
		return element;
	}
	createBodyContainer(parent) {
		const element = document.createElement("div");
		element.className = editor_module_default.bodyContainer;
		parent.appendChild(element);
		return element;
	}
	createLinenoView(parent) {
		const element = document.createElement("div");
		element.className = editor_module_default.linenoView;
		parent.appendChild(element);
		return element;
	}
	createLinenoViewPre(parent) {
		const element = document.createElement("pre");
		parent.appendChild(element);
		return element;
	}
	createLinenoViewCode(parent) {
		const element = document.createElement("code");
		parent.appendChild(element);
		return element;
	}
	createHighlightView(parent) {
		const element = document.createElement("div");
		element.className = editor_module_default.highlightView;
		parent.appendChild(element);
		return element;
	}
	createHighlightViewPre(parent) {
		const element = document.createElement("pre");
		parent.appendChild(element);
		return element;
	}
	createHighlightViewCode(parent) {
		const element = document.createElement("code");
		parent.appendChild(element);
		return element;
	}
	createTextarea(parent) {
		const element = document.createElement("textarea");
		element.className = "comfy-multiline-input";
		parent.appendChild(element);
		return element;
	}
	createSuggestionView(parent) {
		const element = document.createElement("div");
		element.className = editor_module_default.suggestionView;
		parent.appendChild(element);
		return element;
	}
	createSuggestionViewSelect(parent) {
		const element = document.createElement("select");
		element.setAttribute("size", "10");
		parent.appendChild(element);
		return element;
	}
};
//#endregion
//#region src/index.ts
app.registerExtension({
	name: "yossq236.TagPromptNode",
	setup: async (_app) => {
		const link = document.createElement("link");
		link.rel = "stylesheet";
		link.type = "text/css";
		link.href = "/extensions/tag_prompt/assets/index.css";
		document.head.appendChild(link);
	},
	getCustomWidgets: async (_app) => {
		return { MY_STRING: (node, inputName, inputData, _app, _widgetName) => {
			const editor = new Editor();
			const widget = node.addDOMWidget(inputName, inputData[0], editor.element, {
				getValue: () => {
					return editor.state;
				},
				setValue: (newValue) => {
					editor.state = newValue;
				}
			});
			const originalOnRemove = widget.onRemove;
			widget.onRemove = () => {
				editor.unmount();
				originalOnRemove?.call(widget);
			};
			return {
				widget,
				minWidth: 400,
				minHeight: 300
			};
		} };
	}
});
//#endregion
