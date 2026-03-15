import EditorWorker from './editorWorker.ts?sharedworker&url';

interface State {
    text: string;
    selectionStart: number;
    selectionEnd: number;
    scrollTop: number;
    scrollLeft: number;
}

function isValidState(obj: unknown): obj is State {
    return (obj !== null) && (typeof obj === 'object') && ('text' in obj) && ('selectionStart' in obj) && ('selectionEnd' in obj) && ('scrollTop' in obj) && ('scrollLeft' in obj);
}

interface PositionState {
    top: number;
    left: number;
    dirty: boolean;
}

interface SizeState {
    width: number;
    height: number;
    dirty: boolean;
}

export class Editor {
    // containor
    private container: HTMLElement;
    // highlight view
    private highlightViewContainer: HTMLElement;
    private highlightViewPre: HTMLElement;
    private highlightViewCode: HTMLElement;
    // textarea
    private textarea: HTMLTextAreaElement;
    private textareaListenerKeydown: (event: KeyboardEvent) => void;
    private textareaListenerInput: (event: Event) => void;
    private textareaListenerScroll: (event: Event) => void;
    private textareaResizeObserver: ResizeObserver;
    private textareaScrollSize: SizeState;
    private textareaClientSize: SizeState;
    private textareaScrollPosition: PositionState;
    // suggestion view
    private suggestionViewContainer: HTMLElement;
    private suggestionViewSelect: HTMLSelectElement;
    private suggestionViewListenerKeydown: (event: KeyboardEvent) => void;
    private suggestionViewListenerClick: (event: MouseEvent) => void;
    // worker
    private worker: SharedWorker;
    // animation frame
    private tickAnimationFrameID: number;

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
        this.textareaListenerKeydown = e => this.handleTextareaKeyDown(e);
        this.textareaListenerInput = e => this.handleTextareaInput(e);
        this.textareaListenerScroll = e => this.handleTextareaScroll(e);
        this.textareaResizeObserver = new ResizeObserver(e => this.handleTextareaReSize(e));
        this.textareaScrollSize = {width: 0, height: 0, dirty: false};
        this.textareaClientSize = {width: 0, height: 0, dirty: false};
        this.textareaScrollPosition = {top: 0, left: 0, dirty: false};
        // create suggestion view
        this.suggestionViewContainer = this.createSuggestionViewContainer(this.container);
        this.suggestionViewSelect = this.createSuggestionViewSelect(this.suggestionViewContainer);
        this.suggestionViewListenerKeydown = e => this.handleSuggestionViewKeyDown(e);
        this.suggestionViewListenerClick = e => this.handleSuggestionViewClick(e);
        // create worker
        this.worker = new SharedWorker(EditorWorker);
        this.worker.port.onmessage = e => this.handleWorkerMessage(e);
        // create animation frame
        this.tickAnimationFrameID = 0;
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
        let stateObj: State = {
            text: newValue,
            selectionStart: 0,
            selectionEnd: 0,
            scrollTop: 0,
            scrollLeft: 0,
        };
        try {
            const parseObj = JSON.parse(newValue);
            if (isValidState(parseObj)) {
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
            this.postWorkerUpdateText(false);
        }
    }

    // unmount

    public unmount() {
        // close worker
        this.worker.port.close();
        this.worker.port.onmessage = null;
        // remove event suggestion view
        this.removeSuggestionViewEvent();
        // remove event textarea
        this.removeTextareaEvent();
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
        // highlight view
        this.reflectScrollSizeToHighlightView();
        this.reflectClientSizeToHighlightView();
        this.reflectScrollPositionToHighlightView();
        // end
        this.reflectedScrollSize();
        this.reflectedClientSize();
        this.reflectedScrollPosition();
    }

    // highlight view 

    private reflectScrollSizeToHighlightView() {
        if (this.textareaScrollSize.dirty) {
            this.highlightViewPre.style.width = this.textareaScrollSize.width + 'px';
            this.highlightViewPre.style.height = this.textareaScrollSize.height + 'px';
        }
    }

    private reflectClientSizeToHighlightView() {
        if (this.textareaClientSize.dirty) {
            this.highlightViewContainer.style.width = this.textareaClientSize.width + 'px';
            this.highlightViewContainer.style.height = this.textareaClientSize.height + 'px';
        }
    }

    private reflectScrollPositionToHighlightView() {
        if (this.textareaScrollPosition.dirty) {
            this.highlightViewContainer.scrollTop = this.textareaScrollPosition.top;
            this.highlightViewContainer.scrollLeft = this.textareaScrollPosition.left;
        }
    }

    // textarea

    private addTextareaEvent() {
        this.textarea.addEventListener('keydown', this.textareaListenerKeydown);
        this.textarea.addEventListener('input', this.textareaListenerInput);
        this.textarea.addEventListener('scroll', this.textareaListenerScroll);
        this.textareaResizeObserver.observe(this.textarea);
    }

    private removeTextareaEvent() {
        this.textarea.removeEventListener('keydown', this.textareaListenerKeydown);
        this.textarea.removeEventListener('input', this.textareaListenerInput);
        this.textarea.removeEventListener('scroll', this.textareaListenerScroll);
        this.textareaResizeObserver.unobserve(this.textarea);
        this.textareaResizeObserver.disconnect();
    }

    private handleTextareaKeyDown(event: KeyboardEvent): void {
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
    }

    private handleTextareaInput(_event: Event): void {
        this.requestTickAnimationFrame();
        this.postWorkerUpdateText(true);
    }

    private handleTextareaScroll(_event: Event): void {
        this.requestTickAnimationFrame();
    }

    private handleTextareaReSize(_entries: Array<ResizeObserverEntry>): void {
        this.requestTickAnimationFrame();
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
        if (this.textareaScrollPosition.top !== top || this.textareaScrollPosition.left !== left) {
            this.textareaScrollPosition.top = top;
            this.textareaScrollPosition.left = left;
            this.textareaScrollPosition.dirty = true;
        }
    }

    private reflectedScrollPosition() {
        this.textareaScrollPosition.dirty = false;
    }

    private toggleCommentToTextarea() {
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
        this.postWorkerUpdateText(false);
    }

    private insertWordToTextarea(word: string, start?: number, end?: number) {
        start ??= this.textarea.selectionStart;
        end ??= this.textarea.selectionEnd;
        const text = this.textarea.value;
        this.textarea.value = text.substring(0, start) + word + text.substring(end);
        this.textarea.selectionStart = this.textarea.selectionEnd = start + word.length;
        this.requestTickAnimationFrame();
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
        if (this.suggestionViewContainer.contains(event.target as Node)) {
        } else {
            this.hiddenSuggestionView();
        }
    }

    private isVisibleSuggestionView(): boolean {
        return this.suggestionViewContainer.style.visibility === 'visible';
    }

    private visibleSuggestionView() {
        const caret = this.highlightViewCode.querySelector('span.caret') as HTMLSpanElement;
        if (caret) {
            if (!this.isVisibleSuggestionView()) {
                this.suggestionViewContainer.style.visibility = 'visible';
            }
        }
    }

    private reflectCaretPositionToSuggestionView() {
        const caret = this.highlightViewCode.querySelector('span.caret') as HTMLSpanElement;
        if (caret) {
            this.suggestionViewContainer.style.top = (caret.offsetTop + caret.offsetHeight - this.textarea.scrollTop) + 'px';
            this.suggestionViewContainer.style.left = (caret.offsetLeft - this.textarea.scrollLeft) + 'px';
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

    private handleWorkerMessage(event: MessageEvent<any>):any {
        // highlight view
        this.highlightViewCode.innerHTML = event.data.highlightViewHtml;
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

    private postWorkerUpdateText(suggestion: boolean) {
        this.worker.port.postMessage({
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
// private static getCursor(text: string, position: number): Cursor {
//     let row: number = 0;
//     let last: number = -1;
//     for (let i = -1; (i = text.indexOf('\n', i + 1)) !== -1 && i < position; last = i, row++);
//     return {row: row, column: position - last - 1};
// }