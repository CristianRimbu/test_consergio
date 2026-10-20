"""Build the Hotel Belvedere diorama for the ConSergio landing page.

Run:  blender -b -P build_hotel.py
Outputs:
  blender/hotel_scene.blend           full editable scene (objects not merged)
  public/models/hotel.glb             web export (static props merged, animated parts kept)
  blender/renders/hotel_*.png         preview renders

Conventions (Blender space, Z up, front of the hotel faces -Y):
  floors  : F0 lobby z 0.1 .. 3.6 | F1 room 101 z 3.85 .. 7.2 | F2 z 7.45 .. 10.8 | roof 10.8
  hotel   : x -8 .. 8, y -5.5 .. 5.5
Objects whose names are listed in KEEP (and their children) are exported as separate
nodes so the website can animate them.
"""
import bpy, bmesh, os, math, random
from mathutils import Vector, Matrix

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
FONT_B = "/usr/share/fonts/truetype/ubuntu/Ubuntu-B.ttf"
os.makedirs(os.path.join(HERE, "renders"), exist_ok=True)
random.seed(7)

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
COL = scene.collection

KEEP = set()  # names of top-level animated nodes


# ------------------------------------------------------------------ materials
def hex2lin(h):
    h = h.lstrip("#")
    c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple(((x + 0.055) / 1.055) ** 2.4 if x > 0.04045 else x / 12.92 for x in c)


MATS = {}


def mat(name, hexc, rough=0.8, metal=0.0, emit=None, emit_strength=1.0, alpha=1.0):
    if name in MATS:
        return MATS[name]
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (*hex2lin(hexc), 1)
    b.inputs["Roughness"].default_value = rough
    b.inputs["Metallic"].default_value = metal
    if emit:
        b.inputs["Emission Color"].default_value = (*hex2lin(emit), 1)
        b.inputs["Emission Strength"].default_value = emit_strength
    if alpha < 1:
        b.inputs["Alpha"].default_value = alpha
        m.surface_render_method = "BLENDED"
    m.diffuse_color = (*hex2lin(hexc), alpha)
    MATS[name] = m
    return m


M = dict(
    base=mat("Base_Side", "#0E5C45", 0.7),
    grass=mat("Grass", "#a6d9bc", 0.95),
    road=mat("Asphalt", "#34433d", 0.95),
    line=mat("Road_Line", "#f2f9f6", 0.8),
    walk=mat("Sidewalk", "#e7e2d7", 0.9),
    curb=mat("Curb", "#cfc8b9", 0.9),
    wall=mat("Wall_Ext", "#f6efe3", 0.85),
    wall_in=mat("Wall_Int", "#fbf8f2", 0.9),
    trim=mat("Brand_Green", "#0E5C45", 0.45),
    trim2=mat("Brand_Emerald", "#25936A", 0.45),
    dark=mat("Brand_Night", "#0E2A22", 0.6),
    roof=mat("Roof", "#1d3b31", 0.8),
    glass=mat("Glass", "#bfe8d8", 0.05, alpha=0.28),
    win=mat("Win_Glow", "#d3ebe5", 0.4, emit="#ffcf7a", emit_strength=0.0),
    lamp=mat("Lamp_Glow", "#fff1cc", 0.3, emit="#ffe2a6", emit_strength=1.0),
    sign=mat("Sign_Glow", "#fff7e6", 0.3, emit="#fff1cf", emit_strength=0.0),
    marble=mat("Marble", "#eee8dd", 0.35),
    wood=mat("Wood", "#c99a6b", 0.6),
    wood_d=mat("Wood_Dark", "#8a5a3b", 0.6),
    rug=mat("Rug", "#cfe9db", 0.95),
    rug2=mat("Rug_Dark", "#177a57", 0.95),
    sofa=mat("Sofa", "#25936A", 0.85),
    cushion=mat("Cushion", "#f2b84b", 0.9),
    gold=mat("Gold", "#d4ad55", 0.3, metal=0.85),
    white=mat("White", "#ffffff", 0.6),
    linen=mat("Linen", "#fbf8f2", 0.9),
    pot=mat("Pot", "#e0d4c0", 0.7),
    leaf1=mat("Leaf_1", "#2FAE7D", 0.8),
    leaf2=mat("Leaf_2", "#25936A", 0.8),
    leaf3=mat("Leaf_3", "#177a57", 0.8),
    leaf4=mat("Leaf_4", "#62c595", 0.8),
    trunk=mat("Trunk", "#7a5236", 0.9),
    water=mat("Water", "#8fd8e8", 0.1, alpha=0.8),
    stone=mat("Stone", "#d7d0c2", 0.9),
    eye=mat("Eye", "#0E2A22", 0.3),
    taxi=mat("Taxi_Yellow", "#f7c948", 0.4),
    car=mat("Car_Blue", "#4f7cff", 0.35),
    tyre=mat("Tyre", "#1d2421", 0.9),
    carwin=mat("Car_Window", "#2a3b35", 0.15),
    phone=mat("Phone_Body", "#0E2A22", 0.25, metal=0.6),
    screen=mat("Phone_Screen", "#081a14", 0.2),
    qr=mat("QR_Mat", "#ffffff", 0.5),
    cloud=mat("Cloud", "#ffffff", 0.95),
    metal=mat("Metal", "#9aa7a1", 0.35, metal=0.8),
)
SKIN = [mat(f"Skin_{i}", c, 0.7) for i, c in enumerate(["#f3cfb1", "#d9a07a", "#a8714c", "#7a4a2e", "#efc19b"])]


# ------------------------------------------------------------------ helpers
def _finish(o, m, bevel, smooth, parent):
    if m:
        o.data.materials.append(m)
    if bevel:
        bm = o.modifiers.new("Bevel", "BEVEL")
        bm.width = bevel
        bm.segments = 2
        bm.limit_method = "ANGLE"
        bm.harden_normals = False
    if smooth:
        for p in o.data.polygons:
            p.use_smooth = True
    if parent:
        o.parent = parent
        o.matrix_parent_inverse = Matrix.Translation(parent.location).inverted()
    return o


def box(name, a, b, m=None, bevel=0.0, parent=None):
    """Axis aligned box from corner a to corner b (world coords)."""
    a, b = Vector(a), Vector(b)
    c = (a + b) / 2
    s = Vector([abs(b[i] - a[i]) for i in range(3)])
    me = bpy.data.meshes.new(name)
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    for v in bm.verts:
        v.co = Vector((v.co.x * s.x, v.co.y * s.y, v.co.z * s.z))
    bm.to_mesh(me); bm.free()
    o = bpy.data.objects.new(name, me)
    o.location = c
    COL.objects.link(o)
    return _finish(o, m, bevel, False, parent)


def cyl(name, loc, r, h, m=None, verts=16, bevel=0.0, smooth=True, parent=None, r2=None):
    """Vertical cylinder (or cone when r2 given) standing on loc."""
    me = bpy.data.meshes.new(name)
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, segments=verts, radius1=r, radius2=r if r2 is None else r2, depth=h)
    for v in bm.verts:
        v.co.z += h / 2
    bm.to_mesh(me); bm.free()
    o = bpy.data.objects.new(name, me)
    o.location = loc
    COL.objects.link(o)
    o = _finish(o, m, bevel, smooth, parent)
    if bevel:  # keep flat caps flat
        for p in o.data.polygons:
            if abs(p.normal.z) > 0.9:
                p.use_smooth = False
    return o


def sphere(name, loc, r, m=None, scale=(1, 1, 1), ico=False, sub=2, parent=None, smooth=True):
    me = bpy.data.meshes.new(name)
    bm = bmesh.new()
    if ico:
        bmesh.ops.create_icosphere(bm, subdivisions=sub, radius=r)
    else:
        bmesh.ops.create_uvsphere(bm, u_segments=20, v_segments=12, radius=r)
    for v in bm.verts:
        v.co = Vector((v.co.x * scale[0], v.co.y * scale[1], v.co.z * scale[2]))
    bm.to_mesh(me); bm.free()
    o = bpy.data.objects.new(name, me)
    o.location = loc
    COL.objects.link(o)
    return _finish(o, m, 0, smooth, parent)


def plane_xz(name, centre, w, h, m=None, parent=None):
    """Upright plane facing -Y with 0..1 UVs (u -> +X, v -> +Z)."""
    me = bpy.data.meshes.new(name)
    hw, hh = w / 2, h / 2
    me.from_pydata([(-hw, 0, -hh), (hw, 0, -hh), (hw, 0, hh), (-hw, 0, hh)], [], [(0, 1, 2, 3)])
    uv = me.uv_layers.new(name="UVMap")
    for i, l in enumerate(me.loops):
        uv.data[i].uv = [(0, 0), (1, 0), (1, 1), (0, 1)][l.vertex_index]
    me.update()
    o = bpy.data.objects.new(name, me)
    o.location = centre
    COL.objects.link(o)
    return _finish(o, m, 0, False, parent)


def empty(name, loc, keep=True):
    e = bpy.data.objects.new(name, None)
    e.location = loc
    e.empty_display_size = 0.5
    COL.objects.link(e)
    if keep:
        KEEP.add(name)
    return e


def text(name, body, loc, size, m, extrude=0.06, parent=None, align="CENTER"):
    cu = bpy.data.curves.new(name, "FONT")
    cu.body = body
    cu.font = bpy.data.fonts.load(FONT_B, check_existing=True)
    cu.size = size
    cu.extrude = extrude
    cu.align_x = align
    cu.align_y = "BOTTOM"
    o = bpy.data.objects.new(name, cu)
    o.location = loc
    o.rotation_euler = (math.radians(90), 0, 0)
    COL.objects.link(o)
    o.data.materials.append(m)
    if parent:
        o.parent = parent
        o.matrix_parent_inverse = Matrix.Translation(parent.location).inverted()
    return o


def look_at(obj, target):
    d = Vector(target) - obj.location
    obj.rotation_euler = d.to_track_quat("-Z", "Y").to_euler()


# ------------------------------------------------------------------ characters
def person(name, loc, body_hex, skin=0, hat=None, suitcase=None, scale=1.0):
    """Pill person in the style of the ConSergio picto: round head, rounded body."""
    g = empty(name, loc)
    x, y, z = loc
    s = scale
    body = cyl(f"{name}_Body", (x, y, z), 0.3 * s, 0.95 * s, mat(f"Body_{body_hex}", body_hex, 0.7),
               verts=24, bevel=0.14 * s, parent=g)
    sphere(f"{name}_Head", (x, y, z + 1.27 * s), 0.27 * s, SKIN[skin], parent=g)
    for ex in (-0.09, 0.09):
        sphere(f"{name}_Eye", (x + ex * s, y - 0.235 * s, z + 1.31 * s), 0.035 * s, M["eye"],
               scale=(1, 0.6, 1.25), parent=g)
    # tiny arms
    for side in (-1, 1):
        sphere(f"{name}_Arm", (x + side * 0.31 * s, y, z + 0.6 * s), 0.09 * s,
               mat(f"Body_{body_hex}", body_hex), scale=(1, 1, 2.6), parent=g)
    if hat == "staff":
        cyl(f"{name}_Hat", (x, y, z + 1.43 * s), 0.2 * s, 0.16 * s, M["trim"], verts=20, parent=g)
        cyl(f"{name}_HatBand", (x, y, z + 1.45 * s), 0.205 * s, 0.04 * s, M["gold"], verts=20, parent=g)
        box(f"{name}_Collar", (x - 0.12, y - 0.31, z + 0.82), (x + 0.12, y - 0.27, z + 0.92), M["white"], parent=g)
    if hat == "cap":
        sphere(f"{name}_Cap", (x, y, z + 1.36 * s), 0.275 * s, mat("Cap", "#ff7a59", 0.8),
               scale=(1, 1, 0.6), parent=g)
    if hat == "hair":
        sphere(f"{name}_Hair", (x, y + 0.03, z + 1.33 * s), 0.285 * s, mat("Hair", "#3b2a20", 0.9),
               scale=(1, 1, 0.85), parent=g)
    if suitcase:
        sx = x + 0.52 * s
        box(f"{name}_Suitcase", (sx - 0.14, y - 0.24, z + 0.08), (sx + 0.14, y + 0.24, z + 0.72),
            mat(f"Case_{suitcase}", suitcase, 0.5), bevel=0.04, parent=g)
        box(f"{name}_Handle", (sx - 0.02, y - 0.1, z + 0.72), (sx + 0.02, y + 0.1, z + 0.98), M["dark"], parent=g)
        for wy in (-0.18, 0.18):
            cyl(f"{name}_Wheel", (sx, y + wy, z), 0.05, 0.08, M["tyre"], verts=8, parent=g)
    return g


# ------------------------------------------------------------------ diorama base
box("Base", (-18, -14, -1.6), (18, 12, 0), M["base"], bevel=0.35)
box("Grass", (-17.75, -13.75, -0.05), (17.75, 11.75, 0.02), M["grass"], bevel=0.2)
box("Road", (-17.75, -12.7, 0.0), (17.75, -8.6, 0.05), M["road"])
for i in range(-7, 8):
    box("RoadDash", (i * 2.4 - 0.6, -10.72, 0.05), (i * 2.4 + 0.6, -10.58, 0.06), M["line"])
box("Sidewalk", (-17.75, -8.6, 0.0), (17.75, -5.5, 0.14), M["walk"])
box("Curb", (-17.75, -8.75, 0.0), (17.75, -8.55, 0.16), M["curb"])
# zebra crossing
for i in range(6):
    box("Zebra", (-13 + i * 0.6, -12.4, 0.05), (-12.7 + i * 0.6, -8.8, 0.06), M["line"])
# side paths around hotel
box("PathL", (-9.2, -5.5, 0.0), (-8.0, 5.5, 0.1), M["walk"])
box("PathR", (8.0, -5.5, 0.0), (9.2, 5.5, 0.1), M["walk"])
box("PathBack", (-9.2, 5.5, 0.0), (9.2, 6.7, 0.1), M["walk"])

# ------------------------------------------------------------------ hotel shell
W0, W1, D0, D1 = -8.0, 8.0, -5.5, 5.5
T = 0.3
H_ROOF = 10.8
box("Wall_Back", (W0, D1 - T, 0), (W1, D1, H_ROOF), M["wall"])
box("Wall_Left", (W0, D0, 0), (W0 + T, D1, H_ROOF), M["wall"])
box("Wall_Right", (W1 - T, D0, 0), (W1, D1, H_ROOF), M["wall"])
# interior faces (lighter) on back wall per floor
box("Wall_Back_In0", (W0 + T, D1 - T - 0.02, 0.1), (W1 - T, D1 - T, 3.6), M["wall_in"])
box("Wall_Back_In1", (W0 + T, D1 - T - 0.02, 3.85), (W1 - T, D1 - T, 7.2), M["wall_in"])
# plinth band
for a, b in (((W0 - 0.05, D1 - T), (W1 + 0.05, D1 + 0.05)), ((W0 - 0.05, D0 - 0.05), (W0 + T, D1 + 0.05)),
             ((W1 - T, D0 - 0.05), (W1 + 0.05, D1 + 0.05)), ((W0 - 0.05, D0 - 0.05), (-1.25, D0 + 0.25)),
             ((1.25, D0 - 0.05), (W1 + 0.05, D0 + 0.25))):
    box("Plinth", (*a, 0), (*b, 0.5), M["trim"], bevel=0.03)
# floor slabs
box("Floor_F0", (W0 + T, D0 + T, 0.0), (W1 - T, D1 - T, 0.1), M["marble"])
box("Slab_F1", (W0 + T, D0 + T, 3.6), (W1 - T, D1 - T, 3.85), M["wall_in"])
box("Slab_F2", (W0 + T, D0 + T, 7.2), (W1 - T, D1 - T, 7.45), M["wall_in"])
box("Roof", (W0 - 0.35, D0 - 0.35, H_ROOF), (W1 + 0.35, D1 + 0.35, H_ROOF + 0.3), M["roof"], bevel=0.05)
# parapet
for a, b in (((W0 - 0.35, D0 - 0.35), (W1 + 0.35, D0 - 0.1)), ((W0 - 0.35, D1 + 0.1), (W1 + 0.35, D1 + 0.35)),
             ((W0 - 0.35, D0 - 0.35), (W0 - 0.1, D1 + 0.35)), ((W1 + 0.1, D0 - 0.35), (W1 + 0.35, D1 + 0.35))):
    box("Parapet", (*a, H_ROOF + 0.3), (*b, H_ROOF + 0.75), M["trim"], bevel=0.03)
# cornice bands on the front
box("Cornice_F1", (W0 - 0.12, D0 - 0.18, 3.5), (W1 + 0.12, D0 + T, 3.9), M["trim"], bevel=0.04)
box("Cornice_F2", (W0 - 0.12, D0 - 0.18, 7.1), (W1 + 0.12, D0 + T, 7.5), M["trim"], bevel=0.04)
# corner pilasters
for x in (W0 - 0.1, W1 - 0.3):
    box("Pilaster", (x, D0 - 0.15, 0.5), (x + 0.4, D0 + 0.2, H_ROOF), M["wall"], bevel=0.04)

# side windows (glow)
def window(name, cx, cy, z0, w, h, facing="-Y", parent=None, glow=True, balcony=False):
    if facing == "-Y":
        box(f"{name}_Frame", (cx - w / 2 - 0.12, cy - 0.06, z0 - 0.12), (cx + w / 2 + 0.12, cy + 0.02, z0 + h + 0.12),
            M["trim"], bevel=0.02, parent=parent)
        box(f"{name}_Pane", (cx - w / 2, cy - 0.09, z0), (cx + w / 2, cy + 0.4, z0 + h),
            M["win"] if glow else M["glass"], parent=parent)
        box(f"{name}_MullV", (cx - 0.035, cy - 0.12, z0), (cx + 0.035, cy - 0.08, z0 + h), M["trim"], parent=parent)
        box(f"{name}_MullH", (cx - w / 2, cy - 0.12, z0 + h * 0.62), (cx + w / 2, cy - 0.08, z0 + h * 0.62 + 0.07),
            M["trim"], parent=parent)
        box(f"{name}_Sill", (cx - w / 2 - 0.2, cy - 0.25, z0 - 0.2), (cx + w / 2 + 0.2, cy, z0 - 0.1),
            M["wall"], parent=parent)
        if balcony:
            bz = z0 - 0.55
            box(f"{name}_Balcony", (cx - w / 2 - 0.5, cy - 0.85, bz - 0.12), (cx + w / 2 + 0.5, cy, bz),
                M["wall"], bevel=0.03, parent=parent)
            box(f"{name}_Rail", (cx - w / 2 - 0.5, cy - 0.87, bz + 0.85), (cx + w / 2 + 0.5, cy - 0.77, bz + 0.92),
                M["trim"], parent=parent)
            n = 9
            for i in range(n):
                px = cx - w / 2 - 0.45 + i * (w + 0.9) / (n - 1)
                box(f"{name}_Post", (px - 0.025, cy - 0.84, bz), (px + 0.025, cy - 0.8, bz + 0.86), M["trim"], parent=parent)
            for s in (-1, 1):
                box(f"{name}_RailS", (cx + s * (w / 2 + 0.5) - 0.04, cy - 0.87, bz + 0.85),
                    (cx + s * (w / 2 + 0.5) + 0.04, cy, bz + 0.92), M["trim"], parent=parent)
        else:
            # flower box
            box(f"{name}_FlowerBox", (cx - w / 2, cy - 0.45, z0 - 0.35), (cx + w / 2, cy - 0.12, z0 - 0.08),
                M["trim2"], parent=parent)
            for i in range(5):
                sphere(f"{name}_Flower", (cx - w / 2 + 0.2 + i * (w - 0.4) / 4, cy - 0.3, z0 - 0.05), 0.15,
                       random.choice([M["leaf1"], M["leaf4"], M["cushion"]]), ico=True, sub=1, parent=parent,
                       smooth=False)
    else:  # side walls, facing +-X
        sx = 1 if facing == "+X" else -1
        box(f"{name}_Frame", (cx - 0.02 * sx, cy - w / 2 - 0.12, z0 - 0.12), (cx + 0.06 * sx, cy + w / 2 + 0.12, z0 + h + 0.12),
            M["trim"], parent=parent)
        x_a, x_b = sorted((cx - 0.42 * sx, cx + 0.09 * sx))
        box(f"{name}_Pane", (x_a, cy - w / 2, z0), (x_b, cy + w / 2, z0 + h), M["win"], parent=parent)
        x_a, x_b = sorted((cx + 0.08 * sx, cx + 0.12 * sx))
        box(f"{name}_MullV", (x_a, cy - 0.035, z0), (x_b, cy + 0.035, z0 + h), M["trim"], parent=parent)


for z0 in (4.5, 8.1):
    for cy in (-2.6, 2.4):
        window("SideL", W0, cy, z0, 1.6, 1.9, "-X")
        window("SideR", W1, cy, z0, 1.6, 1.9, "+X")
for cy in (-2.6,):
    window("SideL0", W0, cy, 1.0, 1.6, 2.0, "-X")
    window("SideR0", W1, cy, 1.0, 1.6, 2.0, "+X")

# ------------------------------------------------------------------ facade F0 (glass lobby) - animated
f0 = empty("Facade_F0", (0, D0 + 0.15, 0.1))
GY = D0 + 0.12
for (x0, x1) in ((-7.7, -1.25), (1.25, 7.7)):
    box("F0_Glass", (x0, GY - 0.03, 0.5), (x1, GY + 0.03, 3.5), M["glass"], parent=f0)
box("F0_GlassTop", (-1.25, GY - 0.03, 2.75), (1.25, GY + 0.03, 3.5), M["glass"], parent=f0)
for x in (-7.7, -5.55, -3.4, -1.25, 1.25, 3.4, 5.55, 7.7):
    box("F0_Mullion", (x - 0.07, GY - 0.08, 0.5), (x + 0.07, GY + 0.08, 3.5), M["trim"], parent=f0)
box("F0_Transom", (-7.7, GY - 0.08, 2.68), (7.7, GY + 0.08, 2.78), M["trim"], parent=f0)
box("F0_TopRail", (-7.7, GY - 0.08, 3.42), (7.7, GY + 0.08, 3.55), M["trim"], parent=f0)

for nm, (x0, x1) in (("Door_L", (-1.2, 0.0)), ("Door_R", (0.0, 1.2))):
    d = empty(nm, ((x0 + x1) / 2, GY, 0.1))
    box(f"{nm}_Glass", (x0 + 0.06, GY - 0.02, 0.2), (x1 - 0.06, GY + 0.02, 2.62), M["glass"], parent=d)
    box(f"{nm}_FrameT", (x0, GY - 0.05, 2.58), (x1, GY + 0.05, 2.68), M["gold"], parent=d)
    box(f"{nm}_FrameB", (x0, GY - 0.05, 0.12), (x1, GY + 0.05, 0.22), M["gold"], parent=d)
    for xx in (x0, x1 - 0.06):
        box(f"{nm}_FrameS", (xx, GY - 0.05, 0.12), (xx + 0.06, GY + 0.05, 2.68), M["gold"], parent=d)
    hx = x1 - 0.2 if nm == "Door_L" else x0 + 0.2
    box(f"{nm}_Handle", (hx - 0.03, GY - 0.12, 0.9), (hx + 0.03, GY - 0.06, 1.7), M["gold"], parent=d)

# canopy + entrance
box("Canopy", (-2.8, -7.4, 3.0), (2.8, D0, 3.2), M["trim"], bevel=0.04)
box("Canopy_Under", (-2.7, -7.3, 2.96), (2.7, D0, 3.0), M["lamp"])
for x in (-2.5, 2.5):
    cyl("Canopy_Pole", (x, -7.15, 0.14), 0.06, 2.86, M["gold"], verts=10)
text("Canopy_Text", "HOTEL BELVEDERE", (0, -7.42, 3.03), 0.17, M["sign"], extrude=0.01)
box("Entrance_Carpet", (-1.1, -8.5, 0.14), (1.1, D0, 0.16), M["rug2"])
for x in (-2.0, 2.0):
    cyl("Planter", (x, -6.1, 0.14), 0.32, 0.55, M["trim"], verts=16, bevel=0.03)
    sphere("Topiary", (x, -6.1, 1.15), 0.42, M["leaf3"], ico=True, sub=2, smooth=False)
    sphere("Topiary2", (x, -6.1, 1.75), 0.28, M["leaf1"], ico=True, sub=2, smooth=False)
# bushes along facade
for x in (-7.2, -6.0, -4.8, -3.6, 3.6, 4.8, 6.0, 7.2):
    sphere("Bush", (x, -5.95, 0.35), 0.45, random.choice([M["leaf1"], M["leaf2"], M["leaf4"]]),
           scale=(1.3, 0.8, 0.8), ico=True, sub=1, smooth=False)

# ------------------------------------------------------------------ facade F1 (room floor) - animated
f1 = empty("Facade_F1", (0, D0 + 0.15, 3.9))
box("F1_Wall", (W0 + T, D0, 3.9), (W1 - T, D0 + T, 7.1), M["wall"], parent=f1)
for cx, bal in ((-5.6, True), (-2.4, True), (2.4, False), (5.6, False)):
    window(f"F1_Win{cx}", cx, D0, 4.5, 1.6, 1.9, "-Y", parent=f1, balcony=bal)
# facade F2 (static)
box("F2_Wall", (W0 + T, D0, 7.5), (W1 - T, D0 + T, H_ROOF), M["wall"])
for cx in (-5.6, -2.4, 2.4, 5.6):
    window(f"F2_Win{cx}", cx, D0, 8.1, 1.6, 1.9, "-Y")

# rooftop sign
sign_g = empty("Roof_Sign", (0, D0 + 0.2, H_ROOF + 0.75), keep=False)
for x in (-4.2, 0.0, 4.2):
    box("Sign_Post", (x - 0.06, D0 + 0.35, H_ROOF + 0.3), (x + 0.06, D0 + 0.47, H_ROOF + 2.9), M["dark"])
box("Sign_Bar", (-4.6, D0 + 0.35, H_ROOF + 1.0), (4.6, D0 + 0.47, H_ROOF + 1.1), M["dark"])
text("Sign_Text", "BELVEDERE", (0, D0 + 0.3, H_ROOF + 0.85), 1.45, M["sign"], extrude=0.09)
text("Sign_Hotel", "HOTEL", (0, D0 + 0.3, H_ROOF + 2.2), 0.55, M["trim2"], extrude=0.06)
for i in range(4):
    sx = -4.6 + i * 3.06
    # tiny stars
    sphere("Sign_Star", (sx if i < 2 else sx + 0.0, D0 + 0.28, H_ROOF + 2.45), 0.09, M["gold"], ico=True, sub=1, smooth=False) if i in (1, 2) else None
# roof props
box("AC_Unit", (3.5, 1.0, H_ROOF + 0.3), (5.3, 2.6, H_ROOF + 1.2), M["metal"], bevel=0.05)
box("AC_Unit2", (-6.5, 2.0, H_ROOF + 0.3), (-5.0, 3.4, H_ROOF + 1.0), M["metal"], bevel=0.05)
cyl("Water_Tank", (-2.0, 3.0, H_ROOF + 0.3), 0.9, 1.6, M["wood_d"], verts=16)
cyl("Water_Tank_Roof", (-2.0, 3.0, H_ROOF + 1.9), 1.0, 0.6, M["roof"], verts=16, r2=0.05)
box("Elev_Housing", (4.4, 2.4, H_ROOF + 0.3), (7.9, 5.4, H_ROOF + 1.8), M["wall"], bevel=0.04)

# ------------------------------------------------------------------ elevator
EX0, EX1, EY = 4.6, 7.7, 2.6
for fz, ftop, tag in ((0.1, 3.6, "0"), (3.85, 7.2, "1")):
    box(f"Elev{tag}_PierL", (EX0, EY, fz), (5.3, EY + 0.3, ftop), M["wall_in"])
    box(f"Elev{tag}_PierR", (7.0, EY, fz), (EX1, EY + 0.3, ftop), M["wall_in"])
    box(f"Elev{tag}_Lintel", (5.3, EY, fz + 2.5), (7.0, EY + 0.3, ftop), M["wall_in"])
    box(f"Elev{tag}_Frame", (5.22, EY - 0.06, fz), (7.08, EY + 0.02, fz + 2.6), M["gold"])
    box(f"Elev{tag}_Light", (5.95, EY - 0.08, fz + 2.68), (6.35, EY - 0.02, fz + 2.84), M["lamp"])
    # open cabin: mirrored back wall at the end of the shaft, warm ceiling light
    box(f"Elev{tag}_Back", (4.9, D1 - T - 0.06, fz), (EX1, D1 - T - 0.02, ftop), M["gold"])
    box(f"Elev{tag}_CabinLight", (5.6, 3.4, ftop - 0.06), (6.8, 4.6, ftop - 0.02), M["lamp"])
    for nm, (x0, x1) in ((f"Elev{tag}_DoorL", (5.3, 6.15)), (f"Elev{tag}_DoorR", (6.15, 7.0))):
        d = empty(nm, ((x0 + x1) / 2, EY + 0.04, fz))
        box(f"{nm}_Panel", (x0, EY - 0.0, fz), (x1, EY + 0.08, fz + 2.5), M["metal"], parent=d)
box("Elev_ShaftSide", (EX0, EY, 0.1), (EX0 + 0.3, D1 - T, 7.2), M["wall_in"])
box("Elev2_Front", (EX0, EY, 7.45), (EX1, EY + 0.3, H_ROOF), M["wall_in"])

# ------------------------------------------------------------------ lobby (F0)
FZ = 0.1
# reception desk
box("Desk_Body", (-5.6, 1.8, FZ), (-1.4, 2.6, FZ + 1.1), M["trim"], bevel=0.04)
box("Desk_Stripe", (-5.62, 1.76, FZ + 0.75), (-1.38, 1.82, FZ + 0.85), M["gold"])
box("Desk_Top", (-5.75, 1.65, FZ + 1.1), (-1.25, 2.75, FZ + 1.18), M["wood"], bevel=0.02)
text("Desk_Text", "RECEPTION", (-3.5, 1.75, FZ + 0.32), 0.22, M["gold"], extrude=0.01)
bell = empty("Desk_Bell", (-4.7, 2.0, FZ + 1.18))
cyl("Bell_Base", (-4.7, 2.0, FZ + 1.18), 0.12, 0.03, M["dark"], verts=20, parent=bell)
sphere("Bell_Dome", (-4.7, 2.0, FZ + 1.21), 0.1, M["gold"], scale=(1, 1, 0.8), parent=bell)
sphere("Bell_Knob", (-4.7, 2.0, FZ + 1.3), 0.025, M["gold"], parent=bell)
mon = empty("Desk_Monitor", (-2.3, 2.4, FZ + 1.18))
box("Monitor_Stand", (-2.33, 2.42, FZ + 1.18), (-2.27, 2.48, FZ + 1.45), M["dark"], parent=mon)
box("Monitor_Body", (-2.7, 2.3, FZ + 1.4), (-1.9, 2.36, FZ + 1.9), M["dark"], parent=mon)
box("Desk_Screen", (-2.66, 2.36, FZ + 1.44), (-1.94, 2.37, FZ + 1.86), M["lamp"], parent=mon)
# back wall behind desk
box("Desk_Wall", (-6.2, D1 - T - 0.08, 1.0), (-0.8, D1 - T - 0.02, 3.3), M["trim"], bevel=0.02)
text("Desk_Wall_Text", "BELVEDERE", (-3.5, D1 - T - 0.1, 2.55), 0.42, M["sign"], extrude=0.02)
for i in range(6):
    for j in range(2):
        box("Key_Box", (-5.4 + i * 0.6, D1 - T - 0.18, 1.35 + j * 0.45),
            (-4.95 + i * 0.6, D1 - T - 0.08, 1.7 + j * 0.45), M["wood"], bevel=0.01)
        sphere("Key", (-5.17 + i * 0.6, D1 - T - 0.2, 1.5 + j * 0.45), 0.04, M["gold"], ico=True, sub=1)
# pendant lamps
for x, y in ((-4.6, 2.2), (-2.4, 2.2), (1.2, -1.2), (4.2, -2.2)):
    cyl("Lamp_Cord", (x, y, 2.75), 0.015, 0.85, M["dark"], verts=6)
    cyl("Lamp_Shade", (x, y, 2.5), 0.32, 0.3, M["gold"], verts=20, r2=0.08)
    sphere("Lamp_Bulb", (x, y, 2.52), 0.13, M["lamp"])
# lounge
box("Lounge_Rug", (2.4, -4.6, FZ), (6.8, -0.8, FZ + 0.02), M["rug"])
box("Sofa_Base", (2.9, -1.6, FZ), (6.1, -0.8, FZ + 0.45), M["sofa"], bevel=0.08)
box("Sofa_Back", (2.9, -1.0, FZ + 0.45), (6.1, -0.7, FZ + 1.05), M["sofa"], bevel=0.1)
for x0 in (2.9, 5.8):
    box("Sofa_Arm", (x0, -1.6, FZ + 0.45), (x0 + 0.3, -0.8, FZ + 0.75), M["sofa"], bevel=0.08)
for x in (3.6, 5.4):
    box("Sofa_Pillow", (x - 0.3, -1.15, FZ + 0.48), (x + 0.3, -0.95, FZ + 0.95), M["cushion"], bevel=0.08)
cyl("Coffee_Table", (4.5, -2.9, FZ), 0.7, 0.42, M["wood"], verts=24, bevel=0.03)
cyl("Coffee_Vase", (4.5, -2.9, FZ + 0.42), 0.1, 0.25, M["white"], verts=12)
sphere("Coffee_Flowers", (4.5, -2.9, FZ + 0.78), 0.2, M["cushion"], ico=True, sub=1, smooth=False)
for x, y in ((3.0, -3.9), (6.0, -3.9)):
    box("Armchair", (x - 0.45, y - 0.45, FZ), (x + 0.45, y + 0.45, FZ + 0.45), M["cushion"], bevel=0.1)
    box("Armchair_Back", (x - 0.45, y - 0.55, FZ + 0.45), (x + 0.45, y - 0.3, FZ + 0.95), M["cushion"], bevel=0.1)
# lobby rug + plants
box("Lobby_Rug", (-5.2, -4.8, FZ), (-1.8, 1.4, FZ + 0.02), M["rug2"])
for x, y in ((-7.2, -4.7), (-7.2, 1.5), (3.9, 4.7), (7.2, -4.7), (-0.8, 4.7)):
    cyl("Plant_Pot", (x, y, FZ), 0.3, 0.6, M["pot"], verts=12, bevel=0.02)
    for k in range(3):
        sphere("Plant_Leaves", (x + random.uniform(-.12, .12), y + random.uniform(-.12, .12), FZ + 0.9 + k * 0.35),
               0.38 - k * 0.08, random.choice([M["leaf1"], M["leaf2"], M["leaf3"]]), ico=True, sub=1, smooth=False)
# luggage trolley
for x in (-6.6, -5.4):
    cyl("Trolley_Post", (x, -2.8, FZ + 0.25), 0.035, 1.8, M["gold"], verts=8)
box("Trolley_Base", (-6.75, -3.2, FZ + 0.18), (-5.25, -2.4, FZ + 0.28), M["gold"])
box("Trolley_Top", (-6.65, -2.84, FZ + 2.02), (-5.35, -2.76, FZ + 2.08), M["gold"])
box("Trolley_Case1", (-6.6, -3.1, FZ + 0.28), (-5.9, -2.5, FZ + 0.95), M["car"], bevel=0.04)
box("Trolley_Case2", (-5.85, -3.05, FZ + 0.28), (-5.4, -2.55, FZ + 0.75), M["taxi"], bevel=0.04)
box("Trolley_Case3", (-6.4, -3.0, FZ + 0.95), (-5.6, -2.6, FZ + 1.3), M["sofa"], bevel=0.04)
for x in (-6.6, -5.4):
    for y in (-3.1, -2.5):
        cyl("Trolley_Wheel", (x, y, FZ), 0.08, 0.1, M["tyre"], verts=8)

# ------------------------------------------------------------------ room 101 (F1)
RZ = 3.85
box("Partition_A", (-0.15, D0 + T, RZ), (0.15, 0.4, 7.2), M["wall_in"])
box("Partition_B", (-0.15, 1.6, RZ), (0.15, D1 - T, 7.2), M["wall_in"])
box("Partition_C", (-0.15, 0.4, 6.25), (0.15, 1.6, 7.2), M["wall_in"])
box("Room_Floor", (W0 + T, D0 + T, RZ), (-0.15, D1 - T, RZ + 0.03), M["wood"])
box("Corr_Floor", (0.15, D0 + T, RZ), (W1 - T, D1 - T, RZ + 0.03), M["rug"])
door = empty("Room101_Door", (0.0, 0.4, RZ))
box("Room101_Door_Leaf", (-0.05, 0.4, RZ + 0.03), (0.05, 1.6, 6.25), M["wood_d"], parent=door)
sphere("Room101_Door_Knob", (0.1, 1.45, RZ + 1.1), 0.05, M["gold"], parent=door)
sphere("Room101_Door_Knob2", (-0.1, 1.45, RZ + 1.1), 0.05, M["gold"], parent=door)
box("Room101_Plate", (0.16, 1.7, RZ + 1.8), (0.19, 2.2, RZ + 2.1), M["gold"])
# bed
box("Room_Rug", (-6.3, 1.4, RZ + 0.03), (-1.7, 4.8, RZ + 0.05), M["rug"])
box("Bed_Frame", (-5.2, 2.4, RZ + 0.03), (-2.8, 5.15, RZ + 0.4), M["wood"], bevel=0.03)
box("Bed_Mattress", (-5.12, 2.48, RZ + 0.4), (-2.88, 5.05, RZ + 0.68), M["linen"], bevel=0.06)
box("Bed_Duvet", (-5.18, 2.42, RZ + 0.55), (-2.82, 4.2, RZ + 0.76), M["linen"], bevel=0.08)
box("Bed_Throw", (-5.22, 2.7, RZ + 0.62), (-2.78, 3.3, RZ + 0.8), M["trim2"], bevel=0.04)
for x in (-4.45, -3.55):
    box("Bed_Pillow", (x - 0.38, 4.35, RZ + 0.66), (x + 0.38, 4.9, RZ + 0.9), M["white"], bevel=0.09)
box("Bed_Headboard", (-5.45, 5.0, RZ + 0.03), (-2.55, 5.18, RZ + 1.55), M["trim"], bevel=0.06)
for x0 in (-6.35, -2.5):
    box("Nightstand", (x0, 4.4, RZ + 0.03), (x0 + 0.8, 5.15, RZ + 0.62), M["wood"], bevel=0.03)
    box("Nightstand_Drawer", (x0 + 0.08, 4.37, RZ + 0.3), (x0 + 0.72, 4.4, RZ + 0.5), M["wood_d"])
cyl("Room_Lamp_Base", (-5.95, 4.8, RZ + 0.62), 0.09, 0.35, M["gold"], verts=10)
cyl("Room_Lamp_Shade", (-5.95, 4.8, RZ + 0.95), 0.22, 0.3, M["lamp"], verts=16, r2=0.15)
# wall art over bed
box("Art_Frame", (-4.7, 5.12, RZ + 1.8), (-3.3, 5.18, RZ + 2.75), M["gold"])
box("Art_Canvas", (-4.62, 5.1, RZ + 1.88), (-3.38, 5.12, RZ + 2.67), M["rug"])
sphere("Art_Sun", (-3.75, 5.08, RZ + 2.4), 0.14, M["cushion"], scale=(1, 0.2, 1))
for i, c in enumerate((M["leaf2"], M["leaf3"])):
    sphere("Art_Hill", (-4.25 + i * 0.45, 5.09, RZ + 2.1), 0.3 - i * 0.05, c, scale=(1, 0.1, 0.65))
# desk + chair + armchair
box("Room_Desk", (-7.7, -3.6, RZ + 0.75), (-6.8, -1.4, RZ + 0.82), M["wood"], bevel=0.02)
for y in (-3.5, -1.5):
    box("Room_Desk_Leg", (-7.0, y - 0.04, RZ), (-6.92, y + 0.04, RZ + 0.75), M["wood_d"])
box("Room_Chair", (-6.6, -2.8, RZ + 0.45), (-6.1, -2.2, RZ + 0.52), M["trim2"], bevel=0.04)
box("Room_Chair_Back", (-6.15, -2.8, RZ + 0.52), (-6.08, -2.2, RZ + 1.1), M["trim2"], bevel=0.03)
cyl("Room_Chair_Leg", (-6.35, -2.5, RZ), 0.04, 0.45, M["metal"], verts=8)
box("Room_TV", (-7.68, -3.2, RZ + 1.4), (-7.62, -1.8, RZ + 2.2), M["dark"])
box("Wardrobe", (-7.7, 0.2, RZ + 0.03), (-6.95, 2.2, RZ + 2.4), M["wood"], bevel=0.03)
box("Wardrobe_Line", (-6.95, 1.18, RZ + 0.2), (-6.92, 1.22, RZ + 2.25), M["wood_d"])
box("Room_Ceiling_Light", (-4.5, -0.6, 7.12), (-3.5, 0.4, 7.2), M["lamp"])
# corridor plant + light
cyl("Corr_Pot", (2.2, 4.6, RZ), 0.3, 0.6, M["pot"], verts=12)
sphere("Corr_Plant", (2.2, 4.6, RZ + 1.0), 0.45, M["leaf1"], ico=True, sub=1, smooth=False)
box("Corr_Light", (2.5, -1.0, 7.12), (3.5, 0.0, 7.2), M["lamp"])

# QR stand on the right nightstand - animated / textured by the web
QRX, QRY, QRZ = -2.1, 4.75, RZ + 0.62
qr = empty("QR_Stand", (QRX, QRY, QRZ))
box("QR_Base", (QRX - 0.3, QRY - 0.12, QRZ), (QRX + 0.3, QRY + 0.14, QRZ + 0.06), M["trim"], bevel=0.02, parent=qr)
plate = box("QR_Plate", (QRX - 0.27, QRY - 0.02, QRZ + 0.05), (QRX + 0.27, QRY + 0.02, QRZ + 0.78), M["white"],
            bevel=0.01, parent=qr)
qp = plane_xz("QR_Code", (QRX, QRY - 0.025, QRZ + 0.415), 0.5, 0.69, M["qr"], parent=qr)

# ------------------------------------------------------------------ exterior props
def tree(x, y, s=1.0):
    cyl("Tree_Trunk", (x, y, 0.0), 0.16 * s, 1.4 * s, M["trunk"], verts=8, smooth=False)
    sphere("Tree_Top", (x, y, 2.0 * s), 1.0 * s, random.choice([M["leaf1"], M["leaf2"], M["leaf3"]]),
           ico=True, sub=1, smooth=False)
    sphere("Tree_Top2", (x + 0.3 * s, y - 0.2 * s, 2.8 * s), 0.7 * s, random.choice([M["leaf1"], M["leaf4"]]),
           ico=True, sub=1, smooth=False)


def pine(x, y, s=1.0):
    cyl("Pine_Trunk", (x, y, 0.0), 0.14 * s, 0.8 * s, M["trunk"], verts=8, smooth=False)
    for k in range(3):
        cyl("Pine_Layer", (x, y, (0.7 + k * 0.75) * s), (1.0 - k * 0.25) * s, 1.1 * s,
            random.choice([M["leaf2"], M["leaf3"]]), verts=8, r2=0.05, smooth=False)


for x, y, s in ((-14.5, -6.8, 1.1), (14.5, -6.8, 1.0), (-11.0, 8.5, 1.2), (11.5, 8.6, 1.1), (-2.5, 9.6, 0.9),
                (3.8, 9.4, 1.0), (16.0, 2.0, 0.9), (-16.2, 6.0, 0.8)):
    tree(x, y, s)
for x, y, s in ((-13.0, 2.0, 1.1), (13.0, -2.0, 1.2), (14.5, 5.0, 1.0), (-15.5, -2.5, 0.9), (-7.5, 9.8, 1.0),
                (8.0, 9.9, 0.9), (0.6, 10.4, 1.1)):
    pine(x, y, s)
for x in (-10.5, 10.5):
    cyl("Lamp_Post", (x, -8.1, 0.14), 0.07, 4.0, M["dark"], verts=10)
    box("Lamp_Arm", (x - 0.05, -8.1, 4.0), (x + 0.05, -7.4, 4.1), M["dark"])
    box("Lamp_Head", (x - 0.25, -7.65, 3.85), (x + 0.25, -7.15, 4.12), M["dark"], bevel=0.03)
    box("Lamp_Light", (x - 0.2, -7.6, 3.82), (x + 0.2, -7.2, 3.86), M["lamp"])
# bench
box("Bench_Seat", (6.0, -7.9, 0.55), (7.8, -7.4, 0.62), M["wood"], bevel=0.02)
box("Bench_Back", (6.0, -7.45, 0.62), (7.8, -7.38, 1.1), M["wood"], bevel=0.02)
for x in (6.2, 7.6):
    box("Bench_Leg", (x - 0.05, -7.9, 0.14), (x + 0.05, -7.4, 0.55), M["dark"])
# fountain
cyl("Fountain_Rim", (-12.6, -1.0 + 4.0, 0.0), 1.6, 0.45, M["stone"], verts=24, bevel=0.05)
cyl("Fountain_Water", (-12.6, 3.0, 0.0), 1.42, 0.4, M["water"], verts=24)
cyl("Fountain_Col", (-12.6, 3.0, 0.0), 0.2, 1.2, M["stone"], verts=12)
cyl("Fountain_Bowl", (-12.6, 3.0, 1.2), 0.6, 0.18, M["stone"], verts=16, r2=0.3)
# flower beds
for x, y in ((-11.5, -4.2), (11.5, -4.2), (11.0, 3.6)):
    box("Bed_Border", (x - 1.4, y - 0.6, 0.0), (x + 1.4, y + 0.6, 0.18), M["stone"], bevel=0.04)
    for i in range(6):
        sphere("Flower", (x - 1.1 + i * 0.44, y + random.uniform(-.25, .25), 0.32), 0.2,
               random.choice([M["cushion"], mat("Flower_Pink", "#ff8fb1", 0.8), M["white"], M["leaf4"]]),
               ico=True, sub=1, smooth=False)

# parked car (static)
def car(name, x, y, body, parent=None, taxi=False):
    box(f"{name}_Body", (x - 1.3, y - 0.6, 0.25), (x + 1.3, y + 0.6, 0.85), body, bevel=0.15, parent=parent)
    box(f"{name}_Cabin", (x - 0.75, y - 0.52, 0.85), (x + 0.6, y + 0.52, 1.35), body, bevel=0.12, parent=parent)
    box(f"{name}_WinF", (x + 0.58, y - 0.45, 0.9), (x + 0.64, y + 0.45, 1.28), M["carwin"], parent=parent)
    box(f"{name}_WinS", (x - 0.65, y - 0.55, 0.92), (x + 0.5, y + 0.55, 1.26), M["carwin"], parent=parent)
    box(f"{name}_Lights", (x + 1.25, y - 0.5, 0.55), (x + 1.33, y + 0.5, 0.68), M["lamp"], parent=parent)
    for wx in (-0.8, 0.8):
        for wy in (-0.6, 0.6):
            w = cyl(f"{name}_Wheel", (0, 0, 0), 0.3, 0.22, M["tyre"], verts=14, parent=None)
            w.rotation_euler = (math.radians(90), 0, 0)
            w.location = (x + wx, y + wy + (0.11 if wy > 0 else -0.11) * 0, 0.3)
            if parent:
                w.parent = parent
                w.matrix_parent_inverse = Matrix.Translation(parent.location).inverted()
    if taxi:
        box(f"{name}_Sign", (x - 0.3, y - 0.18, 1.35), (x + 0.3, y + 0.18, 1.6), M["white"], bevel=0.04, parent=parent)
        text(f"{name}_SignText", "TAXI", (x, y - 0.19, 1.39), 0.15, M["dark"], extrude=0.005, parent=parent)
        for i in range(5):
            box(f"{name}_Check", (x - 1.0 + i * 0.4, y - 0.62, 0.55), (x - 0.8 + i * 0.4, y + 0.62, 0.65),
                M["dark"], parent=parent)


taxi_g = empty("Taxi", (0, -9.6, 0.05))
car("Taxi", 0, -9.6, M["taxi"], parent=taxi_g, taxi=True)
car("Car", 12.0, -9.6, M["car"])

# clouds
for i, (x, y, z, s) in enumerate(((-11, 3, 17, 1.4), (10, -1, 19, 1.2), (2, 9, 21, 1.6), (-4, -6, 23, 1.0))):
    g = empty(f"Cloud_{i}", (x, y, z))
    for k in range(5):
        sphere(f"Cloud_{i}_Puff", (x + (k - 2) * 0.9 * s, y + random.uniform(-.3, .3), z + random.uniform(-.2, .4)),
               (0.9 - abs(k - 2) * 0.18) * s, M["cloud"], ico=True, sub=2, smooth=True, parent=g)

# ------------------------------------------------------------------ people
person("Guest_A", (-0.7, -7.3, 0.14), "#ff7a59", skin=0, hat="hair", suitcase="#25936A")
person("Guest_B", (0.7, -7.3, 0.14), "#f2b84b", skin=2, hat="cap", suitcase="#4f7cff")
person("Queue_1", (-3.5, 0.9, FZ), "#4f7cff", skin=1)
person("Queue_2", (-3.3, -0.4, FZ), "#9b6bff", skin=3, hat="hair", suitcase="#f2b84b")
person("Queue_3", (-3.6, -1.7, FZ), "#2bb3c0", skin=4)
person("Queue_4", (-3.4, -3.0, FZ), "#ff8fb1", skin=1, hat="hair")
person("Staff", (-3.5, 3.4, FZ), "#0E5C45", skin=1, hat="staff")
person("Staff_2", (-1.9, 3.3, FZ), "#0E5C45", skin=3, hat="staff")
person("Lounge_Guest", (4.5, -1.15, FZ + 0.25), "#9b6bff", skin=0)

# phone (positioned by the web)
ph = empty("Phone", (0, -20, 1.0))
box("Phone_BodyMesh", (-0.19, -20.02, 0.62), (0.19, -19.98, 1.38), M["phone"], bevel=0.04, parent=ph)
plane_xz("Phone_Display", (0, -20.025, 1.0), 0.34, 0.7, M["screen"], parent=ph)
box("Phone_Notch", (-0.05, -20.03, 1.31), (0.05, -20.025, 1.34), M["dark"], parent=ph)

# ------------------------------------------------------------------ text -> mesh, preview + save
for o in list(bpy.data.objects):
    if o.type == "FONT":
        bpy.ops.object.select_all(action="DESELECT")
        bpy.context.view_layer.objects.active = o
        o.select_set(True)
        bpy.ops.object.convert(target="MESH")

# preview lighting
world = bpy.data.worlds.new("Sky")
scene.world = world
world.use_nodes = True
world.node_tree.nodes["Background"].inputs[0].default_value = (*hex2lin("#dcefe5"), 1)
world.node_tree.nodes["Background"].inputs[1].default_value = 0.9
sun_d = bpy.data.lights.new("Sun", "SUN"); sun_d.energy = 3.5; sun_d.angle = math.radians(8)
sun = bpy.data.objects.new("Preview_Sun", sun_d); COL.objects.link(sun)
sun.rotation_euler = (math.radians(50), math.radians(10), math.radians(35))
scene.render.engine = "BLENDER_EEVEE"
scene.view_settings.view_transform = "Standard"
scene.render.resolution_x, scene.render.resolution_y = 1600, 1000
cam_d = bpy.data.cameras.new("Cam"); cam_d.lens = 40
cam = bpy.data.objects.new("Preview_Cam", cam_d); COL.objects.link(cam); scene.camera = cam


def render(fn, pos, target, hide=()):
    for n in hide:
        for o in bpy.data.objects:
            if o.name == n or (o.parent and o.parent.name == n):
                o.hide_render = True
    cam.location = pos
    look_at(cam, target)
    scene.render.filepath = os.path.join(HERE, "renders", fn)
    bpy.ops.render.render(write_still=True)
    for o in bpy.data.objects:
        o.hide_render = False


bpy.ops.wm.save_as_mainfile(filepath=os.path.join(HERE, "hotel_scene.blend"))

if "--no-render" not in os.sys.argv:
    render("hotel_exterior.png", (22, -34, 18), (0, 0, 4))
    render("hotel_cutaway.png", (10, -24, 9), (-1, 0, 3.6), hide=("Facade_F0", "Facade_F1", "Door_L", "Door_R"))
    render("hotel_room.png", (-2.5, -4.5, 6.8), (-3.3, 3.5, 4.6), hide=("Facade_F0", "Facade_F1"))

# ------------------------------------------------------------------ export
# drop preview-only objects
for o in (sun, cam):
    bpy.data.objects.remove(o, do_unlink=True)


def top(o):
    while o.parent:
        o = o.parent
    return o


static = [o for o in bpy.data.objects if o.type == "MESH" and top(o).name not in KEEP and o.parent is None]
# apply modifiers on everything so the export is clean
bpy.ops.object.select_all(action="DESELECT")
for o in bpy.data.objects:
    if o.type == "MESH" and o.modifiers:
        bpy.context.view_layer.objects.active = o
        for m in list(o.modifiers):
            bpy.ops.object.modifier_apply(modifier=m.name)
# merge static meshes per material group into one object
bpy.ops.object.select_all(action="DESELECT")
for o in static:
    o.select_set(True)
bpy.context.view_layer.objects.active = static[0]
bpy.ops.object.join()
static[0].name = "World_Static"
bpy.ops.object.select_all(action="DESELECT")

# Roof_Sign helper empty is not needed
for o in list(bpy.data.objects):
    if o.type == "EMPTY" and o.name not in KEEP and not o.children:
        bpy.data.objects.remove(o, do_unlink=True)

bpy.ops.export_scene.gltf(
    filepath=os.path.join(ROOT, "public", "models", "hotel.glb"),
    export_format="GLB",
    export_apply=True,
    export_lights=False,
    export_cameras=False,
)
print("HOTEL DONE keep=", sorted(KEEP))
