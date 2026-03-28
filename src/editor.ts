import EditorWorker from './editorWorker?sharedworker&url';
import EditorStyles from './assets/editor.module.css';
import { isDelimiter, el, getCursor } from './utils';
import { MAX_SUGGESTION_VIEW_ROW } from './constants';

interface EditorState {
    text: string;
    selectionStart: number;
    selectionEnd: number;
    scrollTop: number;
    scrollLeft: number;
}

interface ContentState {
    value: string;
    dirty: boolean;
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

interface SelectionState {
    position: number;
    column: number;
    row: number;
    dirty: boolean;
}

interface HeaderViewState {
    content: string;
    dirty: boolean;
}

interface RowPosition {
    top: number;
    bottom: number;
}

interface LinenoViewState {
    content: string;
    rows: Array<RowPosition>;
    dirty: boolean;
}

interface HighlightViewState {
    content: string;
    rows: Array<string>;
    viewport_top: number;
    viewport_bottom: number;
    row_start: number;
    row_end: number;
    dirty: boolean;
}

interface SuggestionViewState {
    content: string;
    visible: boolean;
    dirty: boolean;
}

function isValidEditorState(obj: unknown): obj is EditorState {
    return (obj !== null) && (typeof obj === 'object') && ('text' in obj) && ('selectionStart' in obj) && ('selectionEnd' in obj) && ('scrollTop' in obj) && ('scrollLeft' in obj);
}

export class Editor extends HTMLElement {
    // containor
    private container: HTMLElement | undefined;
    // header view
    private headerView: HTMLElement | undefined;
    private headerViewSelect: HTMLSelectElement | undefined;
    private headerViewListenerChange: (event: Event) => void;
    private headerViewState: HeaderViewState;
    // lineno view
    private linenoView: HTMLElement | undefined;
    private linenoViewPre: HTMLElement | undefined;
    private linenoViewCode: HTMLElement | undefined;
    private linenoViewState: LinenoViewState;
    // body containor
    private bodyContainer: HTMLElement | undefined;
    // highlight view
    private highlightView: HTMLElement | undefined;
    private highlightViewPre: HTMLElement | undefined;
    private highlightViewCode: HTMLElement | undefined;
    private highlightViewState: HighlightViewState;
    // textarea
    private textarea: HTMLTextAreaElement | undefined;
    private textareaListenerKeydown: (event: KeyboardEvent) => void;
    private textareaListenerInput: (event: InputEvent) => void;
    private textareaListenerScroll: (event: Event) => void;
    private textareaResizeObserver: ResizeObserver;
    private textareaListenerSelectionchange: (event: Event) => void;
    private textareaContent: ContentState;
    private textareaSelectionStart: SelectionState;
    private textareaSelectionEnd: SelectionState;
    private textareaScrollSize: SizeState;
    private textareaClientSize: SizeState;
    private textareaScrollPosition: ScrollState;
    // suggestion view
    private suggestionView: HTMLElement | undefined;
    private suggestionViewSelect: HTMLSelectElement | undefined;
    private suggestionViewListenerKeydown: (event: KeyboardEvent) => void;
    private suggestionViewListenerClick: (event: MouseEvent) => void;
    private suggestionViewState: SuggestionViewState;
    // worker
    private worker: SharedWorker | undefined;
    // tick animation frame
    private tickAnimationFrameID: number;

    // constructor

    constructor() {
        super();
        // initialize container
        // initialize header view
        this.headerViewListenerChange = e => this.handleHeaderViewChange(e);
        this.headerViewState = {content: '', dirty: false};
        // initialize lineno view
        this.linenoViewState = {content: '', rows: new Array<RowPosition>, dirty: false};
        // initialize body container
        // initialize highlight view
        this.highlightViewState = {content: '', rows: new Array<string>, viewport_top: 0, viewport_bottom: 0,row_start: 0, row_end: 0, dirty: false};
        // initialize textarea
        this.textareaListenerKeydown = e => this.handleTextareaKeyDown(e);
        this.textareaListenerInput = e => this.handleTextareaInput(e);
        this.textareaListenerScroll = e => this.handleTextareaScroll(e);
        this.textareaResizeObserver = new ResizeObserver(e => this.handleTextareaReSize(e));
        this.textareaListenerSelectionchange = e => this.handleTextareaSelectionchange(e);
        this.textareaContent = {value: '', dirty: true};
        this.textareaSelectionStart = {position: 0, column: 0, row: 0, dirty: false};
        this.textareaSelectionEnd = {position: 0, column: 0, row: 0, dirty: false};
        this.textareaScrollSize = {width: 0, height: 0, dirty: false};
        this.textareaClientSize = {width: 0, height: 0, dirty: false};
        this.textareaScrollPosition = {top: 0, left: 0, dirty_top: false, dirty_left: false};
        // initialize suggestion view
        this.suggestionViewListenerKeydown = e => this.handleSuggestionViewKeyDown(e);
        this.suggestionViewListenerClick = e => this.handleSuggestionViewClick(e);
        this.suggestionViewState = {content: '', visible: false, dirty: false};
        // initialize animation frame
        this.tickAnimationFrameID = 0;
    }

    // Web Components - lifecycle callbacks

    public connectedCallback() {
        // Implemented using Light DOM.
        // create container
        this.container = el('div', EditorStyles.container, undefined, [
            // create header view
            (this.headerView = el('div', EditorStyles.headerView, undefined, [
                (this.headerViewSelect = el('select')),
            ])),
            // create lineno view
            (this.linenoView = el('div', EditorStyles.linenoView, undefined, [
                (this.linenoViewPre = el('pre', undefined, undefined, [
                    (this.linenoViewCode = el('code')),
                ])),
            ])),
            // create body container
            (this.bodyContainer = el('div', EditorStyles.bodyContainer, undefined, [
                // create highlight view
                (this.highlightView = el('div', EditorStyles.highlightView, undefined, [
                    (this.highlightViewPre = el('pre', undefined, undefined, [
                        (this.highlightViewCode = el('code')),
                    ])),
                ])),
                // create textarea
                // - It seems data-capture-wheel="true" is required to capture wheel events in Node 2.0.
                (this.textarea = el('textarea', 'comfy-multiline-input', {"spellcheck": "false", "data-capture-wheel": "true"})),
                // create suggestion view
                (this.suggestionView = el('div', EditorStyles.suggestionView, undefined, [
                    (this.suggestionViewSelect = el('select', undefined, {'size': MAX_SUGGESTION_VIEW_ROW.toString()})),
                ])),
            ])),
        ]);
        // mount container
        this.appendChild(this.container);
        // start worker
        this.worker = new SharedWorker(EditorWorker);
        this.worker.port.onmessage = e => this.handleWorkerMessage(e);
        // initialize animation frame
        this.tickAnimationFrameID = 0;
        // add event header view
        this.addHeaderViewEvents();
        // add event textarea
        this.addTextareaEvents();
        // add event suggestion view
        this.addSuggestionViewEvents();
        // reflect textarea
        this.reflectContentToTextarea();
        this.reflectScrollPositionToTextarea();
    }

    public disconnectedCallback() {
        // close worker
        this.worker?.port.close();
        // remove event suggestion view
        this.removeSuggestionViewEvents();
        // remove event textarea
        this.removeTextareaEvents();
        // remove event header view
        this.removeHeaderViewEvents();
        // remove suggestion view
        this.suggestionViewSelect!.parentElement?.removeChild(this.suggestionViewSelect!);
        this.suggestionView!.parentElement?.removeChild(this.suggestionView!);
        // remove textarea
        this.textarea!.parentElement?.removeChild(this.textarea!);
        // remove highlight view
        this.highlightViewCode!.parentElement?.removeChild(this.highlightViewCode!);
        this.highlightViewPre!.parentElement?.removeChild(this.highlightViewPre!);
        this.highlightView!.parentElement?.removeChild(this.highlightView!);
        // remove body container
        this.bodyContainer!.parentElement?.removeChild(this.bodyContainer!);
        // remove lineno view
        this.linenoViewCode!.parentElement?.removeChild(this.linenoViewCode!);
        this.linenoViewPre!.parentElement?.removeChild(this.linenoViewPre!);
        this.linenoView!.parentElement?.removeChild(this.linenoView!);
        // remove header view
        this.headerViewSelect!.parentElement?.removeChild(this.headerViewSelect!);
        this.headerView!.parentElement?.removeChild(this.headerView!);
        // remove container
        this.container!.parentElement?.removeChild(this.container!);
    }

    // property

    get state(): string {
        return JSON.stringify({
            text: (this.textarea) ? this.textarea.value : this.textareaContent.value,
            selectionStart: (this.textarea) ? this.textarea.selectionStart : this.textareaSelectionStart.position,
            selectionEnd: (this.textarea) ? this.textarea.selectionEnd : this.textareaSelectionEnd.position,
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
        // store
        this.textareaContent.dirty = this.textareaContent.value !== stateObj.text;
        this.textareaContent.value = stateObj.text;
        const cursor_start = getCursor(stateObj.text, stateObj.selectionStart);
        const cursor_end = getCursor(stateObj.text, stateObj.selectionEnd);
        this.textareaSelectionStart.dirty = this.textareaSelectionStart.position !== cursor_start.position;
        this.textareaSelectionStart.position = cursor_start.position;
        this.textareaSelectionStart.column = cursor_start.column;
        this.textareaSelectionStart.row = cursor_start.row;
        this.textareaSelectionEnd.dirty = this.textareaSelectionEnd.position !== cursor_end.position;
        this.textareaSelectionEnd.position = cursor_end.position;
        this.textareaSelectionEnd.column = cursor_end.column;
        this.textareaSelectionEnd.row = cursor_end.row;
        this.textareaScrollPosition.dirty_top = this.textareaScrollPosition.top !== stateObj.scrollTop;
        this.textareaScrollPosition.dirty_left = this.textareaScrollPosition.left !== stateObj.scrollLeft;
        this.textareaScrollPosition.top = stateObj.scrollTop;
        this.textareaScrollPosition.left = stateObj.scrollLeft;
        // reflect
        this.reflectContentToTextarea();
        this.reflectScrollPositionToTextarea();
    }

    // header view

    private addHeaderViewEvents() {
        this.headerViewSelect!.addEventListener('change', this.headerViewListenerChange);
    }

    private removeHeaderViewEvents() {
        this.headerViewSelect!.removeEventListener('change', this.headerViewListenerChange);
    }

    private handleHeaderViewChange(event: Event): void {
        const row = parseInt((event.target as HTMLOptionElement).value);
        if (0 <= row && row < this.linenoViewState.rows.length) {
            const top = this.linenoViewState.rows[row].top;
            window.requestAnimationFrame(() => {
                this.textarea!.scrollTop = top;
            });
        }
    }

    private reflectContentToHeaderView() {
        if (this.headerViewState.dirty) {
            const selected = this.headerViewSelect!.selectedIndex;
            this.headerViewSelect!.innerHTML = this.headerViewState.content;
            this.headerViewSelect!.selectedIndex = selected;
            this.headerViewState.dirty = false;
        }
    }

    // lineno view

    private reflectScrollSizeToLinenoView() {
        if (this.textareaScrollSize.dirty && this.linenoViewPre) {
            this.linenoViewPre.style.height = this.textareaScrollSize.height + 'px';
        }
    }

    private reflectClientSizeToLinenoView() {
        if (this.textareaClientSize.dirty && this.linenoView) {
            this.linenoView.style.height = this.textareaClientSize.height + 'px';
        }
    }

    private reflectScrollPositionToLinenoView() {
        if (this.textareaScrollPosition.dirty_top && this.linenoView) {
            this.linenoView.scrollTop = this.textareaScrollPosition.top;
        }
    }

    private reflectContentToLinenoView() {
        const viewStateDirty = this.linenoViewState.dirty;
        const selectionDirty = this.linenoViewState.dirty || this.textareaSelectionStart.dirty || this.textareaSelectionEnd.dirty;
        if (viewStateDirty) {
            this.linenoViewCode!.innerHTML = this.linenoViewState.content;
            const spans = this.linenoViewCode!.querySelectorAll('span');
            const spansLen = spans.length;
            const result = new Array<RowPosition>;
            for (let i = 0; i < spansLen; i++) {
                const e = spans[i];
                result.push({top: e.offsetTop, bottom: e.offsetTop + e.offsetHeight});
            }
            this.linenoViewState.rows = result;
            this.linenoViewState.dirty = false;
        }
        if (selectionDirty) {
            const cursor_start = this.textareaSelectionStart;
            const cursor_end = this.textareaSelectionEnd;
            const row_start = cursor_start.row;
            const row_end = (cursor_start.row < cursor_end.row && cursor_end.column === 0) ? cursor_end.row - 1 : cursor_end.row;
            this.linenoViewCode!.querySelectorAll('span.'+EditorStyles.selected).forEach(e => e.classList.toggle(EditorStyles.selected, false));
            this.linenoViewCode!.querySelectorAll('span:nth-of-type(n+'+(row_start+1)+'):nth-of-type(-n+'+(row_end+1)+')').forEach(e => e.classList.toggle(EditorStyles.selected, true));
        }
    }

    // highlight view

    private reflectScrollSizeToHighlightView() {
        if (this.textareaScrollSize.dirty) {
            this.highlightViewPre!.style.width = this.textareaScrollSize.width + 'px';
        }
    }

    private reflectClientSizeToHighlightView() {
        if (this.textareaClientSize.dirty) {
            this.highlightView!.style.width = this.textareaClientSize.width + 'px';
            this.highlightView!.style.height = this.textareaClientSize.height + 'px';
        }
    }

    private reflectScrollPositionToHighlightView() {
        if (this.textareaScrollPosition.dirty_left) {
            this.highlightView!.scrollLeft = this.textareaScrollPosition.left;
        }
    }

    private reflectContentToHighlightView() {
        if (this.textareaClientSize.dirty || this.textareaScrollPosition.dirty_top || this.highlightViewState.dirty) {
            const viewport_top = this.textareaScrollPosition.top;
            const viewport_bottom = viewport_top + this.textareaClientSize.height;
            const row_start = Math.max(0, this.linenoViewState.rows.findIndex(v => viewport_top < v.bottom));
            const row_end = Math.max(0, this.linenoViewState.rows.findLastIndex(v => v.top < viewport_bottom));
            // update row_start, row_end
            if (this.highlightViewState.row_start !== row_start || this.highlightViewState.row_end !== row_end) {
                this.highlightViewState.row_start = row_start;
                this.highlightViewState.row_end = row_end;
                this.highlightViewState.dirty = true;
            }
            // update viewport_top, viewport_bottom
            if (this.highlightViewState.viewport_top !== viewport_top || this.highlightViewState.viewport_bottom !== viewport_bottom) {
                this.highlightViewState.viewport_top = viewport_top;
                this.highlightViewState.viewport_bottom = viewport_bottom;
            }
            // update content height
            const cur_content_height = this.highlightViewState.row_end - this.highlightViewState.row_start;
            const new_content_height = row_end - row_start;
            if (new_content_height !== cur_content_height) {
                this.highlightViewPre!.style.height = (((row_end < this.linenoViewState.rows.length) ? this.linenoViewState.rows[row_end].bottom : 0) - ((row_start < this.linenoViewState.rows.length) ? this.linenoViewState.rows[row_start].top : 0)) + 'px';
            }
            // update content scroll position top
            const cur_sctoll_top = this.highlightViewState.viewport_top - ((this.highlightViewState.row_start < this.linenoViewState.rows.length) ? this.linenoViewState.rows[this.highlightViewState.row_start].top : 0);
            const new_scroll_top = viewport_top - ((row_start < this.linenoViewState.rows.length) ? this.linenoViewState.rows[row_start].top : 0);
            if (new_scroll_top !== cur_sctoll_top) {
                this.highlightView!.scrollTop = new_scroll_top;
            }
            // update content
            if (this.highlightViewState.dirty) {
                this.highlightViewCode!.innerHTML = this.highlightViewState.rows.filter((_,i) => row_start <= i && i <= row_end).join('\n');
                this.highlightViewState.dirty = false;
            }
        }
    }

    // textarea

    private addTextareaEvents() {
        this.textarea!.addEventListener('keydown', this.textareaListenerKeydown);
        this.textarea!.addEventListener('input', this.textareaListenerInput);
        this.textarea!.addEventListener('scroll', this.textareaListenerScroll);
        this.textareaResizeObserver.observe(this.textarea!);
        this.textarea!.addEventListener('selectionchange', this.textareaListenerSelectionchange);
    }

    private removeTextareaEvents() {
        this.textarea!.removeEventListener('keydown', this.textareaListenerKeydown);
        this.textarea!.removeEventListener('input', this.textareaListenerInput);
        this.textarea!.removeEventListener('scroll', this.textareaListenerScroll);
        this.textareaResizeObserver.unobserve(this.textarea!);
        this.textareaResizeObserver.disconnect();
        this.textarea!.removeEventListener('selectionchange', this.textareaListenerSelectionchange);
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
                    this.textarea!.focus();
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

    private handleTextareaInput(_event: InputEvent): void {
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
        this.requestTickAnimationFrame();
    }

    private reflectContentToTextarea() {
        if (this.textareaContent.dirty) {
            if (this.textarea) {
                this.textarea.value = this.textareaContent.value;
                this.textarea.selectionStart = this.textareaSelectionStart.position;
                this.textarea.selectionEnd = this.textareaSelectionEnd.position;
                this.textareaContent.dirty = true;
                this.postWorkerUpdate();
            }
        }
    }

    private storeSelection() {
        const start = this.textarea!.selectionStart;
        const end = this.textarea!.selectionEnd;
        const text = this.textarea!.value;
        const cursor_start = getCursor(text, start);
        const cursor_end = getCursor(text, end);
        if (this.textareaSelectionStart.position !== cursor_start.position) {
            this.textareaSelectionStart.position = cursor_start.position;
            this.textareaSelectionStart.column = cursor_start.column;
            this.textareaSelectionStart.row = cursor_start.row;
            this.textareaSelectionStart.dirty = true;
        }
        if (this.textareaSelectionEnd.position !== cursor_end.position) {
            this.textareaSelectionEnd.position = cursor_end.position;
            this.textareaSelectionEnd.column = cursor_end.column;
            this.textareaSelectionEnd.row = cursor_end.row;
            this.textareaSelectionEnd.dirty = true;
        }
    }

    private reflectedSelection() {
        this.textareaSelectionStart.dirty = false;
        this.textareaSelectionEnd.dirty = false;
    }

    private storeScrollSize() {
        const width = this.textarea!.scrollWidth;
        const height = this.textarea!.scrollHeight;
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
        const width = this.textarea!.clientWidth;
        const height = this.textarea!.clientHeight;
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
        const top = this.textarea!.scrollTop;
        const left = this.textarea!.scrollLeft;
        if (this.textareaScrollPosition.top !== top) {
            this.textareaScrollPosition.top = top;
            this.textareaScrollPosition.dirty_top = true;
        }
        if (this.textareaScrollPosition.left !== left) {
            this.textareaScrollPosition.left = left;
            this.textareaScrollPosition.dirty_left = true;
        }
    }

    private reflectScrollPositionToTextarea() {
        if (this.textareaScrollPosition.dirty_top || this.textareaScrollPosition.dirty_left) {
            if (this.textarea) {
                window.requestAnimationFrame(() => {
                        this.textarea!.scrollTop = this.textareaScrollPosition.top;
                        this.textarea!.scrollLeft = this.textareaScrollPosition.left;
                });
            }
        }
    }

    private reflectedScrollPosition() {
        this.textareaScrollPosition.dirty_top = false;
        this.textareaScrollPosition.dirty_left = false;
    }

    private toggleComment() {
        const selection_start = this.textarea!.selectionStart;
        const selection_end = this.textarea!.selectionEnd;
        const text = this.textarea!.value;
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
        this.textarea!.value = text.substring(0, toggle_start) + toggle_lines.join('\n') + text.substring(toggle_end);
        this.textarea!.selectionStart = new_selection_start;
        this.textarea!.selectionEnd = new_selection_end;
        this.requestTickAnimationFrame();
        this.postWorkerUpdate();
    }

    private insertValue(value: string, start?: number, end?: number) {
        start ??= this.textarea!.selectionStart;
        end ??= this.textarea!.selectionEnd;
        const text = this.textarea!.value;
        this.textarea!.value = text.substring(0, start) + value + text.substring(end);
        this.textarea!.selectionStart = this.textarea!.selectionEnd = start + value.length;
        this.requestTickAnimationFrame();
        this.postWorkerUpdate();
    }

    private applySuggestionWordToTextarea(word: string) {
        const text = this.textarea!.value;
        let start = this.textarea!.selectionStart;
        let end = this.textarea!.selectionEnd;
        for (let i = start - 1;0 <= i && !isDelimiter(text.charAt(i)); start = i--);
        for (;end < text.length && !isDelimiter(text.charAt(end)); end++);
        const insert_word = word + ((text.charAt(end) !== ',') ? ',' : '');
        this.insertValue(insert_word, start, end);
    }

    // suggestion view

    private addSuggestionViewEvents() {
        this.suggestionViewSelect!.addEventListener('keydown', this.suggestionViewListenerKeydown);
        document.addEventListener('click', this.suggestionViewListenerClick);
    }

    private removeSuggestionViewEvents() {
        this.suggestionViewSelect!.removeEventListener('keydown', this.suggestionViewListenerKeydown);
        document.removeEventListener('click', this.suggestionViewListenerClick);
    }

    private handleSuggestionViewKeyDown(event: KeyboardEvent): void {
        if (event.defaultPrevented || event.repeat) {
            return;
        } else if (event.key === 'Escape') {
            this.hiddenSuggestionView();
            this.textarea!.focus();
            event.preventDefault();
        } else if (event.key === 'Backspace') {
            this.hiddenSuggestionView();
            this.textarea!.focus();
            event.preventDefault();
            event.stopPropagation();
        } else if (event.key === 'Enter') {
            const word = this.getSelectSuggestionWord();
            if (word) {
                this.hiddenSuggestionView();
                this.textarea!.focus();
                this.applySuggestionWordToTextarea(word);
                event.preventDefault();
            }
        }
    }

    private handleSuggestionViewClick(event: MouseEvent):void {
        if (this.suggestionView!.contains(event.target as Node)) {
        } else {
            this.hiddenSuggestionView();
        }
    }

    private reflectContentToSuggestionView() {
        const dirty = this.textareaContent.dirty || this.suggestionViewState.dirty;
        if (dirty) {
            const caret = this.highlightViewCode!.querySelector('span.caret') as HTMLSpanElement;
            if (this.suggestionViewState.visible && caret) {
                this.suggestionViewSelect!.innerHTML = this.suggestionViewState.content;
                if (this.suggestionView!.style.visibility !== 'visible') {
                    this.suggestionViewSelect!.selectedIndex = -1;
                    this.suggestionViewSelect!.scrollTop = 0;
                }
                this.suggestionView!.style.top = (caret.offsetTop + caret.offsetHeight - this.highlightView!.scrollTop) + 'px';
                this.suggestionView!.style.left = (caret.offsetLeft - this.highlightView!.scrollLeft) + 'px';
                this.suggestionView!.style.visibility = 'visible';
            } else if (this.suggestionView!.style.visibility === 'visible') {
                this.suggestionView!.style.visibility = 'hidden';
            }
        }
        this.suggestionViewState.dirty = false;
    }

    private isVisibleSuggestionView(): boolean {
        return this.suggestionView!.style.visibility === 'visible';
    }

    private hiddenSuggestionView() {
        if (this.suggestionViewState.visible) {
            this.suggestionViewState.visible = false;
            this.suggestionViewState.dirty = true;
            this.requestTickAnimationFrame();
        }
    }

    private focusSuggestionView() {
        if (this.isVisibleSuggestionView()) {
            this.suggestionViewSelect!.selectedIndex = 0;
            this.suggestionViewSelect!.scrollTop = 0;
            this.suggestionViewSelect!.focus();
        }
    }

    private getSelectSuggestionWord(select?: number): string | null {
        select ??= this.suggestionViewSelect!.selectedIndex;
        if (0 <= select && select < this.suggestionViewSelect!.options.length) {
            return this.suggestionViewSelect!.options[select].value;
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
        if (this.suggestionViewState.content !== event.data.suggestionViewHtml) {
            this.suggestionViewState.content = event.data.suggestionViewHtml;
            this.suggestionViewState.visible = (event.data.suggestionViewHtml as string).length !== 0;
            this.suggestionViewState.dirty = true;
            this.requestTickAnimationFrame();
        }
    }

    private postWorkerInput() {
        const start = this.textarea!.selectionStart;
        const end = this.textarea!.selectionEnd;
        const text = this.textarea!.value;
        this.worker!.port.postMessage({
            suggestion: true,
            selectionStart: start,
            selectionEnd: end,
            text: text
        });
    }

    private postWorkerUpdate() {
        const start = this.textarea!.selectionStart;
        const end = this.textarea!.selectionEnd;
        const text = this.textarea!.value;
        this.worker!.port.postMessage({
            suggestion: false,
            selectionStart: start,
            selectionEnd: end,
            text: text
        });
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
        this.storeSelection();
        this.storeScrollSize();
        this.storeClientSize();
        this.storeScrollPosition();
        // header view
        this.reflectContentToHeaderView();
        // lineno view
        this.reflectScrollSizeToLinenoView();
        this.reflectClientSizeToLinenoView();
        this.reflectScrollPositionToLinenoView();
        this.reflectContentToLinenoView();
        // highlight view
        this.reflectScrollSizeToHighlightView();
        this.reflectClientSizeToHighlightView();
        this.reflectScrollPositionToHighlightView();
        this.reflectContentToHighlightView();
        // suggestion view
        this.reflectContentToSuggestionView();
        // end
        this.reflectedSelection();
        this.reflectedScrollSize();
        this.reflectedClientSize();
        this.reflectedScrollPosition();
    }
}

customElements.define('yossq236-custom-editor-element', Editor);