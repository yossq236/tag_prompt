interface Header {
    row: number;
    text: string;
}

export function getHeaderViewHtml(code: string): string {
    return code.split('\n').map<Header>((v,i) => ({row: i, text: v})).filter(v => v.text.startsWith('#')).map<string>(v => '<option value="' + v.row + '">' + v.text + '</option>').join('\n');
}
