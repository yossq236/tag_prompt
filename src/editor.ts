import EditorWorker from './editorWorker.ts?sharedworker&url';

interface Cursor {
    row: number;
    column: number;
}

export class Editor {
    // containor
    private container!: HTMLElement;
    // highlight view
    private highlightViewContainer!: HTMLElement;
    private highlightViewPre!: HTMLElement;
    private highlightViewCode!: HTMLElement;
    // textarea
    private textarea!: HTMLTextAreaElement;
    private textareaKeydownEvent!: (event: KeyboardEvent) => void;
    private textareaInputEvent!: (event: Event) => void;
    private textareaScrollEvent!: (event: Event) => void;
    private textareaResizeObserver!: ResizeObserver;
    // suggestion view
    private suggestionViewContainer!: HTMLElement;
    private suggestionViewSelect!: HTMLSelectElement;
    private suggestionViewKeydownEvent!: (event: KeyboardEvent) => void;
    private suggestionViewClickEvent!: (event: MouseEvent) => void;
    // worker
    private editorWorker!: SharedWorker;

    // constructor

    constructor() {
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
            scrollTop: this.textarea.scrollTop,
            scrollLeft: this.textarea.scrollLeft
        });
    }
    set state(newValue: string) {
        try {
            const obj = JSON.parse(newValue);
            if ('text' in obj && 'selectionStart' in obj && 'selectionEnd' in obj && 'scrollTop' in obj && 'scrollLeft' in obj) {
                this.textarea.value = obj.text;
                this.textarea.selectionStart = obj.selectionStart;
                this.textarea.selectionEnd = obj.selectionEnd;
                setTimeout(() => {
                    this.textarea.scrollTop = obj.scrollTop;
                    this.textarea.scrollLeft = obj.scrollLeft;
                    this.postWorkerUpdateText(false);
                },0);
            } else {
                this.textarea.value = newValue;
                this.postWorkerUpdateText(false);
            }
        } catch (e) {
            this.textarea.value = newValue;
            this.postWorkerUpdateText(false);
        }
    }

    // mount

    public mount() {
        // create container
        this.container = this.createContainer();
        // create highlight view
        this.highlightViewContainer = this.createHighlightViewContainer(this.container);
        this.highlightViewPre = this.createHighlightViewPre(this.highlightViewContainer);
        this.highlightViewCode = this.createHighlightViewCode(this.highlightViewPre);
        // create textarea
        this.textarea = this.createTextarea(this.container);
        // create suggestion view
        this.suggestionViewContainer = this.createSuggestionViewContainer(this.container);
        this.suggestionViewSelect = this.createSuggestionViewSelect(this.suggestionViewContainer);
        // create worker
        this.editorWorker = new SharedWorker(EditorWorker);
        // setup highlight view
        this.reflectStyleToHighlightView();
        this.reflectSizeToHighlightView();
        this.reflectScrollToHighlightView();
        // setup event textarea
        this.setupEventTextarea();
        // setup event suggestion view
        this.setupEventSuggestionView();
        // setup event worker
        this.setupEventWorker();
        // initialize highlight view
        this.highlightViewCode.innerHTML = this.textarea.value;
        this.postWorkerUpdateText(false);
    }

    // unmount

    public unmount() {
        // close worker
        this.editorWorker.port.close();
        // remove event suggestion view
        this.removeEventSuggestionView();
        // remove event textarea
        this.removeEventTextarea();
        // unmount suggestion view
        this.suggestionViewSelect.parentElement?.removeChild(this.suggestionViewSelect);
        this.suggestionViewContainer.parentElement?.removeChild(this.suggestionViewContainer);
        // unmount textarea
        this.textarea.parentElement?.removeChild(this.textarea);
        // unmount highlight view
        this.highlightViewCode.parentElement?.removeChild(this.highlightViewCode);
        this.highlightViewPre.parentElement?.removeChild(this.highlightViewPre);
        this.highlightViewContainer.parentElement?.removeChild(this.highlightViewContainer);
        // umount container
        this.container.parentElement?.removeChild(this.container);
    }

    // event 

    private setupEventTextarea() {
        this.textareaKeydownEvent = (event) => {
            if (event.defaultPrevented) {
                return;
            } else if (event.ctrlKey || event.metaKey) {
                if (event.key === '/') {
                    this.toggleCommentToTextarea();
                    this.postWorkerUpdateText(false);
                    event.preventDefault();
                }
            } else if (this.isVisibleSuggestionView()) {
                if (event.key === 'Tab' || event.key === 'Escape' || event.key === 'ArrowLeft' || event.key === 'ArrowRight' || event.key === 'ArrowUp') {
                    this.hiddenSuggestionView();
                } else if (event.key === 'ArrowDown') {
                    this.focusSuggestionView();
                    event.preventDefault();
                }
            } else {
                if (event.key === 'Tab') {
                    this.insertWordToTextarea('    ');
                    this.postWorkerUpdateText(false);
                    event.preventDefault();
                }
            }
        };
        this.textarea.addEventListener('keydown', this.textareaKeydownEvent);
        this.textareaInputEvent = (_) => {
            this.postWorkerUpdateText(true);
        };
        this.textarea.addEventListener('input', this.textareaInputEvent);
        this.textareaScrollEvent = (_) => {
            this.reflectScrollToHighlightView();
        };
        this.textarea.addEventListener('scroll', this.textareaScrollEvent);
        this.textareaResizeObserver = new ResizeObserver(() => {
            this.reflectSizeToHighlightView();
        });
        this.textareaResizeObserver.observe(this.textarea);
    }

    private removeEventTextarea() {
        this.textarea.removeEventListener('keydown', this.textareaKeydownEvent);
        this.textarea.removeEventListener('input', this.textareaInputEvent);
        this.textarea.removeEventListener('scroll', this.textareaScrollEvent);
        this.textareaResizeObserver.unobserve(this.textarea);
        this.textareaResizeObserver.disconnect();
    }

    private setupEventSuggestionView() {
        this.suggestionViewKeydownEvent = (event) => {
            if (event.defaultPrevented) {
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
                    this.postWorkerUpdateText(false);
                    event.preventDefault();
                }
            }
        };
        this.suggestionViewSelect.addEventListener('keydown', this.suggestionViewKeydownEvent);
        this.suggestionViewClickEvent = (event) => {
            if (this.suggestionViewContainer.contains(event.target as Node)) {
            } else {
                this.hiddenSuggestionView();
            }
        };
        document.addEventListener('click', this.suggestionViewClickEvent);
    }

    private removeEventSuggestionView() {
        this.suggestionViewSelect.removeEventListener('keydown', this.suggestionViewKeydownEvent);
        document.removeEventListener('click', this.suggestionViewClickEvent);
    }

    private setupEventWorker() {
        this.editorWorker.port.onmessage = (event) => {
            this.highlightViewCode.innerHTML = event.data.highlightViewHtml;
            this.reflectSizeToHighlightView();
            this.reflectScrollToHighlightView();
            this.suggestionViewSelect.innerHTML = event.data.suggestionViewHtml;
            if (0 < event.data.suggestionViewHtml.length) {
                this.visibleSuggestionView();
            } else {
                this.hiddenSuggestionView();
            }
        };
    }

    // highlight view 

    private reflectStyleToHighlightView() {
        this.highlightViewPre.style.fontFamily = this.textarea.style.fontFamily;
        this.highlightViewPre.style.tabSize = this.textarea.style.tabSize;
    }

    private reflectSizeToHighlightView() {
        this.highlightViewPre.style.width = this.textarea.scrollWidth + 'px';
        this.highlightViewPre.style.height = this.textarea.scrollHeight + 'px';
        this.highlightViewContainer.style.width = this.textarea.clientWidth + 'px';
        this.highlightViewContainer.style.height = this.textarea.clientHeight + 'px';
    }

    private reflectScrollToHighlightView() {
        this.highlightViewContainer.scrollLeft = this.textarea.scrollLeft;
        this.highlightViewContainer.scrollTop = this.textarea.scrollTop;
    }

    // textarea

    private toggleCommentToTextarea() {
        const start = this.textarea.selectionStart;
        const end = this.textarea.selectionEnd;
        const text = this.textarea.value;
        const lines = text.split('\n');
        const cursor_start = Editor.getCursor(text, start);
        const cursor_end = Editor.getCursor(text, end);
        const row_start = cursor_start.row;
        const row_end = ((cursor_start.row < cursor_end.row) && (cursor_end.column === 0)) ? cursor_end.row - 1 : cursor_end.row;
        let comment = false;
        for (let i = row_start; i <= row_end; i++) {
            if (!lines[i].trimStart().startsWith('//')) {
                comment = true;
            }
        }
        let newSelectionStart = start;
        let newSelectionEnd = end;
        for (let i = row_start; i <= row_end; i++) {
            if (comment) {
                lines[i] = '// ' + lines[i];
                newSelectionEnd += 3;
            } else {
                lines[i] = lines[i].replace(/(\/\/\s)|(\/\/)/,m => {
                    newSelectionEnd -= m.length;
                    return '';
                });
            }
        }
        this.textarea.value = lines.join('\n');
        this.textarea.selectionStart = newSelectionStart;
        this.textarea.selectionEnd = newSelectionEnd;
    }

    private insertWordToTextarea(word: string, start?: number, end?: number) {
        start ??= this.textarea.selectionStart;
        end ??= this.textarea.selectionEnd;
        const text = this.textarea.value;
        this.textarea.value = text.substring(0, start) + word + text.substring(end);
        this.textarea.selectionStart = this.textarea.selectionEnd = start + word.length;
    }

    private applySuggestionWordToTextarea(word: string) {
        const text = this.textarea.value;
        let start = this.textarea.selectionStart;
        let end = this.textarea.selectionEnd;
        for (let i = start - 1;0 <= i; i--) {
            const c = text.charAt(i);
            if (c === ' '  || c === ',' || c === '\n' || 255 < c.charCodeAt(0)) break;
            start = i;
        }
        for (let i = end;i < text.length; i++) {
            const c = text.charAt(i);
            if (c === ' '  || c === ',' || c === '\n' || 255 < c.charCodeAt(0)) break;
            end = i + 1;
        }
        const insert_word = word + ((text.charAt(end) !== ',') ? ',' : '');
        this.insertWordToTextarea(insert_word, start, end);
    }

    private static getCursor(text: string, position: number): Cursor {
        let row: number = 0;
        let last: number = -1;
        for (let i = -1; (i = text.indexOf('\n', i + 1)) !== -1 && i < position; last = i, row++);
        return {row: row, column: position - last - 1};
    }

    // suggestion

    private isVisibleSuggestionView(): boolean {
        return this.suggestionViewContainer.style.visibility === 'visible';
    }

    private visibleSuggestionView() {
        const caret = this.highlightViewCode.querySelector('span.caret') as HTMLSpanElement;
        if (caret) {
            this.suggestionViewContainer.style.top = (caret.offsetTop + caret.offsetHeight - this.textarea.scrollTop) + 'px';
            this.suggestionViewContainer.style.left = (caret.offsetLeft - this.textarea.scrollLeft) + 'px';
            if (!this.isVisibleSuggestionView()) {
                this.suggestionViewContainer.style.visibility = 'visible';
            }
        }
    }

    private hiddenSuggestionView() {
        if (this.isVisibleSuggestionView()) {
            this.suggestionViewContainer.style.visibility = 'hidden';
        }
    }

    private focusSuggestionView() {
        if (this.isVisibleSuggestionView()) {
            this.suggestionViewSelect.selectedIndex = 0;
            this.suggestionViewSelect.focus();
        }
    }

    private getSelectSuggestionWord(): string | null {
        if (0 <= this.suggestionViewSelect.selectedIndex) {
            return this.suggestionViewSelect.options[this.suggestionViewSelect.selectedIndex].value;
        }
        return null;
    }

    // worker

    private postWorkerUpdateText(suggestion: boolean) {
        this.editorWorker.port.postMessage({
            suggestion: suggestion,
            selectionStart: this.textarea.selectionStart,
            selectionEnd: this.textarea.selectionEnd,
            text: this.textarea.value
        });
    }

    // create 

    private createContainer(): HTMLElement {
        const element = document.createElement('div');
        element.style.position = 'relative';
        element.style.width = '100%';
        element.style.height = '100%';
        return element;
    }

    private createTextarea(parent: HTMLElement):HTMLTextAreaElement {
        const element = document.createElement('textarea');
        parent.appendChild(element);
        element.className = 'comfy-multiline-input';
        element.style.width = '100%';
        element.style.height = '100%';
        element.style.overflowX = 'auto';
        element.style.overflowY = 'auto';
        element.style.whiteSpace = 'nowrap';
        element.style.background = 'transparent';
        element.style.color = 'transparent';
        element.style.caretColor = 'rgb(from var(--comfy-input-bg) calc(255 - r) calc(255 - g) calc(255 - b))';
        return element;
    }

    private createHighlightViewContainer(parent: HTMLElement): HTMLElement {
        const element = document.createElement('div');
        parent.appendChild(element);
        element.style.position = 'absolute';
        element.style.left = '0';
        element.style.top = '0';
        element.style.overflowX = 'hidden';
        element.style.overflowY = 'hidden';
        element.style.zIndex = '-1';
        return element;
    }

    private createHighlightViewPre(parent: HTMLElement): HTMLElement {
        const element = document.createElement('pre');
        parent.appendChild(element);
        element.style.margin = '0';
        element.style.border = 'none';
        element.style.padding = '2px';
        element.style.fontSize = 'var(--comfy-textarea-font-size)';
        element.style.background = 'var(--comfy-input-bg)';
        element.style.color = 'var(--input-text)';
        element.style.lineHeight = 'normal';
        return element;
    }

    private createHighlightViewCode(parent: HTMLElement): HTMLElement {
        const element = document.createElement('code');
        parent.appendChild(element);
        return element;
    }

    private createSuggestionViewContainer(parent: HTMLElement): HTMLElement {
        const element = document.createElement('div');
        parent.appendChild(element);
        element.style.position = 'absolute';
        element.style.left = '0';
        element.style.top = '0';
        element.style.width = 'fit-content';
        element.style.height = 'auto';
        element.style.visibility = 'hidden';
        return element;
    }

    private createSuggestionViewSelect(parent: HTMLElement): HTMLSelectElement {
        const element = document.createElement('select');
        parent.appendChild(element);
        element.setAttribute('size', '10');
        element.style.fontSize = 'var(--comfy-textarea-font-size)';
        element.style.background = 'var(--comfy-input-bg)';
        element.style.color = 'var(--input-text)';
        element.style.appearance = 'none';
        return element;
    }
}