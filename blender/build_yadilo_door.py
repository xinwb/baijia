import bpy
import math
import os
from mathutils import Vector


PROJECT = "/Users/wubin/Documents/Github/baijia"
TEXTURE = os.path.join(PROJECT, "assets", "generated", "series", "k80", "textures", "k80-ruo-jian-clean-ai-v1.png")
SMART_LOCK_IMAGE = os.path.join(PROJECT, "assets", "catalog", "hardware", "locks", "07", "smart-lock-07lm-y-plus.png")
OUTPUT_GLB = os.path.join(PROJECT, "assets", "models", "yadilo-door-custom.glb")
OUTPUT_BLEND = os.path.join(PROJECT, "blender", "yadilo-door-custom.blend")
OUTPUT_RENDER = os.path.join(PROJECT, "audit", "glb-remodel-2026-08-06", "blender-reference.png")

# Factory-scale base assembly. Runtime dimensions are rebuilt from these fixed
# physical profiles; the browser never scales the complete door as one block.
#
# K80 的工艺 CAD 在不同门款截面上标注了“约84 / 约85 mm”。这里采用门扇
# 的 85 mm 工艺基准；这不是把整套门框门套缩放到 85 mm，而是只约束门扇
# 的钢制夹芯厚度，门框、门套、合页和锁体继续作为独立型材/五金建模。
BASE_W = 1.30
BASE_H = 2.60
JAMB = 0.075
HEAD = 0.075
THRESHOLD_H = 0.042
LEAF_THICKNESS = 0.085
LEAF_GAP = 0.012
TRANSOM_H = 0.34
MAIN_RATIO = 0.66


def clear_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for blocks in (bpy.data.meshes, bpy.data.curves, bpy.data.materials, bpy.data.cameras, bpy.data.lights):
        for block in list(blocks):
            if block.users == 0:
                blocks.remove(block)


def set_socket(shader, name, value):
    socket = shader.inputs.get(name)
    if socket is not None:
        socket.default_value = value


def material(name, color, metallic=0.0, roughness=0.5, coat=0.0):
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = (*color, 1.0)
    mat.use_nodes = True
    shader = next(node for node in mat.node_tree.nodes if node.type == "BSDF_PRINCIPLED")
    set_socket(shader, "Base Color", (*color, 1.0))
    set_socket(shader, "Metallic", metallic)
    set_socket(shader, "Roughness", roughness)
    set_socket(shader, "Coat Weight", coat)
    set_socket(shader, "Coat Roughness", 0.18)
    return mat


def finish_material(name, image_path):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    links = mat.node_tree.links
    nodes.clear()
    output = nodes.new("ShaderNodeOutputMaterial")
    shader = nodes.new("ShaderNodeBsdfPrincipled")
    image = nodes.new("ShaderNodeTexImage")
    bump = nodes.new("ShaderNodeBump")
    rgb = nodes.new("ShaderNodeRGBToBW")
    image.extension = "CLIP"
    if os.path.exists(image_path):
        image.image = bpy.data.images.load(image_path, check_existing=True)
        image.image.colorspace_settings.name = "sRGB"
        links.new(image.outputs["Color"], shader.inputs["Base Color"])
        links.new(image.outputs["Color"], rgb.inputs["Color"])
        links.new(rgb.outputs["Val"], bump.inputs["Height"])
        links.new(bump.outputs["Normal"], shader.inputs["Normal"])
    set_socket(shader, "Metallic", 0.56)
    set_socket(shader, "Roughness", 0.31)
    set_socket(shader, "Coat Weight", 0.22)
    set_socket(shader, "Coat Roughness", 0.16)
    set_socket(bump, "Strength", 0.18)
    set_socket(bump, "Distance", 0.012)
    links.new(shader.outputs["BSDF"], output.inputs["Surface"])
    return mat


def empty(name, parent=None, location=(0, 0, 0)):
    obj = bpy.data.objects.new(name, None)
    bpy.context.collection.objects.link(obj)
    obj.parent = parent
    obj.location = location
    return obj


def cube(name, dimensions, location, mat, parent=None, bevel=0.003, component=None):
    bpy.ops.mesh.primitive_cube_add(location=(0, 0, 0))
    obj = bpy.context.object
    obj.name = name
    obj.parent = parent
    obj.location = location
    obj.dimensions = dimensions
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if mat:
        obj.data.materials.append(mat)
    if bevel:
        mod = obj.modifiers.new("Micro_Radius", "BEVEL")
        mod.width = min(bevel, min(dimensions) * 0.42)
        mod.segments = 4
        if hasattr(mod, "harden_normals"):
            mod.harden_normals = True
    obj["component"] = component or name
    obj["baseDimensions"] = list(dimensions)
    return obj


def cylinder(name, radius, depth, location, mat, parent=None, rotation=(0, 0, 0), component=None, vertices=40):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth, location=(0, 0, 0), rotation=rotation)
    obj = bpy.context.object
    obj.name = name
    obj.parent = parent
    obj.location = location
    obj.data.materials.append(mat)
    bevel = obj.modifiers.new("Edge_Radius", "BEVEL")
    bevel.width = min(0.0025, radius * 0.16)
    bevel.segments = 2
    obj["component"] = component or name
    obj["baseDimensions"] = [radius * 2, radius * 2, depth]
    return obj


def photo_material(name, image_path):
    """Create a transparent PBR material for a photographed hardware face."""
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    links = mat.node_tree.links
    nodes.clear()
    output = nodes.new("ShaderNodeOutputMaterial")
    shader = nodes.new("ShaderNodeBsdfPrincipled")
    image = nodes.new("ShaderNodeTexImage")
    image.interpolation = "Linear"
    image.extension = "CLIP"
    if os.path.exists(image_path):
        image.image = bpy.data.images.load(image_path, check_existing=True)
        image.image.colorspace_settings.name = "sRGB"
    links.new(image.outputs["Color"], shader.inputs["Base Color"])
    if image.outputs.get("Alpha") and shader.inputs.get("Alpha"):
        links.new(image.outputs["Alpha"], shader.inputs["Alpha"])
    set_socket(shader, "Metallic", 0.58)
    set_socket(shader, "Roughness", 0.22)
    set_socket(shader, "Coat Weight", 0.32)
    set_socket(shader, "Coat Roughness", 0.14)
    links.new(shader.outputs["BSDF"], output.inputs["Surface"])
    if hasattr(mat, "surface_render_method"):
        mat.surface_render_method = "DITHERED"
    elif hasattr(mat, "blend_method"):
        mat.blend_method = "BLEND"
    mat.use_backface_culling = False
    return mat


def image_panel(name, width, height, location, mat, parent, uv_bounds, component):
    """Put a cropped real hardware photo on a thin, double-sided face."""
    u_min, v_min, u_max, v_max = uv_bounds
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(
        [(-width / 2, 0, -height / 2), (width / 2, 0, -height / 2),
         (width / 2, 0, height / 2), (-width / 2, 0, height / 2)],
        [], [(0, 1, 2, 3)]
    )
    mesh.update()
    uv_layer = mesh.uv_layers.new(name="UVMap")
    for loop, uv in zip(mesh.loops, ((u_min, v_min), (u_max, v_min), (u_max, v_max), (u_min, v_max))):
        uv_layer.data[loop.index].uv = uv
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    obj.parent = parent
    obj.location = location
    mesh.materials.append(mat)
    obj["component"] = component
    obj["resizeMode"] = "hardware-latch"
    return obj


def screw(name, location, mat, parent):
    cap = cylinder(name, 0.006, 0.003, location, mat, parent, rotation=(math.pi / 2, 0, 0), component="hardware-screw", vertices=24)
    return cap


def curve_pull(name, center, width, height, projection, mat, parent, bar_radius=0.018):
    """Build a thick, continuous exterior pull instead of a thin flat U line.

    The handle is one continuous bent metal bar: the two legs return toward
    the door face at the fixing points and the upper bend stays proud of the
    panel.  A real pull needs visible section depth and a softened bend from
    the side, so this is deliberately modeled as a high-resolution beveled
    curve rather than a 2D decal or a single narrow cube.
    """
    data = bpy.data.curves.new(name, "CURVE")
    data.dimensions = "3D"
    data.resolution_u = 16
    data.bevel_depth = bar_radius
    data.bevel_resolution = 6
    spline = data.splines.new("BEZIER")
    half = width / 2
    leg_top = height / 2 - half * 0.72
    points = [
        (-half, 0, -height / 2),
        (-half, -projection, -height / 2 + half * 0.72),
        (-half, -projection, leg_top),
    ]
    # A smooth half-round crown keeps the same continuous section all the way
    # through the bend and avoids the sharp polyline corner in the old model.
    for index in range(1, 7):
        angle = math.pi - math.pi * index / 6
        points.append((math.cos(angle) * half, -projection, leg_top + math.sin(angle) * half * 0.72))
    points.extend([
        (half, -projection, -height / 2 + half * 0.72),
        (half, 0, -height / 2),
    ])
    spline.bezier_points.add(len(points) - 1)
    for point, co in zip(spline.bezier_points, points):
        point.co = co
        point.handle_left_type = "AUTO"
        point.handle_right_type = "AUTO"
    obj = bpy.data.objects.new(name, data)
    bpy.context.collection.objects.link(obj)
    obj.parent = parent
    obj.location = center
    obj.data.materials.append(mat)
    obj["component"] = "pull-handle"
    return obj


def torus(name, major_radius, minor_radius, location, mat, parent, component):
    bpy.ops.mesh.primitive_torus_add(major_radius=major_radius, minor_radius=minor_radius, major_segments=48, minor_segments=12, location=(0, 0, 0), rotation=(math.pi / 2, 0, 0))
    obj = bpy.context.object
    obj.name = name
    obj.parent = parent
    obj.location = location
    obj.data.materials.append(mat)
    obj["component"] = component
    return obj


def tag_resize(obj, mode, role="assembly"):
    obj["resizeMode"] = mode
    obj["role"] = role
    return obj


def add_leaf_geometry(role, width, height, hinge_side, front_mat, back_mat, core_mat, edge_mat, gasket_mat, pivot):
    direction = 1 if hinge_side == "left" else -1
    center_x = direction * width / 2
    group = empty(f"{role}LeafGeometry", pivot)
    group["role"] = role.lower()
    group["hingeSide"] = hinge_side
    group["baseWidth"] = width
    group["baseHeight"] = height

    core = cube(f"{role}_Core", (width - 0.026, LEAF_THICKNESS - 0.012, height - 0.022), (center_x, 0, height / 2), core_mat, group, 0.005, "leaf-core")
    tag_resize(core, "leaf-center", role.lower())
    front = cube(f"DoorLeaf_{role}_Front", (width - 0.010, 0.004, height - 0.010), (center_x, -(LEAF_THICKNESS / 2 + 0.002), height / 2), front_mat, group, 0.002, "door-leaf-front")
    tag_resize(front, "leaf-center", role.lower())
    back = cube(f"DoorLeaf_{role}_Back", (width - 0.010, 0.004, height - 0.010), (center_x, LEAF_THICKNESS / 2 + 0.002, height / 2), back_mat, group, 0.002, "door-leaf-back")
    tag_resize(back, "leaf-center", role.lower())

    for edge_name, local_x in (("Hinge", 0), ("Latch", direction * width)):
        edge = cube(f"{role}_FoldedEdge_{edge_name}", (0.018, LEAF_THICKNESS, height), (local_x, 0, height / 2), edge_mat, group, 0.003, "leaf-folded-edge")
        tag_resize(edge, f"leaf-edge-{edge_name.lower()}", role.lower())
    for edge_name, z in (("Bottom", 0.012), ("Top", height - 0.012)):
        edge = cube(f"{role}_FoldedEdge_{edge_name}", (width, LEAF_THICKNESS, 0.024), (center_x, 0, z), edge_mat, group, 0.003, "leaf-folded-edge")
        tag_resize(edge, f"leaf-edge-{edge_name.lower()}", role.lower())

    # Compression gasket follows the finished leaf perimeter, but its section
    # stays 12 mm regardless of door size.
    for edge_name, local_x in (("Hinge", 0.010 * direction), ("Latch", direction * (width - 0.010))):
        seal = cube(f"{role}_LeafSeal_{edge_name}", (0.012, 0.012, height - 0.028), (local_x, 0.057, height / 2), gasket_mat, group, 0.002, "leaf-gasket")
        tag_resize(seal, f"leaf-edge-{edge_name.lower()}", role.lower())
    return group


def add_hinge_set(role, leaf_width, leaf_height, hinge_side, hinge_mat, dark_mat, pivot, frame_group, hinge_world_x):
    direction = 1 if hinge_side == "left" else -1
    leaf_group = empty(f"{role}LeafHingePlates", pivot)
    frame_hinge_group = empty(f"{role}FrameHinges", frame_group)
    leaf_group["role"] = role.lower()
    frame_hinge_group["role"] = role.lower()
    for index, z in enumerate((0.28, leaf_height * 0.52, leaf_height - 0.28), 1):
        # The barrel sits on the front half of the jamb so the knuckle and pin
        # remain visible when the leaf is opened. The old barrel was buried
        # behind the frame flange and read as a dark square from the side.
        barrel_x = hinge_world_x - direction * 0.032
        barrel = cylinder(f"{role}_Hinge_{index}_Barrel", 0.015, 0.148, (barrel_x, -0.091, z), hinge_mat, frame_hinge_group, component="hinge-barrel")
        barrel["hingeIndex"] = index
        barrel["hingeRole"] = role.lower()
        for cap_name, cap_z in (("Top", z - 0.074), ("Bottom", z + 0.074)):
            cap = cylinder(f"{role}_Hinge_{index}_PinCap_{cap_name}", 0.0175, 0.006, (barrel_x, -0.091, cap_z), hinge_mat, frame_hinge_group, component="hinge-pin-cap")
            cap["hingeIndex"] = index
            cap["hingeRole"] = role.lower()
        frame_plate_x = hinge_world_x - direction * 0.022
        frame_plate = cube(f"{role}_Hinge_{index}_FramePlate", (0.048, 0.008, 0.124), (frame_plate_x, -0.079, z), hinge_mat, frame_hinge_group, 0.002, "hinge-frame-plate")
        frame_plate["hingeIndex"] = index
        frame_plate["hingeRole"] = role.lower()
        for screw_z in (-0.036, 0.036):
            screw(f"{role}_Hinge_{index}_FrameScrew_{'A' if screw_z < 0 else 'B'}", (frame_plate_x, -0.085, z + screw_z), dark_mat, frame_hinge_group)

        # This entire group is parented to the leaf pivot. It is deliberately
        # offset toward the front edge so that it stays in the hinge knuckle
        # instead of floating behind the opened leaf.
        leaf_plate_y = -(LEAF_THICKNESS / 2 + 0.008)
        leaf_plate = cube(f"{role}_Hinge_{index}_LeafPlate", (0.056, 0.008, 0.124), (direction * 0.028, leaf_plate_y, z), hinge_mat, leaf_group, 0.002, "hinge-leaf-plate")
        leaf_plate["hingeIndex"] = index
        leaf_plate["hingeRole"] = role.lower()
        for screw_z in (-0.036, 0.036):
            screw(f"{role}_Hinge_{index}_LeafScrew_{'A' if screw_z < 0 else 'B'}", (direction * 0.028, leaf_plate_y - 0.006, z + screw_z), dark_mat, leaf_group)
    return leaf_group, frame_hinge_group


def add_lock_edge(role, width, height, hinge_side, brushed, dark, pivot):
    direction = 1 if hinge_side == "left" else -1
    latch_x = direction * width
    group = empty(f"{role}LockEdge", pivot)
    group["role"] = role.lower()
    # A real mortise lock is not a row of floating bolts: the case is recessed
    # into the steel leaf, with a dark pocket behind a narrow stainless face
    # plate. The complete assembly sits on the latch edge and turns with the
    # pivot, so the open view exposes the lock body rather than an empty edge.
    # The edge view is the same physical smart-lock datum as the front view:
    # 265 mm tall, centred at 1100 mm. The previous 460 mm strike plate made
    # the side lock look almost twice as large when the leaf was opened.
    lock_center_z = 1.10
    lock_height = 0.265
    case = cube(f"{role}_LockEdge_MortiseCase", (0.038, LEAF_THICKNESS - 0.030, 0.235), (latch_x - direction * 0.018, 0, lock_center_z), dark, group, 0.003, "lock-mortise-case")
    tag_resize(case, "hardware-latch-edge", role.lower())
    pocket = cube(f"{role}_LockEdge_CasePocket", (0.012, LEAF_THICKNESS - 0.018, 0.205), (latch_x - direction * 0.001, 0, lock_center_z), dark, group, 0.0015, "lock-mortise-pocket")
    tag_resize(pocket, "hardware-latch-edge", role.lower())
    plate = cube(f"{role}_LockEdge_Faceplate", (0.010, LEAF_THICKNESS - 0.008, lock_height), (latch_x + direction * 0.005, 0, lock_center_z), brushed, group, 0.0015, "lock-edge-faceplate")
    tag_resize(plate, "hardware-latch-edge", role.lower())
    # The visible edge lock has three tongues in total: a lower shoot bolt,
    # the spring latch aligned to the smart-lock centreline, and an upper
    # shoot bolt. The first/top tongue is 55 mm lower than the old 1235 mm
    # datum so the three pieces sit on the same physical lock centre.
    for index, (z, depth, bolt_height) in enumerate(((1.02, 0.032, 0.040), (1.10, 0.044, 0.048)), 1):
        bolt = cube(f"{role}_LockEdge_Bolt_{index}", (0.046, depth, bolt_height), (latch_x + direction * 0.024, 0, z), brushed, group, 0.002, "lock-bolt")
        tag_resize(bolt, "hardware-latch-edge", role.lower())
    latch = cube(f"{role}_LockEdge_Latch", (0.044, 0.034, 0.052), (latch_x + direction * 0.032, 0, 1.180), brushed, group, 0.002, "lock-latch")
    tag_resize(latch, "hardware-latch-edge", role.lower())
    for z in (0.895, 1.265):
        cap = cylinder(f"{role}_LockEdge_Screw_{int(z*1000)}", 0.0065, 0.004, (latch_x + direction * 0.008, -0.053, z), dark, group, rotation=(0, math.pi / 2, 0), component="hardware-screw", vertices=20)
        tag_resize(cap, "hardware-latch-edge", role.lower())
    return group


def add_hardware_groups(role, width, hinge_side, brushed, black, dark, bronze, pivot):
    direction = 1 if hinge_side == "left" else -1
    latch_x = direction * width
    anchor_x = latch_x - direction * 0.095
    front_y = -(LEAF_THICKNESS / 2 + 0.012)
    all_group = empty(f"{role}Hardware", pivot)
    all_group["role"] = role.lower()

    long_group = empty(f"{role}Hardware_Long", all_group)
    long_group["hardwareType"] = "long"
    # SL48F is a compact exterior pull, not a full-height strip. Use a
    # continuous rounded U-bar with a real return depth and two round fixing
    # roses; the dark vertical recess remains behind the bar as the mounting
    # shadow seen on the photographed metal doors.
    long_group["handleModel"] = "SL48F外拉手：110mm宽、940mm高、圆角连续拉杆、双安装座与暗槽"
    pull_height = 0.94
    pull_width = 0.11
    pull_center_z = 1.18
    groove = cube(f"{role}_LongPull_RecessChannel", (0.126, 0.010, 1.00), (anchor_x, front_y + 0.002, pull_center_z), dark, long_group, 0.010, "pull-recess-channel")
    rail = curve_pull(f"{role}_LongPull_RoundedBar", (anchor_x, front_y - 0.012, pull_center_z), pull_width, pull_height, 0.055, brushed, long_group, bar_radius=0.014)
    for item in (groove, rail):
        tag_resize(item, "hardware-latch", role.lower())
    for index, z in enumerate((pull_center_z - pull_height / 2, pull_center_z + pull_height / 2), 1):
        rose = cylinder(f"{role}_LongPull_Mount_{index}_Rose", 0.027, 0.012, (anchor_x, front_y - 0.014, z), black, long_group, rotation=(math.pi / 2, 0, 0), component="pull-mount-rose")
        collar = cylinder(f"{role}_LongPull_Mount_{index}_Collar", 0.017, 0.042, (anchor_x, front_y - 0.034, z), brushed, long_group, rotation=(math.pi / 2, 0, 0), component="pull-mount-collar")
        for item in (rose, collar):
            tag_resize(item, "hardware-latch", role.lower())

    smart_group = empty(f"{role}Hardware_Smart", all_group)
    smart_group["hardwareType"] = "smart"
    # The supplied 07LM-Y+ asset contains the real exterior and interior lock
    # faces side by side. Crop each half onto its own face, while the black
    # rounded housing supplies the correct 34 mm physical side thickness.
    smart_group["hardwareModel"] = "雅帝乐07LM-Y+智能锁：正反面实拍贴图、圆角铝框、34mm实体厚度"
    smart_photo = photo_material("YADILO_07LM_Y_Plus_SmartLock_Photo", SMART_LOCK_IMAGE)
    body = cube(f"{role}_SmartLock_Body", (0.080, 0.034, 0.342), (anchor_x, front_y - 0.010, 1.10), black, smart_group, 0.012, "smart-lock-body")
    front_panel = image_panel(f"{role}_SmartLock_FrontTexture", 0.068, 0.332, (anchor_x, front_y - 0.028, 1.10), smart_photo, smart_group, (0.173, 0.069, 0.439, 0.929), "smart-lock-front-texture")
    back_panel = image_panel(f"{role}_SmartLock_BackTexture", 0.068, 0.332, (anchor_x, front_y + 0.011, 1.10), smart_photo, smart_group, (0.559, 0.069, 0.831, 0.929), "smart-lock-back-texture")
    for item in (body, front_panel, back_panel):
        tag_resize(item, "hardware-latch", role.lower())

    concealed_group = empty(f"{role}Hardware_Concealed", all_group)
    concealed_group["hardwareType"] = "concealed"
    ring2 = torus(f"{role}_Concealed_Ring", 0.055, 0.008, (anchor_x, front_y - 0.020, 1.08), brushed, concealed_group, "concealed-ring")
    center = cylinder(f"{role}_Concealed_Center", 0.047, 0.013, (anchor_x, front_y - 0.018, 1.08), bronze, concealed_group, rotation=(math.pi / 2, 0, 0), component="concealed-center")
    for item in (ring2, center):
        tag_resize(item, "hardware-latch", role.lower())

    # The photographed Jiangchuan door uses two modest round pull loops at the
    # meeting stiles. It is a real separate fitting, not the hidden-lock badge
    # used by the old prototype, so keep it in its own selectable group.
    ring_group = empty(f"{role}Hardware_Ring", all_group)
    ring_group["hardwareType"] = "ring"
    ring_group["handleModel"] = "K80 双环拉手：55mm 环径、独立底座、贴合门扇表面"
    ring_backplate = cylinder(f"{role}_RingPull_Backplate", 0.074, 0.012, (anchor_x, front_y - 0.016, 1.08), black, ring_group, rotation=(math.pi / 2, 0, 0), component="ring-pull-backplate")
    ring_pull = torus(f"{role}_RingPull_Ring", 0.084, 0.012, (anchor_x, front_y - 0.038, 1.08), bronze, ring_group, "ring-pull")
    for item in (ring_backplate, ring_pull):
        tag_resize(item, "hardware-latch", role.lower())

    # Qingya's photographed handle is a small recessed vertical slot in the
    # middle band. Model the dark cavity and the metal inner return separately
    # so it reads as an inset pull instead of a second giant rail.
    recess_group = empty(f"{role}Hardware_Recess", all_group)
    recess_group["hardwareType"] = "recess"
    recess_group["handleModel"] = "K80 中部凹槽拉手：80mm窄槽、内嵌安装"
    recess = cube(f"{role}_RecessPull_Channel", (0.078, 0.016, 0.290), (anchor_x, front_y + 0.001, 1.18), dark, recess_group, 0.008, "recess-pull-channel")
    recess_inner = cube(f"{role}_RecessPull_InnerReturn", (0.030, 0.018, 0.205), (anchor_x - direction * 0.008, front_y - 0.012, 1.18), bronze, recess_group, 0.006, "recess-pull-return")
    for item in (recess, recess_inner):
        tag_resize(item, "hardware-latch", role.lower())

    for group in (long_group, smart_group, concealed_group, ring_group, recess_group):
        tag_resize(group, "hardware-latch", role.lower())
    return all_group


def add_frame(assembly, mats, leaf_height):
    frame_mat, casing_mat, dark, brushed, finish = mats
    frame = empty("FrameGroup", assembly)
    casing = empty("CasingGroup", assembly)
    opening_w = BASE_W - JAMB * 2

    # Structural jamb, door stop and gasket are distinct real sections.
    for side, sign in (("Left", -1), ("Right", 1)):
        x = sign * (BASE_W / 2 - JAMB / 2)
        jamb = cube(f"Frame_{side}_StructuralJamb", (JAMB, 0.165, BASE_H), (x, 0, BASE_H / 2), frame_mat, frame, 0.006, "frame-structural-jamb")
        jamb["frameSide"] = side.lower()
        stop = cube(f"Frame_{side}_RebateStop", (0.022, 0.052, BASE_H - 0.028), (sign * (BASE_W / 2 - JAMB + 0.011), -0.048, (BASE_H - 0.028) / 2), frame_mat, frame, 0.003, "frame-rebate-stop")
        stop["frameSide"] = side.lower()
        gasket = cube(f"Frame_{side}_Gasket", (0.012, 0.014, leaf_height - 0.030), (sign * (opening_w / 2 - 0.006), -0.071, leaf_height / 2 + THRESHOLD_H), dark, frame, 0.002, "frame-gasket")
        gasket["frameSide"] = side.lower()

        # Thin nested K80 casing: outer front flange, inner shadow line and
        # deep return. This replaces the previous broad rectangular slab.
        face_x = sign * (BASE_W / 2 + 0.036)
        face = cube(f"Casing_{side}_FrontFlange", (0.070, 0.026, BASE_H + 0.082), (face_x, -0.111, BASE_H / 2 + 0.041), casing_mat, casing, 0.004, "casing-front-flange")
        face["frameSide"] = side.lower()
        step = cube(f"Casing_{side}_InnerStep", (0.018, 0.016, BASE_H + 0.048), (sign * (BASE_W / 2 + 0.006), -0.128, BASE_H / 2 + 0.024), brushed, casing, 0.002, "casing-inner-step")
        step["frameSide"] = side.lower()
        reveal = cube(f"Casing_{side}_ShadowReveal", (0.010, 0.012, BASE_H + 0.070), (sign * (BASE_W / 2 + 0.076), -0.130, BASE_H / 2 + 0.035), dark, casing, 0.001, "casing-shadow-reveal")
        reveal["frameSide"] = side.lower()
        ret = cube(f"Casing_{side}_WallReturn", (0.026, 0.205, BASE_H + 0.075), (sign * (BASE_W / 2 + 0.060), -0.010, BASE_H / 2 + 0.0375), casing_mat, casing, 0.003, "casing-wall-return")
        ret["frameSide"] = side.lower()

    head = cube("Frame_Top_StructuralHead", (opening_w, 0.165, HEAD), (0, 0, BASE_H - HEAD / 2), frame_mat, frame, 0.006, "frame-structural-head")
    top_stop = cube("Frame_Top_RebateStop", (opening_w, 0.052, 0.022), (0, -0.048, BASE_H - HEAD + 0.011), frame_mat, frame, 0.003, "frame-rebate-stop")
    top_face = cube("Casing_Top_FrontFlange", (BASE_W + 0.142, 0.026, 0.070), (0, -0.111, BASE_H + 0.036), casing_mat, casing, 0.004, "casing-front-flange")
    top_step = cube("Casing_Top_InnerStep", (BASE_W + 0.066, 0.016, 0.018), (0, -0.128, BASE_H + 0.006), brushed, casing, 0.002, "casing-inner-step")
    top_reveal = cube("Casing_Top_ShadowReveal", (BASE_W + 0.150, 0.012, 0.010), (0, -0.130, BASE_H + 0.076), dark, casing, 0.001, "casing-shadow-reveal")
    top_return = cube("Casing_Top_WallReturn", (BASE_W + 0.130, 0.205, 0.026), (0, -0.010, BASE_H + 0.060), casing_mat, casing, 0.003, "casing-wall-return")
    for obj in (head, top_stop, top_face, top_step, top_reveal, top_return):
        obj["frameSide"] = "top"

    threshold = cube("Frame_Threshold", (opening_w, 0.180, THRESHOLD_H), (0, 0.012, THRESHOLD_H / 2), brushed, frame, 0.004, "threshold")
    threshold["frameSide"] = "bottom"
    threshold_seal = cube("Frame_Threshold_Gasket", (opening_w - 0.025, 0.018, 0.012), (0, -0.067, THRESHOLD_H + 0.006), dark, frame, 0.002, "threshold-gasket")
    threshold_seal["frameSide"] = "bottom"

    transom = empty("TransomGroup", assembly)
    rail_y = leaf_height + THRESHOLD_H + 0.030
    rail = cube("Transom_BottomRail", (opening_w, 0.145, 0.060), (0, 0, rail_y), frame_mat, transom, 0.004, "transom-rail")
    panel_h = max(0.12, BASE_H - HEAD - rail_y - 0.025)
    panel = cube("Transom_OpaquePanel", (opening_w - 0.035, 0.070, panel_h), (0, 0.006, rail_y + 0.030 + panel_h / 2), finish, transom, 0.004, "transom-panel")
    center = cube("Transom_CenterMullion", (0.016, 0.115, panel_h), (0, -0.006, panel.location.z), frame_mat, transom, 0.002, "transom-mullion")
    for obj in (rail, panel, center):
        obj["baseLeafHeight"] = leaf_height
    return frame, casing, transom


def build_door():
    finish = finish_material("K80_Ruojian_Front", TEXTURE)
    back_finish = finish_material("K80_Ruojian_Back", TEXTURE)
    core = material("MetalLeaf_InsulatedCore", (0.11, 0.095, 0.082), 0.72, 0.40)
    folded = material("MetalLeaf_FoldedEdge", (0.16, 0.13, 0.105), 0.78, 0.25)
    frame_mat = material("K80_Frame_WarmGraphite", (0.16, 0.125, 0.105), 0.70, 0.27, 0.12)
    casing_mat = material("K80_Casing_WarmGraphite", (0.20, 0.155, 0.125), 0.68, 0.25, 0.15)
    dark = material("EPDM_Black_Gasket", (0.012, 0.014, 0.014), 0.05, 0.72)
    brushed = material("Brushed_Stainless_Steel", (0.48, 0.53, 0.55), 0.94, 0.20)
    hinge_mat = material("Hinge_DarkTitanium", (0.31, 0.25, 0.20), 0.92, 0.17, 0.20)
    black = material("Lock_GlassBlack", (0.010, 0.014, 0.016), 0.62, 0.18, 0.28)
    bronze = material("ConcealedHandle_Bronze", (0.78, 0.46, 0.12), 0.62, 0.23)

    assembly = empty("DoorAssembly")
    assembly["product"] = "YADILO K80 metal security door"
    assembly["series"] = "K80"
    assembly["modelFamily"] = "K80独立GLB：门扇、门框、门套、气窗与五金分层"
    assembly["baseWidthMm"] = 1300
    assembly["baseHeightMm"] = 2600
    assembly["leafThicknessMm"] = 85
    assembly["cadThicknessReference"] = "K80工艺CAD：约84/约85 mm"
    assembly["pullHandleModel"] = "K80 SL48F外拉手：110mm宽、940mm高、圆角连续拉杆、双安装座与暗槽；双环与中部凹槽独立分组"
    assembly["smartLockModel"] = "雅帝乐07LM-Y+：正反面实拍贴图、圆角实体外壳、34mm厚度"
    assembly["modelRevision"] = "20260808-k80-product-hardware-v7-smart-lock-photo-and-rounded-pull"

    opening_w = BASE_W - JAMB * 2
    leaf_h = BASE_H - HEAD - THRESHOLD_H - TRANSOM_H
    main_w = (opening_w - LEAF_GAP) * MAIN_RATIO
    child_w = opening_w - LEAF_GAP - main_w
    child_hinge_x = -opening_w / 2
    main_hinge_x = opening_w / 2

    frame, casing, transom = add_frame(assembly, (frame_mat, casing_mat, dark, brushed, finish), leaf_h)
    child_pivot = empty("ChildLeafPivot", assembly, (child_hinge_x, 0, THRESHOLD_H))
    main_pivot = empty("MainLeafPivot", assembly, (main_hinge_x, 0, THRESHOLD_H))
    for pivot, role, side, width in ((child_pivot, "child", "left", child_w), (main_pivot, "main", "right", main_w)):
        pivot["role"] = role
        pivot["hingeSide"] = side
        pivot["baseWidth"] = width
        pivot["baseHeight"] = leaf_h
        pivot["isDoorPivot"] = True

    add_leaf_geometry("Child", child_w, leaf_h, "left", finish, back_finish, core, folded, dark, child_pivot)
    add_leaf_geometry("Main", main_w, leaf_h, "right", finish, back_finish, core, folded, dark, main_pivot)
    add_hinge_set("Child", child_w, leaf_h, "left", hinge_mat, dark, child_pivot, frame, child_hinge_x)
    add_hinge_set("Main", main_w, leaf_h, "right", hinge_mat, dark, main_pivot, frame, main_hinge_x)
    add_lock_edge("Child", child_w, leaf_h, "left", brushed, dark, child_pivot)
    add_lock_edge("Main", main_w, leaf_h, "right", brushed, dark, main_pivot)
    add_hardware_groups("Child", child_w, "left", brushed, black, dark, bronze, child_pivot)
    add_hardware_groups("Main", main_w, "right", brushed, black, dark, bronze, main_pivot)
    return assembly


def point_at(obj, target):
    obj.rotation_euler = (Vector(target) - obj.location).to_track_quat("-Z", "Y").to_euler()


def add_preview_scene():
    world = bpy.context.scene.world or bpy.data.worlds.new("K80 Studio")
    bpy.context.scene.world = world
    world.use_nodes = True
    background = world.node_tree.nodes.get("Background")
    background.inputs["Color"].default_value = (0.035, 0.032, 0.029, 1)
    background.inputs["Strength"].default_value = 0.22

    floor_mat = material("StudioStone", (0.18, 0.17, 0.16), 0.02, 0.68)
    bpy.ops.mesh.primitive_plane_add(size=14, location=(0, 0, 0))
    floor = bpy.context.object
    floor.name = "Preview_Floor"
    floor.data.materials.append(floor_mat)
    floor["previewOnly"] = True

    wall = cube("Preview_Wall", (5.5, 0.10, 4.2), (0, 0.55, 2.1), floor_mat, None, 0, "preview-only")
    wall["previewOnly"] = True

    def area(name, location, energy, size, color):
        data = bpy.data.lights.new(name, "AREA")
        data.energy = energy
        data.shape = "RECTANGLE"
        data.size = size
        data.size_y = size * 0.62
        data.color = color
        obj = bpy.data.objects.new(name, data)
        bpy.context.collection.objects.link(obj)
        obj.location = location
        point_at(obj, (0, 0, 1.35))
        return obj

    area("Window_Key", (-2.8, -3.8, 4.7), 1050, 3.4, (1.0, 0.86, 0.72))
    area("Soft_Fill", (2.5, -2.2, 3.0), 680, 2.8, (0.72, 0.82, 1.0))
    area("Edge_Rim", (1.7, 1.7, 3.7), 900, 2.1, (1.0, 0.62, 0.38))

    camera_data = bpy.data.cameras.new("Camera")
    camera = bpy.data.objects.new("Camera", camera_data)
    bpy.context.collection.objects.link(camera)
    camera.location = (2.55, -5.7, 2.55)
    camera_data.lens = 62
    point_at(camera, (0, 0, 1.34))
    bpy.context.scene.camera = camera

    scene = bpy.context.scene
    engines = {item.identifier for item in scene.render.bl_rna.properties["engine"].enum_items}
    scene.render.engine = "BLENDER_EEVEE_NEXT" if "BLENDER_EEVEE_NEXT" in engines else "BLENDER_EEVEE"
    scene.render.resolution_x = 840
    scene.render.resolution_y = 980
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.filepath = OUTPUT_RENDER
    scene.view_settings.look = "AgX - Medium High Contrast"
    bpy.ops.wm.save_as_mainfile(filepath=OUTPUT_BLEND)
    bpy.ops.render.render(write_still=True)


def export_glb(assembly):
    bpy.ops.object.select_all(action="DESELECT")
    descendants = {assembly}
    changed = True
    while changed:
        changed = False
        for obj in bpy.context.scene.objects:
            if obj.parent in descendants and obj not in descendants:
                descendants.add(obj)
                changed = True
    for obj in descendants:
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
    os.makedirs(os.path.dirname(OUTPUT_RENDER), exist_ok=True)
    os.makedirs(os.path.dirname(OUTPUT_BLEND), exist_ok=True)
    clear_scene()
    assembly = build_door()
    add_preview_scene()
    export_glb(assembly)
    print("YADILO GLB exported:", OUTPUT_GLB)
    print("YADILO preview rendered:", OUTPUT_RENDER)


main()
