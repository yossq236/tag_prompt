from comfy_api.latest import io
import json
import re

class TagPromptNode(io.ComfyNode):
    @classmethod
    def define_schema(cls) -> io.Schema:
        return io.Schema(
            node_id="TagPromptNode",
            display_name="Tag Prompt",
            category="utils",
            inputs=[io.String.Input("text", multiline=True, extra_dict={"widgetType": "MY_STRING",})],
            outputs=[io.String.Output()]
        )
    
    @classmethod
    def fingerprint_inputs(cls, text):
        parse_text = text
        try:
            obj = json.loads(text)
            if "text" in obj:
                parse_text = obj["text"]
        except json.JSONDecodeError as e:
            pass
        return parse_text
    
    @classmethod
    def execute(cls, text) -> io.NodeOutput:
        parse_text = text
        try:
            obj = json.loads(text)
            if "text" in obj:
                parse_text = obj["text"]
        except json.JSONDecodeError as e:
            pass
        strip_text = re.sub("(#+.*?$)|(//.*?$)|(/\\*.*?\\*/)", "", parse_text, flags=re.MULTILINE | re.DOTALL)
        strip_lines = list(filter(lambda n: n.strip() != "", strip_text.splitlines()))
        result = "\n".join(strip_lines)
        return io.NodeOutput(result)
