import os
from server import PromptServer
from aiohttp import web
from .node import TagPromptNode

NODE_CLASS_MAPPINGS = {
    "TagPromptNode": TagPromptNode
}
WEB_DIRECTORY = "./web/js"
__all__ = ['NODE_CLASS_MAPPINGS', 'WEB_DIRECTORY']

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
