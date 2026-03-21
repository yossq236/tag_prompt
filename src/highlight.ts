const PATTERN = /[#]+|\/\/|\/\*|\*\/|:[0-9\.]+|\\[()]|[<>()&"',\n]/g;

export interface HighlightState {
    header: boolean;
    lineComment: boolean;
    blockComment: boolean;
    parenthesisDepth: number;
}

export function serializeHighlightState(state: HighlightState) {
    return ((state.header) ? '1' : '0') + ((state.lineComment) ? '1' : '0') + ((state.blockComment) ? '1' : '0') + state.parenthesisDepth;
}

export function unserializeHighlightState(state: string) {
    return {
        header: state.substring(0,1) === '1',
        lineComment: state.substring(1,2) === '1',
        blockComment: state.substring(2,3) === '1',
        parenthesisDepth: parseInt(state.substring(3)),
    };
}

function Replacer(match: string, state: HighlightState): string {
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
        }
        break;
    case ')':
        if (state.lineComment || state.blockComment || state.header) {
        } else {
            state.parenthesisDepth--;
        }
        break;
    case ',':
        if (state.lineComment || state.blockComment || state.header) {
        } else {
            return '<span style="color: fuchsia;">' + match + '</span>';
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
                return '<span style="color: fuchsia;">:</span><span style="color: orange;">' + match.substring(1) + '</span>';
            }
            break;
        }
        break;
    }
    return match;
}

export function getHighlightViewHtml(code: string, caret: number): string {
    const state: HighlightState = {
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
