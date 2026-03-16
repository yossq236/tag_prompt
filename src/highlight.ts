const PATTERN = /[#]+|\/\/|\/\*|\*\/|:[0-9\.]+|\\[()]|[<>()&"'\n]/g;

interface State {
    header: boolean;
    lineComment: boolean;
    blockComment: boolean;
    parenthesisDepth: number;
}

function Replacer(match: string, state: State): string {
    switch(match) {
    case '&': return '&amp;';
    case '<': return '&lt;';
    case '>': return '&gt;';
    case '"': return '&quot;';
    case '\'': return '&#39;';
    case '//':
        if (state.lineComment || state.blockComment) {
        } else if (state.header) {
            state.header = false;
            state.lineComment = true;
            return '</span><span style="color: #008000;">' + match;
        } else {
            state.lineComment = true;
            return '<span style="color: #008000;">' + match;
        }
        break;
    case '/*':
        if (state.lineComment || state.blockComment) {
        } else if (state.header) {
            state.header = false;
            state.blockComment = true;
            return '</span><span style="color: #008000;">' + match;
        } else {
            state.blockComment = true;
            return '<span style="color: #008000;">' + match;
        }
        break;
    case '*/':
        if (state.lineComment) {
        } else if (state.blockComment) {
            state.blockComment = false;
            return match + '</span>';
        }
        break;
    case '(':
        if (state.lineComment || state.blockComment || state.header) {
        } else {
            state.parenthesisDepth++;
            return '<span style="color: #ffff00;">' + match + '</span>';
        }
        break;
    case ')':
        if (state.lineComment || state.blockComment || state.header) {
        } else {
            state.parenthesisDepth--;
            return '<span style="color: #ffff00;">' + match + '</span>';
        }
        break;
    case '\n':
        if (state.lineComment || state.header) {
            state.header = state.lineComment = false;
            return '</span>' + match;
        }
        break;
    default:
        switch(match[0]){
        case '#':
            if (state.lineComment || state.blockComment || state.header) {
            } else {
                state.header = true;
                return '<span style="color: #2b91af;;"><span style="font-style: italic;">' + match + '</span>';
            }
            break;
        case ':':
            if (0 < state.parenthesisDepth) {
                return '<span style="color: #f39800;">' + match + '</span>';
            }
            break;
        }
        break;
    }
    return match;
}

export function getHighlightViewHtml(code: string, caret: number): string {
    const state: State = {
        header: false,
        lineComment: false,
        blockComment: false,
        parenthesisDepth: 0,
    };
    return code.substring(0, caret).replace(PATTERN, m => Replacer(m, state))
        + '<span class="caret"></span>'
        + code.substring(caret).replace(PATTERN, m => Replacer(m, state))
        + ((state.lineComment || state.blockComment || state.header) ? '</span>' : '');
}
