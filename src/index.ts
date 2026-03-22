import { app } from '/scripts/app.js';
import type { ComfyExtension } from '@comfyorg/comfyui-frontend-types';
import { Editor } from './editor';

const extension: ComfyExtension = {
    name: 'yossq236.TagPromptNode',
    setup: async (_app) => {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.type = 'text/css';
        link.href = '/extensions/tag_prompt/assets/index.css';
        document.head.appendChild(link);
    },
    getCustomWidgets: async (_app) => {
        return {
            MY_STRING: (node, inputName, inputData, _app, _widgetName) => {
                const editor = new Editor();
                editor.mount();
                const widget = (node as any).addDOMWidget(inputName, inputData[0], editor.element, {
                    getValue: () => {
                        return editor.state;
                    },
                    setValue: (newValue) => {
                        editor.state = newValue;
                    },
                });
                const originalOnRemove = widget.onRemove;
                widget.onRemove = () => {
                    editor.unmount();
                    originalOnRemove?.call(widget);
                };
                return {widget: widget, minWidth: 400, minHeight: 300};
            }
        }
    },
};

app.registerExtension(extension);
