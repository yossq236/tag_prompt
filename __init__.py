from typing import override
from comfy_api.latest import ComfyExtension, io
from .node import TagPromptNode
import os
from server import PromptServer
from aiohttp import web

class MyExtension(ComfyExtension):
    @override
    async def get_node_list(self) -> list[type[io.ComfyNode]]:
        return [TagPromptNode]
    @override
    async def on_load(self):
        pass

async def comfy_entrypoint() -> ComfyExtension:
    return MyExtension()

WEB_DIRECTORY = "./web/js"

NODE_DIR = os.path.dirname(__file__)
NODE_WEB_DIR = os.path.join(NODE_DIR, "web")
NODE_WEB_ASSETS_DIR = os.path.join(NODE_WEB_DIR, "assets")

@PromptServer.instance.routes.get("/extensions/tag_prompt/assets/{filename}")
async def get_lib_editor_widget_files(request):
    filename = request.match_info["filename"]
    filepath = os.path.join(NODE_WEB_ASSETS_DIR, filename)
    if os.path.isfile(filepath):
        return web.FileResponse(filepath)
    return web.Response(status=404)
