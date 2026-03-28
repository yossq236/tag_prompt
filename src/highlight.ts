import { HIGHLIGHT_TOKENS } from './constants';

const PATTERN = new RegExp(Object.values(HIGHLIGHT_TOKENS).map(v => (v instanceof RegExp) ? v.source : RegExp.escape(v)).join('|'),'g');

export class Highlight {
    private header: boolean;
    private lineComment: boolean;
    private blockComment: boolean;
    private parenthesisDepth: number;
    constructor(){
        this.header = false;
        this.lineComment = false;
        this.blockComment = false;
        this.parenthesisDepth = 0;
    }
    public serialize(): string {
        return ((this.header) ? '1' : '0') + ((this.lineComment) ? '1' : '0') + ((this.blockComment) ? '1' : '0') + this.parenthesisDepth;
    }
    public unserialize(value: string): void {
        this.header = value[0] === '1';
        this.lineComment = value[1] === '1';
        this.blockComment = value[2] === '1';
        this.parenthesisDepth = parseInt(value.substring(3));
    }
    public reset(): void {
        this.header = false;
        this.lineComment = false;
        this.blockComment = false;
        this.parenthesisDepth = 0;
    }
    public highlight(text?: string): string {
        if (text) {
            return text.replace(PATTERN, m => this.replacer(m));
        } else {
            return (this.lineComment || this.blockComment || this.header) ? '</span>' : '';
        }
    }
    private replacer(match: string): string {
        switch(match) {
        case '&': return '&amp;';
        case '<': return '&lt;';
        case '>': return '&gt;';
        case '"': return '&quot;';
        case '\'': return '&#39;';
        case '//':
            if (this.lineComment || this.blockComment) {
            } else if (this.header) {
                this.header = false;
                this.lineComment = true;
                return '</span><span style="color: #008000;">' + match;
            } else {
                this.lineComment = true;
                return '<span style="color: #008000;">' + match;
            }
            break;
        case '/*':
            if (this.lineComment || this.blockComment) {
            } else if (this.header) {
                this.header = false;
                this.blockComment = true;
                return '</span><span style="color: #008000;">' + match;
            } else {
                this.blockComment = true;
                return '<span style="color: #008000;">' + match;
            }
            break;
        case '*/':
            if (this.lineComment) {
            } else if (this.blockComment) {
                this.blockComment = false;
                return match + '</span>';
            }
            break;
        case '(':
            if (this.lineComment || this.blockComment || this.header) {
            } else {
                this.parenthesisDepth++;
                return '<span style="color: yellow;">' + match + '</span>';
            }
            break;
        case ')':
            if (this.lineComment || this.blockComment || this.header) {
            } else {
                this.parenthesisDepth--;
                return '<span style="color: yellow;">' + match + '</span>';
            }
            break;
        case ',':
            if (this.lineComment || this.blockComment || this.header) {
            } else {
                return '<span style="color: fuchsia;">' + match + '</span>';
            }
            break;
        case '\n':
            if (this.lineComment || this.header) {
                this.header = this.lineComment = false;
                return '</span>' + match;
            }
            break;
        default:
            switch(match[0]){
            case '#':
                if (this.lineComment || this.blockComment || this.header) {
                } else {
                    this.header = true;
                    return '<span style="color: #2b91af;;"><span style="font-style: italic;">' + match + '</span>';
                }
                break;
            case ':':
                if (0 < this.parenthesisDepth) {
                    return '<span style="color: fuchsia;">:</span><span style="color: orange;">' + match.substring(1) + '</span>';
                }
                break;
            }
            break;
        }
        return match;
    }
}

export function getHighlightViewHtml(text: string, caret: number): string {
    const highlight = new Highlight();
    return highlight.highlight(text.substring(0, caret))
        + '<span class="caret"></span>'
        + highlight.highlight(text.substring(caret))
        + highlight.highlight();
}
