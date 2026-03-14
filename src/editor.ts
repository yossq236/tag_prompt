import EditorWorker from './editorWorker.ts?sharedworker&url';

// interface Cursor {
//     row: number;
//     column: number;
// }

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
    private textareaScrollTop: number = 0;
    private textareaScrollLeft: number = 0;
    private textareaScrollWidth: number = 0;
    private textareaScrollHeight: number = 0;
    private textareaClientWidth: number = 0;
    private textareaClientHeight: number = 0;
    // suggestion view
    private suggestionViewContainer!: HTMLElement;
    private suggestionViewSelect!: HTMLSelectElement;
    private suggestionViewKeydownEvent!: (event: KeyboardEvent) => void;
    private suggestionViewClickEvent!: (event: MouseEvent) => void;
    // worker
    private editorWorker!: SharedWorker;

    // constructor

    constructor() {
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
        // setup event textarea
        this.setupEventTextarea();
        // setup event suggestion view
        this.setupEventSuggestionView();
        // setup event worker
        this.setupEventWorker();
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
            scrollTop: this.textareaScrollTop,
            scrollLeft: this.textareaScrollLeft,
        });
    }
    set state(newValue: string) {
        let stateObj = {
            text: newValue,
            selectionStart: 0,
            selectionEnd: 0,
            scrollTop: 0,
            scrollLeft: 0,
        };
        try {
            const parseObj = JSON.parse(newValue);
            if ('text' in parseObj && 'selectionStart' in parseObj && 'selectionEnd' in parseObj && 'scrollTop' in parseObj && 'scrollLeft' in parseObj) {
                stateObj = parseObj;
            }
        } catch (e) {
        }
        const change_text = (this.textarea.value !== stateObj.text);
        const change_scroll = (this.textareaScrollTop !== stateObj.scrollTop || this.textareaScrollLeft !== stateObj.scrollLeft);
        this.textarea.value = stateObj.text;
        this.textarea.selectionStart = stateObj.selectionStart;
        this.textarea.selectionEnd = stateObj.selectionEnd;
        this.textareaScrollTop = stateObj.scrollTop;
        this.textareaScrollLeft = stateObj.scrollLeft;
        if (change_text) {
            this.postWorkerUpdateText(false);
        }
        if (change_scroll) {
            window.requestAnimationFrame(() => {
                this.textarea.scrollTop = this.textareaScrollTop;
                this.textarea.scrollLeft = this.textareaScrollLeft;
            });
        }
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
            if (event.defaultPrevented || event.repeat) {
                return;
            } else if (event.ctrlKey || event.metaKey) {
                if (event.key === '/') {
                    this.toggleCommentToTextarea();
                    event.preventDefault();
                }
            } else if (this.isVisibleSuggestionView()) {
                if (event.key === 'Tab') {
                    this.hiddenSuggestionView();
                    this.insertWordToTextarea('    ');
                    event.preventDefault();
                } else if (event.key === 'Escape' || event.key === 'ArrowLeft' || event.key === 'ArrowRight' || event.key === 'ArrowUp') {
                    this.hiddenSuggestionView();
                } else if (event.key === 'ArrowDown') {
                    this.focusSuggestionView();
                    event.preventDefault();
                }
            } else {
                if (event.key === 'Tab') {
                    this.insertWordToTextarea('    ');
                    event.preventDefault();
                }
            }
        };
        this.textarea.addEventListener('keydown', this.textareaKeydownEvent);
        this.textareaInputEvent = (_event) => {
            this.postWorkerUpdateText(true);
        };
        this.textarea.addEventListener('input', this.textareaInputEvent);
        this.textareaScrollEvent = (_event) => {
            window.requestAnimationFrame(() => {
                this.storeScrollPosition();
                this.reflectScrollPositionToHighlightView();
            });
        };
        this.textarea.addEventListener('scroll', this.textareaScrollEvent);
        this.textareaResizeObserver = new ResizeObserver(() => {
            window.requestAnimationFrame(() => {
                this.storeSize();
                this.reflectSizeToHighlightView();
            });
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
            window.requestAnimationFrame(() => {
                this.storeSize();
                this.storeScrollPosition();
                this.reflectSizeToHighlightView();
                this.reflectScrollPositionToHighlightView();
            });
            this.suggestionViewSelect.innerHTML = event.data.suggestionViewHtml;
            if (0 < event.data.suggestionViewHtml.length) {
                this.visibleSuggestionView();
            } else {
                this.hiddenSuggestionView();
            }
        };
    }

    // highlight view 

    private reflectSizeToHighlightView() {
        this.highlightViewPre.style.width = this.textareaScrollWidth + 'px';
        this.highlightViewPre.style.height = this.textareaScrollHeight + 'px';
        this.highlightViewContainer.style.width = this.textareaClientWidth + 'px';
        this.highlightViewContainer.style.height = this.textareaClientHeight + 'px';
    }

    private reflectScrollPositionToHighlightView() {
        this.highlightViewContainer.scrollTop = this.textareaScrollTop;
        this.highlightViewContainer.scrollLeft = this.textareaScrollLeft;
    }

    // textarea

    private storeSize() {
        this.textareaScrollWidth = this.textarea.scrollWidth;
        this.textareaScrollHeight = this.textarea.scrollHeight;
        this.textareaClientWidth = this.textarea.clientWidth;
        this.textareaClientHeight = this.textarea.clientHeight;
    }

    private storeScrollPosition() {
        this.textareaScrollTop = this.textarea.scrollTop;
        this.textareaScrollLeft = this.textarea.scrollLeft;
    }

    private toggleCommentToTextarea() {
        const text = this.textarea.value;
        const selection_start = this.textarea.selectionStart;
        const selection_end = this.textarea.selectionEnd;
        const toggle_start = [text.substring(0, selection_start).lastIndexOf('\n')].reduce((a,v) => (v !== -1) ? v + 1 : a, 0);
        const toggle_end = [text.substring(0, selection_end).lastIndexOf('\n'), text.indexOf('\n', selection_end)].reduce((a,v) => (v !== -1 && toggle_start < v && v < a) ? v : a, text.length);
        const toggle_text = text.substring(toggle_start, toggle_end);
        const toggle_lines = toggle_text.split('\n');
        const commentout = toggle_lines.reduce((a,v) => (a || !v.trimStart().startsWith('//')), false);
        const indent = toggle_lines.map(v => v.replace(/^(\s*)(.*)/, '$1').length).reduce((a,v,i) => (i === 0 || v < a) ? v : a, 0);
        let new_selection_start = selection_start;
        let new_selection_end = selection_end;
        for (let i = 0, toggle_cursor = toggle_start; i < toggle_lines.length; i++) {
            const line = toggle_lines[i];
            if (commentout) {
                toggle_lines[i] = ' '.repeat(indent) + '// ' + line.substring(indent);
                if (toggle_cursor < new_selection_start) {
                    new_selection_start += 3;
                }
                if (toggle_cursor < new_selection_end) {
                    new_selection_end += 3;
                }
            } else {
                toggle_lines[i] = line.replace(/(\/\/\s)|(\/\/)/,m => {
                    if (toggle_cursor < new_selection_start) {
                        new_selection_start -= m.length;
                    }
                    if (toggle_cursor < new_selection_end) {
                        new_selection_end -= m.length;
                    }
                    return '';
                });
            }
            toggle_cursor += line.length + 1;
        }
        this.textarea.value = text.substring(0, toggle_start) + toggle_lines.join('\n') + text.substring(toggle_end);
        this.textarea.selectionStart = new_selection_start;
        this.textarea.selectionEnd = new_selection_end;
        this.postWorkerUpdateText(false);
    }

    private insertWordToTextarea(word: string, start?: number, end?: number) {
        start ??= this.textarea.selectionStart;
        end ??= this.textarea.selectionEnd;
        const text = this.textarea.value;
        this.textarea.value = text.substring(0, start) + word + text.substring(end);
        this.textarea.selectionStart = this.textarea.selectionEnd = start + word.length;
        this.postWorkerUpdateText(false);
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

    // private static getCursor(text: string, position: number): Cursor {
    //     let row: number = 0;
    //     let last: number = -1;
    //     for (let i = -1; (i = text.indexOf('\n', i + 1)) !== -1 && i < position; last = i, row++);
    //     return {row: row, column: position - last - 1};
    // }

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
        console.log('EVENT - postMessage');
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
        element.className = 'comfy-multiline-input';
        element.style.width = '100%';
        element.style.height = '100%';
        element.style.overflowX = 'auto';
        element.style.overflowY = 'auto';
        element.style.whiteSpace = 'nowrap';
        element.style.background = 'transparent';
        element.style.color = 'transparent';
        element.style.caretColor = 'rgb(from var(--comfy-input-bg) calc(255 - r) calc(255 - g) calc(255 - b))';
        parent.appendChild(element);
        return element;
    }

    private createHighlightViewContainer(parent: HTMLElement): HTMLElement {
        const element = document.createElement('div');
        element.style.position = 'absolute';
        element.style.left = '0';
        element.style.top = '0';
        element.style.overflowX = 'hidden';
        element.style.overflowY = 'hidden';
        element.style.zIndex = '-1';
        parent.appendChild(element);
        return element;
    }

    private createHighlightViewPre(parent: HTMLElement): HTMLElement {
        const element = document.createElement('pre');
        element.style.margin = '0';
        element.style.border = 'none';
        element.style.padding = '2px';
        element.style.fontSize = 'var(--comfy-textarea-font-size)';
        element.style.background = 'var(--comfy-input-bg)';
        element.style.color = 'var(--input-text)';
        element.style.lineHeight = 'normal';
        parent.appendChild(element);
        return element;
    }

    private createHighlightViewCode(parent: HTMLElement): HTMLElement {
        const element = document.createElement('code');
        parent.appendChild(element);
        return element;
    }

    private createSuggestionViewContainer(parent: HTMLElement): HTMLElement {
        const element = document.createElement('div');
        element.style.position = 'absolute';
        element.style.left = '0';
        element.style.top = '0';
        element.style.width = 'fit-content';
        element.style.height = 'auto';
        element.style.visibility = 'hidden';
        parent.appendChild(element);
        return element;
    }

    private createSuggestionViewSelect(parent: HTMLElement): HTMLSelectElement {
        const element = document.createElement('select');
        element.setAttribute('size', '10');
        element.style.fontSize = 'var(--comfy-textarea-font-size)';
        element.style.background = 'var(--comfy-input-bg)';
        element.style.color = 'var(--input-text)';
        element.style.appearance = 'none';
        parent.appendChild(element);
        return element;
    }
}