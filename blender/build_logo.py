"""Build the ConSergio 3D picto (two heads + moustache) from the brand SVG.

Run:  blender -b -P build_logo.py
Outputs:
  blender/consergio_logo.blend        (kept for editing)
  public/models/logo.glb              (used by the website)
  blender/renders/logo_preview.png    (quick look)
"""
import bpy, bmesh, os, math
from mathutils import Vector, Color

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
os.makedirs(os.path.join(HERE, "renders"), exist_ok=True)

DARK = (0x0E / 255, 0x5C / 255, 0x45 / 255)
LIGHT = (0x2F / 255, 0xAE / 255, 0x7D / 255)


def srgb_to_lin(c):
    return tuple(((x + 0.055) / 1.055) ** 2.4 if x > 0.04045 else x / 12.92 for x in c)


bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_curve.svg(filepath=os.path.join(HERE, "picto.svg"))

parts = [o for o in bpy.data.objects if o.type == "CURVE"]
for o in parts:
    o.data.dimensions = "2D"
    o.data.fill_mode = "BOTH"
    o.data.extrude = 0.0009
    o.data.bevel_depth = 0.00045
    o.data.bevel_resolution = 3
    o.data.resolution_u = 12

# Convert to meshes
bpy.ops.object.select_all(action="DESELECT")
for o in parts:
    o.select_set(True)
bpy.context.view_layer.objects.active = parts[0]
bpy.ops.object.convert(target="MESH")

meshes = [o for o in bpy.data.objects if o.type == "MESH"]

# Normalise: whole picto 2 units wide, centred on origin, standing upright (XZ plane)
bpy.ops.object.select_all(action="SELECT")
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
mn = Vector((1e9, 1e9, 1e9)); mx = Vector((-1e9, -1e9, -1e9))
for o in meshes:
    for v in o.data.vertices:
        p = o.matrix_world @ v.co
        mn = Vector(map(min, mn, p)); mx = Vector(map(max, mx, p))
size = mx - mn
scale = 2.0 / size.x
centre = (mn + mx) / 2

for o in meshes:
    me = o.data
    for v in me.vertices:
        p = (v.co - centre) * scale
        # SVG lies in XY; stand it up so it faces -Y (front in Blender, +Z in glTF)
        v.co = Vector((p.x, -p.z, p.y))
    me.update()
    # origin at geometry centre so the web can animate each part around itself
    bpy.context.view_layer.objects.active = o
    bpy.ops.object.select_all(action="DESELECT")
    o.select_set(True)
    bpy.ops.object.origin_set(type="ORIGIN_GEOMETRY", center="BOUNDS")
    # smooth shading on bevels
    for poly in me.polygons:
        poly.use_smooth = True

# Brand gradient as vertex colour, left (dark) -> right (emerald)
dark_l, light_l = srgb_to_lin(DARK), srgb_to_lin(LIGHT)
for o in meshes:
    me = o.data
    attr = me.color_attributes.new(name="Col", type="BYTE_COLOR", domain="CORNER")
    for loop in me.loops:
        p = o.matrix_world @ me.vertices[loop.vertex_index].co
        t = max(0.0, min(1.0, (p.x + 1.0) / 2.0))
        c = [dark_l[i] * (1 - t) + light_l[i] * t for i in range(3)]
        attr.data[loop.index].color = (*c, 1.0)
    me.color_attributes.active_color = attr

# Material: glossy, uses vertex colour
mat = bpy.data.materials.new("ConSergio_Verde")
mat.use_nodes = True
nt = mat.node_tree
bsdf = nt.nodes["Principled BSDF"]
vc = nt.nodes.new("ShaderNodeVertexColor")
vc.layer_name = "Col"
nt.links.new(vc.outputs["Color"], bsdf.inputs["Base Color"])
bsdf.inputs["Roughness"].default_value = 0.22
bsdf.inputs["Coat Weight"].default_value = 0.6
for o in meshes:
    o.data.materials.clear()
    o.data.materials.append(mat)

names = {"Baffo": "Logo_Baffo", "TestaDx": "Logo_TestaDx", "TestaSx": "Logo_TestaSx"}
for o in meshes:
    for k, v in names.items():
        if o.name.startswith(k):
            o.name = v
            o.data.name = v

root = bpy.data.objects.new("Logo", None)
bpy.context.scene.collection.objects.link(root)
for o in meshes:
    o.parent = root

# ---------- preview render ----------
scene = bpy.context.scene
scene.render.engine = "BLENDER_EEVEE"
scene.render.resolution_x = 1200
scene.render.resolution_y = 800
scene.render.film_transparent = False
scene.view_settings.view_transform = "Standard"
world = bpy.data.worlds.new("W"); scene.world = world
world.use_nodes = True
world.node_tree.nodes["Background"].inputs[0].default_value = (0.86, 0.94, 0.9, 1)
world.node_tree.nodes["Background"].inputs[1].default_value = 1.0

cam_data = bpy.data.cameras.new("Cam"); cam_data.lens = 70
cam = bpy.data.objects.new("PreviewCam", cam_data)
scene.collection.objects.link(cam); scene.camera = cam
cam.location = (1.6, -5.2, 1.0)
cam.rotation_euler = (math.radians(80), 0, math.radians(17))

for loc, energy in (((3, -4, 4), 900), ((-4, -2, 2), 300), ((0, 3, 3), 500)):
    ld = bpy.data.lights.new("L", "AREA"); ld.energy = energy; ld.size = 3
    lo = bpy.data.objects.new("PreviewLight", ld); lo.location = loc
    scene.collection.objects.link(lo)
    lo.rotation_euler = (Vector((0, 0, 0)) - Vector(loc)).to_track_quat("-Z", "Y").to_euler()

scene.render.filepath = os.path.join(HERE, "renders", "logo_preview.png")
bpy.ops.render.render(write_still=True)

bpy.ops.wm.save_as_mainfile(filepath=os.path.join(HERE, "consergio_logo.blend"))

# ---------- export (logo only) ----------
bpy.ops.object.select_all(action="DESELECT")
root.select_set(True)
for o in meshes:
    o.select_set(True)
bpy.ops.export_scene.gltf(
    filepath=os.path.join(ROOT, "public", "models", "logo.glb"),
    use_selection=True,
    export_format="GLB",
    export_vertex_color="ACTIVE",
    export_apply=True,
)
print("LOGO DONE", [o.name for o in meshes], "scale", scale)
