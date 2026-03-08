import { app } from '/scripts/app.js';
import type { ComfyExtension } from '@comfyorg/comfyui-frontend-types';
import { Editor } from './editor';

const extension: ComfyExtension = {
    name: 'yossq236.TagPromptNode',
    getCustomWidgets: async (_app): Promise<any> => {
        return {
            MY_STRING: (node, inputName, inputData, _app, _widgetName) => {
                const editor = new Editor();
                editor.mount();
                const widget = node.addDOMWidget(inputName, inputData[0], editor.element, {
                    getValue: () => {
                        return editor.state;
                    },
                    setValue: (newValue) => {
                        editor.state = newValue;
                    },
                });
                const originalOnRemoved = node.onRemoved;
                node.onRemoved = function() {
                    editor.unmount();
                    originalOnRemoved?.call(this);
                };
                return {widget: widget, minWidth: 400, minHeight: 300};
            }
        }
    },
};

app.registerExtension(extension);
