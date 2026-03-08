
export function getHighlightViewHtml(code: string, caret: number): string {
    const replaceWords = /(\/\/)|(\/\*)|(\*\/)|(\\\()|(\\\))|([#]+)|([<>()&"'\n])/g;
    const replaceCallback = (match: string): string => {
        switch(match) {
            case '<': return '&lt;';
            case '>': return '&gt;';
            case '(':
                if (lineComment || blockComment || section) {
                } else {
                    return '<span style="color: #ffff00;">' + match + '</span>';
                }
                break;
            case ')':
                if (lineComment || blockComment || section) {
                } else {
                    return '<span style="color: #ffff00;">' + match + '</span>';
                }
                break;
            case '&': return '&amp;';
            case '"': return '&quot;';
            case '\'': return '&#39;';
            case '\n':
                if (lineComment || section) {
                    section = lineComment = false;
                    return '</span>' + match;
                }
                break;
            case '#':
            case '##':
            case '###':
            case '####':
            case '#####':
                if (lineComment || blockComment || section) {
                } else {
                    section = true;
                    return '<span style="color: #2b91af;">' + match;
                }
                break;
            case '//':
                if (lineComment || blockComment) {
                } else if (section) {
                    section = false;
                    lineComment = true;
                    return '</span><span style="color: #008000;">' + match;
                } else {
                    lineComment = true;
                    return '<span style="color: #008000;">' + match;
                }
                break;
            case '/*':
                if (lineComment || blockComment) {
                } else if (section) {
                    section = false;
                    blockComment = true;
                    return '</span><span style="color: #008000;">' + match;
                } else {
                    blockComment = true;
                    return '<span style="color: #008000;">' + match;
                }
                break;
            case '*/':
                if (lineComment) {
                } else if (blockComment) {
                    blockComment = false;
                    return match + '</span>';
                }
                break;
        }
        return match;
    };
    let lineComment = false;
    let blockComment = false;
    let section = false;
    let result = '';
    result += code.substring(0, caret).replace(replaceWords, replaceCallback);
    result += '<span class="caret"></span>';
    result += code.substring(caret).replace(replaceWords, replaceCallback);
    if (lineComment || blockComment || section) {
        result += '</span>';
    }
    return result;
}
