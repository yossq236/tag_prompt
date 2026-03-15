const PATTERN = /\/\/|\/\*|\*\/|\\\(|\\\)|[#]+|[<>()&"'\n]/g;

interface State {
    lineComment: boolean;
    blockComment: boolean;
    section: boolean;
}

function Replacer(match: string, state: State): string {
    switch(match) {
    case '//':
        if (state.lineComment || state.blockComment) {
        } else if (state.section) {
            state.section = false;
            state.lineComment = true;
            return '</span><span style="color: #008000;">' + match;
        } else {
            state.lineComment = true;
            return '<span style="color: #008000;">' + match;
        }
        break;
    case '/*':
        if (state.lineComment || state.blockComment) {
        } else if (state.section) {
            state.section = false;
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
    case '#':
    case '##':
    case '###':
    case '####':
    case '#####':
        if (state.lineComment || state.blockComment || state.section) {
        } else {
            state.section = true;
            return '<span style="color: #2b91af;">' + match;
        }
        break;
    case '<': return '&lt;';
    case '>': return '&gt;';
    case '(':
        if (state.lineComment || state.blockComment || state.section) {
        } else {
            return '<span style="color: #ffff00;">' + match + '</span>';
        }
        break;
    case ')':
        if (state.lineComment || state.blockComment || state.section) {
        } else {
            return '<span style="color: #ffff00;">' + match + '</span>';
        }
        break;
    case '&': return '&amp;';
    case '"': return '&quot;';
    case '\'': return '&#39;';
    case '\n':
        if (state.lineComment || state.section) {
            state.section = state.lineComment = false;
            return '</span>' + match;
        }
        break;
    }
    return match;
}

export function getHighlightViewHtml(code: string, caret: number): string {
    const state: State = {
        lineComment: false,
        blockComment: false,
        section: false,
    };
    return code.substring(0, caret).replace(PATTERN, m => Replacer(m, state))
        + '<span class="caret"></span>'
        + code.substring(caret).replace(PATTERN, m => Replacer(m, state))
        + ((state.lineComment || state.blockComment || state.section) ? '</span>' : '');
}
