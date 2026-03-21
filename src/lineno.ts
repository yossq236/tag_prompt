export function getLinenoViewHtml(code: string): string {
    const lines = code.split('\n');
    const width = lines.length.toString().length;
    const space = ' '.repeat(width);
    return lines.map((_,i) => '<span> ' + (space + (i + 1).toString()).slice(-width) + ' </span>').join('\n');
}
