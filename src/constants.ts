export const MAX_SUGGESTION = 50;
export const MAX_SUGGESTION_VIEW_ROW = 10;
export const ASCII_THRESHOLD = 256;
export const HIGHLIGHT_TOKENS = {
    HEADER: /[#]+\s/,
    LINE_COMMENT: '//',
    BLOCK_COMMENT_BEGIN: '/*',
    BLOCK_COMMENT_END: '*/',
    ESCAPED_PARENTHESIS: /\\[()]/,
    WEIGHT: /:[0-9\.]/,
    CHARS: /[<>()&"',\n]/,
};
export const HEADER_TOKENS = {
    HEADER: /[#]+\s/,
    LINE_COMMENT: '//',
    BLOCK_COMMENT_BEGIN: '/*',
    BLOCK_COMMENT_END: '*/',
    CHARS: /[\n]/,
};
