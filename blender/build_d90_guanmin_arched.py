"""Build the dedicated D90 Guanmin transom double-door GLB.

The regular D90 asset is intentionally rectangular because it is shared by
the other products. Guanmin is different: its photographed product has a
fixed arched transom inside the casing, while the two rectangular door leaves
below it are the only moving parts. This asset keeps the same runtime node
contract as d90-door-custom.glb, but separates the fixed transom from the
hinged leaves so opening the door does not rotate the gas window.
"""

import math
import os
import sys
from collections import deque

import bpy

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT = os.path.dirname(SCRIPT_DIR)
if SCRIPT_DIR not in sys.path:
    sys.path.insert(0, SCRIPT_DIR)

import build_d90_door as base


OUTPUT_GLB = os.path.join(PROJECT, "assets", "models", "d90-guanmin-transom-double-door.glb")
OUTPUT_BLEND = os.path.join(SCRIPT_DIR, "d90-guanmin-transom-double-door.blend")
OUTPUT_RENDER = os.path.join(PROJECT, "audit", "20260809-product-fidelity", "blender-guanmin-transom-reference.png")

BASE_W = base.BASE_W
BASE_H = base.BASE_H
JAMB = base.JAMB
HEAD = base.HEAD
THRESHOLD = base.THRESHOLD
LEAF_THICKNESS = base.LEAF_THICKNESS
GAP = base.GAP
SIDE_LIGHT_W = base.SIDE_LIGHT_W

# PDF pp.257-258 show a tall fixed crown inside the casing. It occupies about
# one quarter of the full opening; only the rectangular leaves below it move.
# Keeping one global arch function preserves the continuous ornament across
# the centre seam without flattening the crown into a shallow strip.
ARCH_RISE = 0.550
TRANSOM_H = 1.150
FRAME_BAND = 0.082
CASING_BAND = 0.074
CURVE_STEPS = 32
TRANSOM_CUTOUT = os.path.join(PROJECT, "assets", "catalog", "derived", "d90", "door-skins", "d90-guanmin-fixed-transom-cutout.png")
LEAF_CUTOUT = os.path.join(PROJECT, "assets", "catalog", "derived", "d90", "door-skins", "d90-guanmin-double-leaf-alpha.png")


def prepare_transom_cutout(source_path):
    """Remove only the connected white studio background around the arch.

    The catalog photo is shot on white and has no alpha channel. Mapping that
    rectangle directly to the arched mesh leaves a bright halo around the
    product. Flood-filling from the image border preserves the white metal
    highlights inside the door while making the outside of the fixed transom
    transparent.
    """
    if not os.path.exists(source_path):
        return source_path
    source = bpy.data.images.load(source_path, check_existing=True)
    width, height = source.size[:]
    pixels = list(source.pixels[:])

    def is_studio_white(index):
        r, g, b = pixels[index * 4:index * 4 + 3]
        # Include the pale anti-aliased halo around the photographed arch.
        # Gold remains protected by its warmer channel separation, while
        # neutral near-white pixels connected to the border are background.
        return min(r, g, b) > 0.64 and max(r, g, b) - min(r, g, b) < 0.19

    visited = bytearray(width * height)
    queue = deque()
    for x in range(width):
        queue.extend((x, (height - 1) * width + x))
    for y in range(height):
        queue.extend((y * width, y * width + width - 1))
    while queue:
        index = queue.popleft()
        if visited[index] or not is_studio_white(index):
            continue
        visited[index] = 1
        x, y = index % width, index // width
        if x:
            queue.append(index - 1)
        if x + 1 < width:
            queue.append(index + 1)
        if y:
            queue.append(index - width)
        if y + 1 < height:
            queue.append(index + width)

    cutout = bpy.data.images.new(
        "d90-guanmin-fixed-transom-cutout",
        width=width,
        height=height,
        alpha=True,
        float_buffer=False,
    )
    output = list(pixels)
    for index, background in enumerate(visited):
        if background:
            output[index * 4] = 0.0
            output[index * 4 + 1] = 0.0
            output[index * 4 + 2] = 0.0
            output[index * 4 + 3] = 0.0
    # Remove a one-pixel neutral fringe that can remain between the flood
    # region and the dark/gold edge after texture filtering in Three.js.
    for y in range(height):
        for x in range(width):
            index = y * width + x
            if visited[index]:
                continue
            near_background = any(
                0 <= nx < width and 0 <= ny < height and visited[ny * width + nx]
                for nx, ny in ((x - 1, y), (x + 1, y), (x, y - 1), (x, y + 1))
            )
            if not near_background:
                continue
            r, g, b = pixels[index * 4:index * 4 + 3]
            if min(r, g, b) > 0.46 and max(r, g, b) - min(r, g, b) < 0.24:
                output[index * 4] = 0.0
                output[index * 4 + 1] = 0.0
                output[index * 4 + 2] = 0.0
                output[index * 4 + 3] = 0.0
    cutout.pixels = output
    # Blender can retain the source image's opaque storage mode when copying
    # a JPEG/PNG datablock. Force the exported texture to keep the RGBA alpha
    # channel; otherwise the viewer shows the cutout on black but GLTF still
    # receives an opaque rectangle and the white studio halo returns.
    cutout.alpha_mode = "STRAIGHT"
    cutout.colorspace_settings.name = "sRGB"
    cutout.filepath_raw = TRANSOM_CUTOUT
    cutout.file_format = "PNG"
    cutout.save()
    return TRANSOM_CUTOUT


def prepare_leaf_cutout(source_path):
    """Make the connected white studio background transparent on the leaf map."""
    if not os.path.exists(source_path):
        return source_path
    source = bpy.data.images.load(source_path, check_existing=True)
    width, height = source.size[:]
    pixels = list(source.pixels[:])

    def is_studio_white(index):
        r, g, b = pixels[index * 4:index * 4 + 3]
        # Keep warm gold highlights out of the flood region. Only neutral,
        # near-white pixels touching the image edge are studio background.
        return min(r, g, b) > 0.90 and max(r, g, b) - min(r, g, b) < 0.055

    visited = bytearray(width * height)
    queue = deque()
    for x in range(width):
        queue.extend((x, (height - 1) * width + x))
    for y in range(height):
        queue.extend((y * width, y * width + width - 1))
    while queue:
        index = queue.popleft()
        if visited[index] or not is_studio_white(index):
            continue
        visited[index] = 1
        x, y = index % width, index // width
        if x:
            queue.append(index - 1)
        if x + 1 < width:
            queue.append(index + 1)
        if y:
            queue.append(index - width)
        if y + 1 < height:
            queue.append(index + width)

    cutout = bpy.data.images.new("d90-guanmin-double-leaf-alpha", width=width, height=height, alpha=True)
    cutout.alpha_mode = "STRAIGHT"
    output = list(pixels)
    for index, background in enumerate(visited):
        if background:
            output[index * 4 + 3] = 0.0
    cutout.pixels = output
    cutout.colorspace_settings.name = "sRGB"
    cutout.filepath_raw = LEAF_CUTOUT
    cutout.file_format = "PNG"
    cutout.save()
    return LEAF_CUTOUT


def prism_mesh(name, polygon, depth, material, parent=None, location=(0, 0, 0)):
    """Create a closed x/z polygon extrusion along Blender's y axis."""
    count = len(polygon)
    vertices = [(x, -depth / 2, z) for x, z in polygon]
    vertices += [(x, depth / 2, z) for x, z in polygon]
    faces = [tuple(range(count - 1, -1, -1)), tuple(range(count, count * 2))]
    for index in range(count):
        next_index = (index + 1) % count
        faces.append((index, next_index, count + next_index, count + index))
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    obj.parent = parent
    obj.location = location
    if material:
        mesh.materials.append(material)
    obj["baseDimensions"] = [max(x for x, _ in polygon) - min(x for x, _ in polygon), depth, max(z for _, z in polygon) - min(z for _, z in polygon)]
    return obj


def panel_mesh(name, polygon, material, parent=None, location=(0, 0, 0)):
    """Create a thin double-sided arched face for runtime photo UV mapping."""
    count = len(polygon)
    depth = 0.004
    vertices = [(x, -depth / 2, z) for x, z in polygon]
    vertices += [(x, depth / 2, z) for x, z in polygon]
    faces = [tuple(range(count - 1, -1, -1)), tuple(range(count, count * 2))]
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    obj.parent = parent
    obj.location = location
    if material:
        mesh.materials.append(material)
    obj["baseDimensions"] = [max(x for x, _ in polygon) - min(x for x, _ in polygon), depth, max(z for _, z in polygon) - min(z for _, z in polygon)]
    return obj


def arch_z(global_x, half_span, spring, rise):
    ratio = min(1.0, abs(global_x) / max(0.001, half_span))
    return spring + rise * math.sqrt(max(0.0, 1.0 - ratio * ratio))


def arch_band_polygon(inner_half, inner_spring, inner_rise, outer_half, outer_spring, outer_rise):
    """Return an annular arch band, ordered around the visible profile."""
    outer = []
    inner = []
    for index in range(CURVE_STEPS + 1):
        t = index / CURVE_STEPS
        x = -outer_half + 2 * outer_half * t
        outer.append((x, arch_z(x, outer_half, outer_spring, outer_rise)))
    for index in range(CURVE_STEPS, -1, -1):
        t = index / CURVE_STEPS
        x = -inner_half + 2 * inner_half * t
        inner.append((x, arch_z(x, inner_half, inner_spring, inner_rise)))
    return outer + inner


def leaf_polygon(role, width, leaf_height, opening_width):
    """Build a half-arch leaf from the shared double-door crown.

    The real product has one semicircle across both leaves. Each leaf owns one
    half of that curve, so a leaf must not receive a second independent arch.
    """
    half = width / 2
    opening_half = opening_width / 2
    spring = leaf_height / 2 - ARCH_RISE
    side_sign = -1 if role == "Child" else 1
    center_global_x = side_sign * (opening_half - half)
    bottom = -leaf_height / 2

    def top_for(local_x):
        return arch_z(center_global_x + local_x, opening_half, spring, ARCH_RISE)

    if role == "Child":
        # Counter-clockwise outline: outer bottom -> meeting bottom ->
        # meeting spring -> the shared crown curve back to the outer edge.
        meeting_local = half
        outer_local = -half
        polygon = [(-half, bottom), (half, bottom), (meeting_local, top_for(meeting_local))]
        curve_start = meeting_local
        curve_end = outer_local
    else:
        # The main leaf has the opposite winding. Starting at the meeting
        # bottom and visiting the outer top before tracing the crown avoids a
        # self-intersecting face, which previously produced a second-looking
        # arch on the right leaf in the exported GLB.
        meeting_local = -half
        outer_local = half
        polygon = [(-half, bottom), (half, bottom), (outer_local, top_for(outer_local))]
        curve_start = outer_local
        curve_end = meeting_local

    for index in range(1, CURVE_STEPS + 1):
        t = index / CURVE_STEPS
        local_x = curve_start + (curve_end - curve_start) * t
        polygon.append((local_x, top_for(local_x)))
    return polygon


def tag(obj, resize_mode, role="assembly"):
    obj["resizeMode"] = resize_mode
    obj["role"] = role
    return obj


def add_arch_leaf(role, width, leaf_height, hinge_side, front_mat, back_mat, core_mat, edge_mat, gasket_mat, pivot, opening_width):
    direction = 1 if hinge_side == "left" else -1
    center_x = direction * width / 2
    group = base.empty(f"{role}LeafGeometry", pivot)
    group["role"] = role.lower()
    group["baseWidth"] = width
    group["baseHeight"] = leaf_height
    polygon = leaf_polygon(role, width, leaf_height, opening_width)
    core = prism_mesh(f"{role}_Core", polygon, LEAF_THICKNESS - 0.014, core_mat, group, (center_x, 0, leaf_height / 2))
    tag(core, "leaf-center", role.lower())
    front = panel_mesh(f"DoorLeaf_{role}_Front", polygon, front_mat, group, (center_x, -(LEAF_THICKNESS / 2 + 0.002), leaf_height / 2))
    back = panel_mesh(f"DoorLeaf_{role}_Back", polygon, back_mat, group, (center_x, LEAF_THICKNESS / 2 + 0.002, leaf_height / 2))
    for item in (front, back):
        tag(item, "arched-leaf-face", role.lower())
        item["archedProfile"] = True
        item["baseWidth"] = width
        item["baseHeight"] = leaf_height

    # The complete arched leaf is the moving assembly. There is no independent
    # transom: the upper crown, blue inset and lower panels all belong to it.
    side_height = leaf_height
    for edge_name, local_x in (("Hinge", direction * 0.010), ("Latch", direction * (width - 0.010))):
        edge = base.cube(f"{role}_FoldedEdge_{edge_name}", (0.018, LEAF_THICKNESS, side_height), (local_x, 0, side_height / 2), edge_mat, group, 0.003, "leaf-folded-edge")
        tag(edge, f"leaf-edge-{edge_name.lower()}", role.lower())
        seal = base.cube(f"{role}_LeafSeal_{edge_name}", (0.012, 0.012, side_height - 0.030), (local_x, 0.052, side_height / 2), gasket_mat, group, 0.002, "leaf-gasket")
        tag(seal, f"leaf-edge-{edge_name.lower()}", role.lower())
    bottom = base.cube(f"{role}_FoldedEdge_Bottom", (width, LEAF_THICKNESS, 0.024), (center_x, 0, 0.012), edge_mat, group, 0.003, "leaf-folded-edge")
    tag(bottom, "leaf-edge-bottom", role.lower())
    return group


def photo_panel_mesh(name, polygon, material, parent, location):
    """Create a fixed photo-backed transom face with normalized UVs."""
    count = len(polygon)
    depth = 0.004
    min_x = min(point[0] for point in polygon)
    max_x = max(point[0] for point in polygon)
    min_z = min(point[1] for point in polygon)
    max_z = max(point[1] for point in polygon)
    vertices = [(x, -depth / 2, z) for x, z in polygon]
    vertices += [(x, depth / 2, z) for x, z in polygon]
    faces = [tuple(range(count - 1, -1, -1)), tuple(range(count, count * 2))]
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    uv_layer = mesh.uv_layers.new(name="UVMap")
    for loop in mesh.loops:
        vertex = mesh.vertices[loop.vertex_index].co
        uv_layer.data[loop.index].uv = (
            (vertex.x - min_x) / max(0.001, max_x - min_x),
            (vertex.z - min_z) / max(0.001, max_z - min_z),
        )
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    obj.parent = parent
    obj.location = location
    mesh.materials.append(material)
    obj["component"] = "integrated-transom-photo"
    obj["resizeMode"] = "fixed-transom"
    return obj


def add_fixed_transom(assembly, opening_width, leaf_height, brass, dark):
    """Add the fixed arched gas-window assembly above the moving leaves."""
    group = base.empty("GuanminTransomGroup", assembly)
    group["baseWidth"] = opening_width
    group["baseHeight"] = TRANSOM_H
    group["baseTotalHeight"] = BASE_H
    group["fixed"] = True
    bottom = THRESHOLD + leaf_height
    top = BASE_H - HEAD
    inner_half = opening_width / 2 - 0.018
    spring = top - ARCH_RISE
    polygon = [(-inner_half, bottom), (inner_half, bottom), (inner_half, spring)]
    for index in range(CURVE_STEPS, -1, -1):
        t = index / CURVE_STEPS
        x = -inner_half + 2 * inner_half * t
        polygon.append((x, arch_z(x, inner_half, spring, ARCH_RISE)))
    polygon.append((-inner_half, spring))

    transom_source = prepare_transom_cutout(os.path.join(PROJECT, "assets", "catalog", "derived", "d90", "door-skins", "d90-guanmin-fixed-transom-v2.png"))
    transom_material = base.photo_material("D90_Guanmin_IntegratedTransomPhoto", transom_source)
    front = photo_panel_mesh("GuanminTransom_Front", polygon, transom_material, group, (0, -(LEAF_THICKNESS / 2 + 0.004), 0))
    back = photo_panel_mesh("GuanminTransom_Back", polygon, transom_material, group, (0, LEAF_THICKNESS / 2 + 0.004, 0))
    for item in (front, back):
        item["baseWidth"] = opening_width
        item["baseHeight"] = TRANSOM_H

    # A fixed centre mullion and lower seat make the glass/transom read as a
    # real frame-mounted component rather than a flat image pasted above the
    # leaves. The centre seam remains fixed while either leaf opens.
    mullion = base.cube("GuanminTransom_CenterMullion", (0.018, 0.082, top - bottom), (0, -0.055, bottom + (top - bottom) / 2), brass, group, 0.002, "transom-centre-mullion")
    mullion["resizeMode"] = "fixed-transom"
    seat = base.cube("GuanminTransom_LowerSeat", (opening_width - 0.024, 0.052, 0.012), (0, -0.055, bottom + 0.006), brass, group, 0.002, "transom-lower-seat")
    seat["resizeMode"] = "fixed-transom"
    return group


def add_arch_frame(assembly, frame_mat, casing_mat, dark, brushed):
    frame = base.empty("FrameGroup", assembly)
    casing = base.empty("CasingGroup", assembly)
    opening_w = BASE_W - JAMB * 2
    inner_half = opening_w / 2
    inner_spring = BASE_H - HEAD - ARCH_RISE
    outer_half = inner_half + FRAME_BAND
    outer_spring = BASE_H - ARCH_RISE
    frame["archProfile"] = {"baseSpring": outer_spring, "baseHeight": BASE_H}
    casing["archProfile"] = {"baseSpring": outer_spring + 0.080, "baseHeight": BASE_H + 0.080}

    # Structural jambs and rebate stops finish at the spring line.
    for side, sign in (("Left", -1), ("Right", 1)):
        x = sign * (BASE_W / 2 - JAMB / 2)
        jamb = base.cube(f"Frame_{side}_StructuralJamb", (JAMB, 0.164, outer_spring), (x, 0, outer_spring / 2), frame_mat, frame, 0.006, "frame-structural-jamb")
        jamb["frameSide"] = side.lower()
        jamb["archedFramePart"] = True
        jamb["archedTopOffset"] = ARCH_RISE
        stop = base.cube(f"Frame_{side}_RebateStop", (0.024, 0.050, inner_spring - THRESHOLD), (sign * (opening_w / 2 - 0.012), -0.048, THRESHOLD + (inner_spring - THRESHOLD) / 2), frame_mat, frame, 0.003, "frame-rebate-stop")
        stop["frameSide"] = side.lower()
        stop["archedTopOffset"] = HEAD + ARCH_RISE
        gasket = base.cube(f"Frame_{side}_Gasket", (0.012, 0.014, inner_spring - THRESHOLD - 0.030), (sign * (opening_w / 2 - 0.006), -0.071, THRESHOLD + (inner_spring - THRESHOLD) / 2), dark, frame, 0.002, "frame-gasket")
        gasket["frameSide"] = side.lower()
        gasket["archedTopOffset"] = HEAD + ARCH_RISE + 0.030

        face = base.cube(f"Casing_{side}_FrontFlange", (0.074, 0.028, outer_spring + 0.080), (sign * (BASE_W / 2 + 0.036), -0.111, (outer_spring + 0.080) / 2), casing_mat, casing, 0.005, "casing-front-flange")
        face["frameSide"] = side.lower()
        face["archedTopOffset"] = ARCH_RISE - 0.080
        step = base.cube(f"Casing_{side}_InnerStep", (0.018, 0.016, outer_spring + 0.048), (sign * (BASE_W / 2 + 0.006), -0.129, (outer_spring + 0.048) / 2), casing_mat, casing, 0.002, "casing-inner-step")
        step["frameSide"] = side.lower()
        step["archedTopOffset"] = ARCH_RISE - 0.048
        reveal = base.cube(f"Casing_{side}_ShadowReveal", (0.010, 0.012, outer_spring + 0.070), (sign * (BASE_W / 2 + 0.076), -0.130, (outer_spring + 0.070) / 2), dark, casing, 0.001, "casing-shadow-reveal")
        reveal["frameSide"] = side.lower()
        reveal["archedTopOffset"] = ARCH_RISE - 0.070
        ret = base.cube(f"Casing_{side}_WallReturn", (0.026, 0.210, outer_spring + 0.075), (sign * (BASE_W / 2 + 0.060), -0.010, (outer_spring + 0.075) / 2), casing_mat, casing, 0.003, "casing-wall-return")
        ret["frameSide"] = side.lower()
        ret["archedTopOffset"] = ARCH_RISE - 0.075

    frame_arch = prism_mesh(
        "Frame_Top_ArchStructural",
        arch_band_polygon(inner_half, inner_spring, ARCH_RISE, outer_half, outer_spring, ARCH_RISE),
        0.164,
        frame_mat,
        frame,
    )
    frame_arch["frameSide"] = "top"
    frame_arch["archedFramePart"] = True
    frame_arch["baseWidth"] = opening_w

    casing_inner_half = outer_half + 0.012
    casing_outer_half = casing_inner_half + CASING_BAND
    casing_inner_spring = outer_spring + 0.012
    casing_outer_spring = BASE_H + 0.080 - ARCH_RISE
    casing_arch = prism_mesh(
        "Casing_Top_ArchFrontFlange",
        arch_band_polygon(casing_inner_half, casing_inner_spring, ARCH_RISE, casing_outer_half, casing_outer_spring, ARCH_RISE),
        0.028,
        casing_mat,
        casing,
    )
    casing_arch["frameSide"] = "top"
    casing_arch["archedFramePart"] = True
    casing_arch["baseWidth"] = BASE_W + 0.146
    casing_step = prism_mesh(
        "Casing_Top_ArchInnerStep",
        arch_band_polygon(casing_inner_half - 0.010, casing_inner_spring - 0.010, ARCH_RISE, casing_inner_half + 0.032, casing_inner_spring + 0.032, ARCH_RISE),
        0.016,
        casing_mat,
        casing,
        location=(0, -0.129, 0),
    )
    casing_step["frameSide"] = "top"
    casing_step["baseWidth"] = BASE_W + 0.070
    casing_reveal = prism_mesh(
        "Casing_Top_ArchShadowReveal",
        arch_band_polygon(casing_outer_half - 0.006, casing_outer_spring - 0.006, ARCH_RISE, casing_outer_half + 0.012, casing_outer_spring + 0.012, ARCH_RISE),
        0.012,
        dark,
        casing,
        location=(0, -0.130, 0),
    )
    casing_reveal["frameSide"] = "top"
    casing_reveal["baseWidth"] = BASE_W + 0.154
    casing_return = prism_mesh(
        "Casing_Top_ArchWallReturn",
        arch_band_polygon(casing_inner_half - 0.018, casing_inner_spring - 0.018, ARCH_RISE, casing_outer_half + 0.002, casing_outer_spring + 0.002, ARCH_RISE),
        0.210,
        casing_mat,
        casing,
        location=(0, -0.010, 0),
    )
    casing_return["frameSide"] = "top"
    casing_return["baseWidth"] = BASE_W + 0.132

    threshold = base.cube("Frame_Threshold", (opening_w, 0.180, THRESHOLD), (0, 0.012, THRESHOLD / 2), casing_mat, frame, 0.004, "threshold")
    threshold["frameSide"] = "bottom"
    seal = base.cube("Frame_Threshold_Gasket", (opening_w - 0.025, 0.018, 0.012), (0, -0.067, THRESHOLD + 0.006), dark, frame, 0.002, "threshold-gasket")
    seal["frameSide"] = "bottom"
    return frame, casing


def build_door():
    black = base.material("D90_Guanmin_BlackMetal", (0.018, 0.020, 0.022), 0.78, 0.24, 0.28)
    black2 = base.material("D90_Guanmin_ReliefMetal", (0.050, 0.038, 0.026), 0.82, 0.19, 0.30)
    brass = base.material("D90_Guanmin_Brass", (0.46, 0.24, 0.06), 0.90, 0.18, 0.30)
    silver = base.material("D90_Guanmin_Chrome", (0.62, 0.68, 0.70), 0.96, 0.13, 0.30)
    green = base.material("D90_Guanmin_GlassGreen", (0.04, 0.32, 0.22), 0.52, 0.16, 0.42)
    dark = base.material("D90_Guanmin_DeepReveal", (0.005, 0.006, 0.007), 0.20, 0.46)
    glass = base.material("D90_Guanmin_SidelightGlass", (0.12, 0.21, 0.20), 0.34, 0.09, 0.60)
    core = base.material("D90_Guanmin_InsulatedCore", (0.035, 0.040, 0.045), 0.66, 0.36)
    folded = base.material("D90_Guanmin_FoldedEdge", (0.07, 0.075, 0.080), 0.78, 0.24)

    assembly = base.empty("D90GuanminTransomDoubleDoorAssembly")
    assembly["product"] = "YADILO D90 冠冕"
    assembly["series"] = "D90"
    assembly["modelFamily"] = "D90 冠冕完整拱形双扇门 GLB：拱顶、浮雕门花、蓝色饰面与宝石饰件随门扇整体开启"
    assembly["archedProfile"] = True
    assembly["fixedTransom"] = False
    assembly["transomHeightMm"] = 0
    assembly["archRiseMm"] = int(ARCH_RISE * 1000)
    assembly["baseWidthMm"] = int(BASE_W * 1000)
    assembly["baseHeightMm"] = int(BASE_H * 1000)
    assembly["leafThicknessMm"] = int(LEAF_THICKNESS * 1000)
    assembly["modelRevision"] = "20260812-d90-guanmin-full-arched-leaf-glb-v4"

    frame, casing = add_arch_frame(assembly, black, black2, dark, silver)
    opening_w = BASE_W - JAMB * 2
    leaf_h = BASE_H - HEAD - THRESHOLD
    leaf_w = (opening_w - GAP) / 2
    child_pivot = base.empty("ChildLeafPivot", assembly, (-opening_w / 2, 0, THRESHOLD))
    main_pivot = base.empty("MainLeafPivot", assembly, (opening_w / 2, 0, THRESHOLD))
    for pivot, role, side in ((child_pivot, "child", "left"), (main_pivot, "main", "right")):
        pivot["role"] = role
        pivot["hingeSide"] = side
        pivot["baseWidth"] = leaf_w
        pivot["baseHeight"] = leaf_h
        pivot["isDoorPivot"] = True
        pivot["archedProfile"] = True

    add_arch_leaf("Child", leaf_w, leaf_h, "left", black, black, core, folded, dark, child_pivot, opening_w)
    add_arch_leaf("Main", leaf_w, leaf_h, "right", black, black, core, folded, dark, main_pivot, opening_w)
    for pivot, role, side in ((child_pivot, "Child", "left"), (main_pivot, "Main", "right")):
        base.add_hinges(role, leaf_h, side, silver, dark, pivot, frame)
        base.add_lock_edge(role, leaf_w, side, silver, dark, pivot)
        base.add_hardware(role, leaf_w, side, dark, black, silver, brass, pivot)

    # The loader expects this group even though the real Guanmin prototype is
    # a paired door and exposes no side-light structure by default. It remains
    # hidden and is retained only for the shared runtime contract.
    base.add_side_light(assembly, glass, black2, SIDE_LIGHT_W, leaf_h)
    return assembly


def descendants(root):
    result = {root}
    changed = True
    while changed:
        changed = False
        for obj in bpy.context.scene.objects:
            if obj.parent in result and obj not in result:
                result.add(obj)
                changed = True
    return result


def export_glb(assembly):
    bpy.ops.object.select_all(action="DESELECT")
    selected = descendants(assembly)
    for obj in selected:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = assembly
    bpy.ops.export_scene.gltf(
        filepath=OUTPUT_GLB,
        export_format="GLB",
        use_selection=True,
        export_materials="EXPORT",
        export_texcoords=True,
        export_normals=True,
        export_tangents=True,
        export_cameras=False,
        export_lights=False,
        export_extras=True,
        export_apply=True,
    )


def main():
    os.makedirs(os.path.dirname(OUTPUT_GLB), exist_ok=True)
    os.makedirs(os.path.dirname(OUTPUT_BLEND), exist_ok=True)
    os.makedirs(os.path.dirname(OUTPUT_RENDER), exist_ok=True)
    base.clear_scene()
    prepare_leaf_cutout(os.path.join(PROJECT, "assets", "catalog", "derived", "d90", "door-skins", "d90-guanmin-double-leaf.png"))
    assembly = build_door()
    base.OUTPUT_GLB = OUTPUT_GLB
    base.OUTPUT_RENDER = OUTPUT_RENDER
    base.add_preview_scene()
    export_glb(assembly)
    bpy.ops.wm.save_as_mainfile(filepath=OUTPUT_BLEND)
    bpy.ops.render.render(write_still=True)
    print("D90 Guanmin fixed-transom GLB exported:", OUTPUT_GLB)
    print("D90 Guanmin fixed-transom preview rendered:", OUTPUT_RENDER)


if __name__ == "__main__":
    main()
