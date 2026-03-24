import EditorWorker from './editorWorker.ts?sharedworker&url';
import EditorStyle from './assets/editor.module.css';
import { isDelimiter, el } from './utils.ts';

interface EditorState {
    text: string;
    selectionStart: number;
    selectionEnd: number;
    scrollTop: number;
    scrollLeft: number;
}

interface SizeState {
    width: number;
    height: number;
    dirty: boolean;
}

interface ScrollState {
    top: number;
    left: number;
    dirty_top: boolean;
    dirty_left: boolean;
}

interface Cursor {
    position: number;
    column: number;
    row: number;
}

interface RowPosition {
    top: number;
    bottom: number;
}

interface HeaderViewState {
    content: string;
    dirty: boolean;
}

interface LinenoViewState {
    content: string;
    rows: Array<RowPosition>;
    dirty: boolean;
}

interface HighlightViewState {
    content: string;
    rows: Array<string>;
    dirty: boolean;
}

function isValidEditorState(obj: unknown): obj is EditorState {
    return (obj !== null) && (typeof obj === 'object') && ('text' in obj) && ('selectionStart' in obj) && ('selectionEnd' in obj) && ('scrollTop' in obj) && ('scrollLeft' in obj);
}

function getCursor(text: string, position: number): Cursor {
    const target = text.substring(0, position);
    const row = (target.match(/\n/g) || []).length;
    const column = position - target.lastIndexOf('\n') - 1;
    return {position: position, row: row, column};
}

// function getWord(text: string, position: number): string {
//     let word_start = position;
//     let word_end = position;
//     for (let i = position - 1; 0 <= i && !isDelimiter(text.charAt(i)); word_start = i--);
//     return text.substring(word_start, word_end);
// }

export class Editor {
    // containor
    private container: HTMLElement;
    // header view
    private headerView: HTMLElement;
    private headerViewSelect: HTMLSelectElement;
    private headerViewListenerChange: (event: Event) => void;
    private headerViewState: HeaderViewState;
    // lineno view
    private linenoView: HTMLElement;
    private linenoViewPre: HTMLElement;
    private linenoViewCode: HTMLElement;
    private linenoViewState: LinenoViewState;
    // body containor
    private bodyContainer: HTMLElement;
    // highlight view
    private highlightView: HTMLElement;
    private highlightViewPre: HTMLElement;
    private highlightViewCode: HTMLElement;
    private highlightViewState: HighlightViewState;
    // textarea
    private textarea: HTMLTextAreaElement;
    private textareaListenerKeydown: (event: KeyboardEvent) => void;
    private textareaListenerInput: (event: Event) => void;
    private textareaListenerScroll: (event: Event) => void;
    private textareaResizeObserver: ResizeObserver;
    private textareaListenerSelectionchange: (event: Event) => void;
    private textareaScrollSize: SizeState;
    private textareaClientSize: SizeState;
    private textareaScrollPosition: ScrollState;
    private textareaSelectionStart: Cursor;
    private textareaSelectionEnd: Cursor;
    // suggestion view
    private suggestionView: HTMLElement;
    private suggestionViewSelect: HTMLSelectElement;
    private suggestionViewListenerKeydown: (event: KeyboardEvent) => void;
    private suggestionViewListenerClick: (event: MouseEvent) => void;
    // worker
    private worker: SharedWorker;
    // tick animation frame
    private tickAnimationFrameID: number;

    // constructor

    constructor() {
        // create container
        this.container = el('div', EditorStyle.container, undefined, [
            // create header view
            (this.headerView = el('div', EditorStyle.headerView, undefined, [
                (this.headerViewSelect = el('select')),
            ])),
            // create lineno view
            (this.linenoView = el('div', EditorStyle.linenoView, undefined, [
                (this.linenoViewPre = el('pre', undefined, undefined, [
                    (this.linenoViewCode = el('code')),
                ])),
            ])),
            // create body container
            (this.bodyContainer = el('div', EditorStyle.bodyContainer, undefined, [
                // create highlight view
                (this.highlightView = el('div', EditorStyle.highlightView, undefined, [
                    (this.highlightViewPre = el('pre', undefined, undefined, [
                        (this.highlightViewCode = el('code')),
                    ])),
                ])),
                // create textarea
                (this.textarea = el('textarea', 'comfy-multiline-input', {"data-capture-wheel": "true"})), // It seems data-capture-wheel="true" is required to capture wheel events in Node 2.0.
                // create suggestion view
                (this.suggestionView = el('div', EditorStyle.suggestionView, undefined, [
                    (this.suggestionViewSelect = el('select', undefined, {'size': '10'})),
                ])),
            ])),
        ]);
        // initialize container
        // initialize header view
        this.headerViewListenerChange = e => this.handleHeaderViewChange(e);
        this.headerViewState = {content: '', dirty: false};
        // initialize lineno view
        this.linenoViewState = {content: '', rows: new Array<RowPosition>, dirty: false};
        // initialize body container
        // initialize highlight view
        this.highlightViewState = {content: '', rows: new Array<string>, dirty: false};
        // initialize textarea
        this.textareaListenerKeydown = e => this.handleTextareaKeyDown(e);
        this.textareaListenerInput = e => this.handleTextareaInput(e);
        this.textareaListenerScroll = e => this.handleTextareaScroll(e);
        this.textareaResizeObserver = new ResizeObserver(e => this.handleTextareaReSize(e));
        this.textareaListenerSelectionchange = e => this.handleTextareaSelectionchange(e);
        this.textareaScrollSize = {width: 0, height: 0, dirty: false};
        this.textareaClientSize = {width: 0, height: 0, dirty: false};
        this.textareaScrollPosition = {top: 0, left: 0, dirty_top: false, dirty_left: false};
        this.textareaSelectionStart = {position: 0, column: 0, row: 0};
        this.textareaSelectionEnd = {position: 0, column: 0, row: 0};
        // initialize suggestion view
        this.suggestionViewListenerKeydown = e => this.handleSuggestionViewKeyDown(e);
        this.suggestionViewListenerClick = e => this.handleSuggestionViewClick(e);
        // initialize worker
        this.worker = new SharedWorker(EditorWorker);
        this.worker.port.onmessage = e => this.handleWorkerMessage(e);
        // initialize animation frame
        this.tickAnimationFrameID = 0;
        // add event header view
        this.addHeaderViewEvent();
        // add event textarea
        this.addTextareaEvent();
        // add event suggestion view
        this.addSuggestionViewEvent();
    }

    // property

    get element(): HTMLElement {
        return this.container;
    }

    get state(): string {
        return JSON.stringify({
            text: this.textarea.value,
            selectionStart: this.textarea.selectionStart,
            selectionEnd: this.textarea.selectionEnd,
            scrollTop: this.textareaScrollPosition.top,
            scrollLeft: this.textareaScrollPosition.left,
        });
    }
    set state(newValue: string) {
        let stateObj: EditorState = {
            text: newValue,
            selectionStart: 0,
            selectionEnd: 0,
            scrollTop: 0,
            scrollLeft: 0,
        };
        try {
            const parseObj = JSON.parse(newValue);
            if (isValidEditorState(parseObj)) {
                stateObj = parseObj;
            }
        } catch {}
        const change_text = (this.textarea.value !== stateObj.text);
        this.textarea.value = stateObj.text;
        this.textarea.selectionStart = stateObj.selectionStart;
        this.textarea.selectionEnd = stateObj.selectionEnd;
        if (this.textareaScrollPosition.top !== stateObj.scrollTop || this.textareaScrollPosition.left !== stateObj.scrollLeft) {
            window.requestAnimationFrame(() => {
                this.textarea.scrollTop = stateObj.scrollTop;
                this.textarea.scrollLeft = stateObj.scrollLeft;
            });
        }
        if (change_text) {
            this.postWorkerUpdate();
        }
    }

    //  remove

    public remove() {
        // close worker
        this.worker.port.close();
        this.worker.port.onmessage = null;
        // remove event suggestion view
        this.removeSuggestionViewEvent();
        // remove event textarea
        this.removeTextareaEvent();
        // remove event header view
        this.removeHeaderViewEvent();
        // remove suggestion view
        this.suggestionViewSelect.parentElement?.removeChild(this.suggestionViewSelect);
        this.suggestionView.parentElement?.removeChild(this.suggestionView);
        // remove textarea
        this.textarea.parentElement?.removeChild(this.textarea);
        // remove highlight view
        this.highlightViewCode.parentElement?.removeChild(this.highlightViewCode);
        this.highlightViewPre.parentElement?.removeChild(this.highlightViewPre);
        this.highlightView.parentElement?.removeChild(this.highlightView);
        // remove body container
        this.bodyContainer.parentElement?.removeChild(this.bodyContainer);
        // remove highlight view
        this.linenoViewCode.parentElement?.removeChild(this.linenoViewCode);
        this.linenoViewPre.parentElement?.removeChild(this.linenoViewPre);
        this.linenoView.parentElement?.removeChild(this.linenoView);
        // umount header view
        this.headerViewSelect.parentElement?.removeChild(this.headerViewSelect);
        this.headerView.parentElement?.removeChild(this.headerView);
        // umount container
        this.container.parentElement?.removeChild(this.container);
    }

    // animation frame

    private requestTickAnimationFrame(): void {
        if (this.tickAnimationFrameID === 0) {
            this.tickAnimationFrameID = window.requestAnimationFrame((t: DOMHighResTimeStamp) => this.handleTickAnimationFrame(t));
        }
    }

    private handleTickAnimationFrame(_time: DOMHighResTimeStamp): void {
        this.tickAnimationFrameID = 0;
        // textarea
        this.storeScrollSize();
        this.storeClientSize();
        this.storeScrollPosition();
        // header view
        this.reflectTextContentToHeaderView();
        // lineno view
        this.reflectScrollSizeToLinenoView();
        this.reflectClientSizeToLinenoView();
        this.reflectScrollPositionToLinenoView();
        this.reflectTextContentToLinenoView();
        // highlight view
        this.reflectScrollSizeToHighlightView();
        this.reflectClientSizeToHighlightView();
        this.reflectScrollPositionToHighlightView();
        this.reflectTextContentToHighlightView();
        // end
        this.reflectedScrollSize();
        this.reflectedClientSize();
        this.reflectedScrollPosition();
    }

    // header view

    private addHeaderViewEvent() {
        this.headerViewSelect.addEventListener('change', this.headerViewListenerChange);
    }

    private removeHeaderViewEvent() {
        this.headerViewSelect.removeEventListener('change', this.headerViewListenerChange);
    }

    private handleHeaderViewChange(event: Event): void {
        const row = parseInt((event.target as HTMLOptionElement).value);
        if (0 <= row && row < this.linenoViewState.rows.length) {
            const top = this.linenoViewState.rows[row].top;
            window.requestAnimationFrame(() => {
                this.textarea.scrollTop = top;
            });
        }
    }

    private reflectTextContentToHeaderView() {
        if (this.headerViewState.dirty) {
            const selected = this.headerViewSelect.selectedIndex;
            this.headerViewSelect.innerHTML = this.headerViewState.content;
            this.headerViewSelect.selectedIndex = selected;
            this.headerViewState.dirty = false;
        }
    }

    // lineno view

    private reflectScrollSizeToLinenoView() {
        if (this.textareaScrollSize.dirty) {
            this.linenoViewPre.style.height = this.textareaScrollSize.height + 'px';
        }
    }

    private reflectClientSizeToLinenoView() {
        if (this.textareaClientSize.dirty) {
            this.linenoView.style.height = this.textareaClientSize.height + 'px';
        }
    }

    private reflectScrollPositionToLinenoView() {
        if (this.textareaScrollPosition.dirty_top) {
            this.linenoView.scrollTop = this.textareaScrollPosition.top;
        }
    }

    private reflectTextContentToLinenoView() {
        if (this.linenoViewState.dirty) {
            this.linenoViewCode.innerHTML = this.linenoViewState.content;
            const spans = this.linenoViewCode.querySelectorAll('span');
            const spansLen = spans.length;
            const result = new Array<RowPosition>;
            for (let i = 0; i < spansLen; i++) {
                const e = spans[i];
                result.push({top: e.offsetTop, bottom: e.offsetTop + e.offsetHeight});
            }
            this.linenoViewState.rows = result;
            this.linenoViewState.dirty = false;
        }
    }

    // highlight view 

    private reflectScrollSizeToHighlightView() {
        if (this.textareaScrollSize.dirty) {
            this.highlightViewPre.style.width = this.textareaScrollSize.width + 'px';
        }
    }

    private reflectClientSizeToHighlightView() {
        if (this.textareaClientSize.dirty) {
            this.highlightView.style.width = this.textareaClientSize.width + 'px';
            this.highlightView.style.height = this.textareaClientSize.height + 'px';
        }
    }

    private reflectScrollPositionToHighlightView() {
        if (this.textareaScrollPosition.dirty_left) {
            this.highlightView.scrollLeft = this.textareaScrollPosition.left;
        }
    }

    private reflectTextContentToHighlightView() {
        if (this.textareaScrollPosition.dirty_top || this.textareaClientSize.dirty || this.highlightViewState.dirty) {
            const viewportTop = this.textareaScrollPosition.top;
            const vireportBottom = viewportTop + this.textareaClientSize.height;
            const row_begin = Math.max(0, this.linenoViewState.rows.findIndex(v => viewportTop < v.bottom));
            const row_end = Math.max(0, this.linenoViewState.rows.findLastIndex(v => v.top < vireportBottom));
            this.highlightViewCode.innerHTML = this.highlightViewState.rows.filter((_,i) => row_begin <= i && i <= row_end).join('\n');
            this.highlightView.scrollTop = (this.linenoViewState.rows.length === 0) ? 0 : viewportTop - this.linenoViewState.rows[row_begin].top;
            this.highlightViewState.dirty = false;
        }
    }

    // textarea

    private addTextareaEvent() {
        this.textarea.addEventListener('keydown', this.textareaListenerKeydown);
        this.textarea.addEventListener('input', this.textareaListenerInput);
        this.textarea.addEventListener('scroll', this.textareaListenerScroll);
        this.textareaResizeObserver.observe(this.textarea);
        this.textarea.addEventListener('selectionchange', this.textareaListenerSelectionchange);
    }

    private removeTextareaEvent() {
        this.textarea.removeEventListener('keydown', this.textareaListenerKeydown);
        this.textarea.removeEventListener('input', this.textareaListenerInput);
        this.textarea.removeEventListener('scroll', this.textareaListenerScroll);
        this.textareaResizeObserver.unobserve(this.textarea);
        this.textareaResizeObserver.disconnect();
        this.textarea.removeEventListener('selectionchange', this.textareaListenerSelectionchange);
    }

    private handleTextareaKeyDown(event: KeyboardEvent): void {
        if (event.defaultPrevented || event.repeat) {
            return;
        } else if (event.ctrlKey || event.metaKey) {
            if (event.key === '/') {
                this.toggleComment();
                event.preventDefault();
            }
        } else if (this.isVisibleSuggestionView()) {
            if (event.key === 'Tab') {
                this.hiddenSuggestionView();
                this.insertValue('    ');
                event.preventDefault();
            } else if (event.key === 'Escape' || event.key === 'ArrowLeft' || event.key === 'ArrowRight' || event.key === 'ArrowUp') {
                this.hiddenSuggestionView();
            } else if (event.key === 'ArrowDown') {
                this.focusSuggestionView();
                event.preventDefault();
            } else if (event.key === 'Enter') {
                const word = this.getSelectSuggestionWord(0);
                if (word) {
                    this.hiddenSuggestionView();
                    this.textarea.focus();
                    this.applySuggestionWordToTextarea(word);
                    event.preventDefault();
                }
            }
        } else {
            if (event.key === 'Tab') {
                this.insertValue('    ');
                event.preventDefault();
            }
        }
    }

    private handleTextareaInput(_event: Event): void {
        this.requestTickAnimationFrame();
        this.postWorkerInput();
    }

    private handleTextareaScroll(_event: Event): void {
        this.requestTickAnimationFrame();
    }

    private handleTextareaReSize(_entries: Array<ResizeObserverEntry>): void {
        this.requestTickAnimationFrame();
    }

    private handleTextareaSelectionchange(_event: Event): void {
        const start = this.textarea.selectionStart;
        const end = this.textarea.selectionEnd;
        const text = this.textarea.value;
        const cursor_start = getCursor(text, start);
        const cursor_end = getCursor(text, end);
        const new_row_start = cursor_start.row;
        const new_row_end = (cursor_start.row < cursor_end.row && cursor_end.column === 0) ? cursor_end.row - 1 : cursor_end.row;
        const old_row_start = this.textareaSelectionStart.row;
        const old_row_end = (this.textareaSelectionStart.row < this.textareaSelectionEnd.row && this.textareaSelectionEnd.column === 0) ? this.textareaSelectionEnd.row - 1 : this.textareaSelectionEnd.row;
        if (new_row_start !== old_row_start || new_row_end !== old_row_end) {
            this.linenoViewCode.querySelectorAll('span:nth-of-type(n+'+(old_row_start+1)+'):nth-of-type(-n+'+(old_row_end+1)+')').forEach(e => e.classList.toggle(EditorStyle.selected, false));
            this.linenoViewCode.querySelectorAll('span:nth-of-type(n+'+(new_row_start+1)+'):nth-of-type(-n+'+(new_row_end+1)+')').forEach(e => e.classList.toggle(EditorStyle.selected, true));
            this.textareaSelectionStart = cursor_start;
            this.textareaSelectionEnd = cursor_end;
        }
    }

    private storeScrollSize() {
        const width = this.textarea.scrollWidth;
        const height = this.textarea.scrollHeight;
        if (this.textareaScrollSize.width !== width || this.textareaScrollSize.height !== height) {
            this.textareaScrollSize.width = width;
            this.textareaScrollSize.height = height;
            this.textareaScrollSize.dirty = true;
        }
    }

    private reflectedScrollSize() {
        this.textareaScrollSize.dirty = false;
    }

    private storeClientSize() {
        const width = this.textarea.clientWidth;
        const height = this.textarea.clientHeight;
        if (this.textareaClientSize.width !== width || this.textareaClientSize.height !== height) {
            this.textareaClientSize.width = width;
            this.textareaClientSize.height = height;
            this.textareaClientSize.dirty = true;
        }
    }

    private reflectedClientSize() {
        this.textareaClientSize.dirty = false;
    }

    private storeScrollPosition() {
        const top = this.textarea.scrollTop;
        const left = this.textarea.scrollLeft;
        if (this.textareaScrollPosition.top !== top) {
            this.textareaScrollPosition.top = top;
            this.textareaScrollPosition.dirty_top = true;
        }
        if (this.textareaScrollPosition.left !== left) {
            this.textareaScrollPosition.left = left;
            this.textareaScrollPosition.dirty_left = true;
        }
    }

    private reflectedScrollPosition() {
        this.textareaScrollPosition.dirty_top = false;
        this.textareaScrollPosition.dirty_left = false;
    }

    private toggleComment() {
        const selection_start = this.textarea.selectionStart;
        const selection_end = this.textarea.selectionEnd;
        const text = this.textarea.value;
        const toggle_start = [text.substring(0, selection_start).lastIndexOf('\n')].reduce((a,v) => (v !== -1) ? v + 1 : a, 0);
        const toggle_end = [text.substring(0, selection_end).lastIndexOf('\n'), text.indexOf('\n', selection_end)].reduce((a,v) => (v !== -1 && toggle_start < v && (selection_end - 1) <= v && v < a) ? v : a, text.length);
        const toggle_text = text.substring(toggle_start, toggle_end);
        const toggle_lines = toggle_text.split('\n');
        const commentout = toggle_lines.reduce((a,v) => (a || !v.trimStart().startsWith('//')), false);
        const indent = toggle_lines.map(v => v.replace(/^(\s*)(.*)/, '$1').length).reduce((a,v,i) => (i === 0 || v < a) ? v : a, 0);
        let new_selection_start = selection_start;
        let new_selection_end = selection_end;
        if (commentout) {
            for (let i = 0, position = toggle_start; i < toggle_lines.length; i++) {
                const line = toggle_lines[i];
                toggle_lines[i] = ' '.repeat(indent) + '// ' + line.substring(indent);
                if (position < selection_start) {
                    new_selection_start += 3;
                }
                if (position < selection_end) {
                    new_selection_end += 3;
                }
                position += line.length + 1;
            }
        } else {
            for (let i = 0, position = toggle_start; i < toggle_lines.length; i++) {
                const line = toggle_lines[i];
                toggle_lines[i] = line.replace(/\/\/\s?/,m => {
                    if (position < selection_start) {
                        new_selection_start -= m.length;
                    }
                    if (position < selection_end) {
                        new_selection_end -= m.length;
                    }
                    return '';
                });
                position += line.length + 1;
            }
        }
        this.textarea.value = text.substring(0, toggle_start) + toggle_lines.join('\n') + text.substring(toggle_end);
        this.textarea.selectionStart = new_selection_start;
        this.textarea.selectionEnd = new_selection_end;
        this.requestTickAnimationFrame();
        this.postWorkerUpdate();
    }

    private insertValue(value: string, start?: number, end?: number) {
        start ??= this.textarea.selectionStart;
        end ??= this.textarea.selectionEnd;
        const text = this.textarea.value;
        this.textarea.value = text.substring(0, start) + value + text.substring(end);
        this.textarea.selectionStart = this.textarea.selectionEnd = start + value.length;
        this.requestTickAnimationFrame();
        this.postWorkerUpdate();
    }

    private applySuggestionWordToTextarea(word: string) {
        const text = this.textarea.value;
        let start = this.textarea.selectionStart;
        let end = this.textarea.selectionEnd;
        for (let i = start - 1;0 <= i && !isDelimiter(text.charAt(i)); start = i--);
        for (;end < text.length && !isDelimiter(text.charAt(end)); end++);
        const insert_word = word + ((text.charAt(end) !== ',') ? ',' : '');
        this.insertValue(insert_word, start, end);
    }

    // suggestion

    private addSuggestionViewEvent() {
        this.suggestionViewSelect.addEventListener('keydown', this.suggestionViewListenerKeydown);
        document.addEventListener('click', this.suggestionViewListenerClick);
    }

    private removeSuggestionViewEvent() {
        this.suggestionViewSelect.removeEventListener('keydown', this.suggestionViewListenerKeydown);
        document.removeEventListener('click', this.suggestionViewListenerClick);
    }

    private handleSuggestionViewKeyDown(event: KeyboardEvent): void {
        if (event.defaultPrevented || event.repeat) {
            return;
        } else if (event.key === 'Escape') {
            this.hiddenSuggestionView();
            this.textarea.focus();
            event.preventDefault();
        } else if (event.key === 'Backspace') {
            this.hiddenSuggestionView();
            this.textarea.focus();
            event.preventDefault();
            event.stopPropagation();
        } else if (event.key === 'Enter') {
            const word = this.getSelectSuggestionWord();
            if (word) {
                this.hiddenSuggestionView();
                this.textarea.focus();
                this.applySuggestionWordToTextarea(word);
                event.preventDefault();
            }
        }
    }

    private handleSuggestionViewClick(event: MouseEvent):void {
        if (this.suggestionView.contains(event.target as Node)) {
        } else {
            this.hiddenSuggestionView();
        }
    }

    private reflectCaretPositionToSuggestionView() {
        const caret = this.highlightViewCode.querySelector('span.caret') as HTMLSpanElement;
        if (caret) {
            this.suggestionView.style.top = (caret.offsetTop + caret.offsetHeight - this.highlightView.scrollTop) + 'px';
            this.suggestionView.style.left = (caret.offsetLeft - this.highlightView.scrollLeft) + 'px';
        }
    }

    private isVisibleSuggestionView(): boolean {
        return this.suggestionView.style.visibility === 'visible';
    }

    private visibleSuggestionView() {
        const caret = this.highlightViewCode.querySelector('span.caret') as HTMLSpanElement;
        if (caret) {
            if (!this.isVisibleSuggestionView()) {
                this.suggestionView.style.visibility = 'visible';
            }
        }
    }

    private hiddenSuggestionView() {
        if (this.isVisibleSuggestionView()) {
            this.suggestionView.style.visibility = 'hidden';
        }
    }

    private focusSuggestionView() {
        if (this.isVisibleSuggestionView()) {
            this.suggestionViewSelect.selectedIndex = 0;
            this.suggestionViewSelect.focus();
        }
    }

    private getSelectSuggestionWord(select?: number): string | null {
        select ??= this.suggestionViewSelect.selectedIndex;
        if (0 <= select && select < this.suggestionViewSelect.options.length) {
            return this.suggestionViewSelect.options[select].value;
        }
        return null;
    }

    // worker

    private handleWorkerMessage(event: MessageEvent<any>):any {
        // header view
        if (this.headerViewState.content !== event.data.headerViewHtml) {
            this.headerViewState.content = event.data.headerViewHtml;
            this.headerViewState.dirty = true;
            this.requestTickAnimationFrame();
        }
        // lineno view
        if (this.linenoViewState.content !== event.data.linenoViewHtml) {
            this.linenoViewState.content = event.data.linenoViewHtml;
            this.linenoViewState.dirty = true;
            this.requestTickAnimationFrame();
        }
        // highlight view
        if (this.highlightViewState.content !== event.data.highlightViewHtml) {
            this.highlightViewState.content = event.data.highlightViewHtml;
            this.highlightViewState.rows = event.data.highlightViewHtml.split('\n');
            this.highlightViewState.dirty = true;
            this.requestTickAnimationFrame();
        }
        // suggestion view
        if (0 < event.data.suggestionViewHtml.length) {
            this.suggestionViewSelect.innerHTML = event.data.suggestionViewHtml;
            this.suggestionViewSelect.selectedIndex = -1;
            this.visibleSuggestionView();
            window.requestAnimationFrame(() => {
                this.reflectCaretPositionToSuggestionView();
            });
        } else {
            this.hiddenSuggestionView();
        }
    }

    private postWorkerInput() {
        const start = this.textarea.selectionStart;
        const end = this.textarea.selectionEnd;
        const text = this.textarea.value;
        this.worker.port.postMessage({
            suggestion: true,
            selectionStart: start,
            selectionEnd: end,
            text: text
        });
    }

    private postWorkerUpdate() {
        this.worker.port.postMessage({
            suggestion: false,
            selectionStart: this.textarea.selectionStart,
            selectionEnd: this.textarea.selectionEnd,
            text: this.textarea.value
        });
    }
}
