import bpy
import math
import os
from mathutils import Vector


PROJECT = "/Users/wubin/Documents/Github/baijia"
SMART_LOCK_IMAGE = os.path.join(PROJECT, "assets", "catalog", "hardware", "locks", "07", "smart-lock-07lm-y-plus.png")
OUTPUT_GLB = os.path.join(PROJECT, "assets", "models", "d90-door-custom.glb")
OUTPUT_BLEND = os.path.join(PROJECT, "blender", "d90-door-custom.blend")
OUTPUT_RENDER = os.path.join(PROJECT, "audit", "d90-remodel-2026-08-06", "d90-reference.png")

# D90 is a 90 mm leaf construction. All visible frame, return, gasket and
# hardware pieces are separate objects so the browser can resize the opening
# without scaling the metal sections or moving the hardware with the height.
BASE_W = 1.38
BASE_H = 2.60
JAMB = 0.082
HEAD = 0.082
THRESHOLD = 0.045
LEAF_THICKNESS = 0.090
GAP = 0.012
SIDE_LIGHT_W = 0.405


def clear_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for blocks in (bpy.data.meshes, bpy.data.curves, bpy.data.materials, bpy.data.cameras, bpy.data.lights):
        for block in list(blocks):
            if block.users == 0:
                blocks.remove(block)


def socket(shader, name, value):
    item = shader.inputs.get(name)
    if item is not None:
        item.default_value = value


def material(name, color, metallic=0.0, roughness=0.5, coat=0.0):
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = (*color, 1.0)
    mat.use_nodes = True
    shader = next(node for node in mat.node_tree.nodes if node.type == "BSDF_PRINCIPLED")
    socket(shader, "Base Color", (*color, 1.0))
    socket(shader, "Metallic", metallic)
    socket(shader, "Roughness", roughness)
    socket(shader, "Coat Weight", coat)
    socket(shader, "Coat Roughness", 0.16)
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
        modifier = obj.modifiers.new("Micro_Radius", "BEVEL")
        modifier.width = min(bevel, min(dimensions) * 0.42)
        modifier.segments = 4
        if hasattr(modifier, "harden_normals"):
            modifier.harden_normals = True
    obj["component"] = component or name
    obj["baseDimensions"] = list(dimensions)
    return obj


def cylinder(name, radius, depth, location, mat, parent=None, rotation=(0, 0, 0), component=None, vertices=48):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth, location=(0, 0, 0), rotation=rotation)
    obj = bpy.context.object
    obj.name = name
    obj.parent = parent
    obj.location = location
    if mat:
        obj.data.materials.append(mat)
    bevel = obj.modifiers.new("Edge_Radius", "BEVEL")
    bevel.width = min(0.003, radius * 0.12)
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
    socket(shader, "Metallic", 0.58)
    socket(shader, "Roughness", 0.22)
    socket(shader, "Coat Weight", 0.32)
    socket(shader, "Coat Roughness", 0.14)
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


def torus(name, major_radius, minor_radius, location, mat, parent, component):
    bpy.ops.mesh.primitive_torus_add(
        major_radius=major_radius,
        minor_radius=minor_radius,
        major_segments=64,
        minor_segments=16,
        location=(0, 0, 0),
        rotation=(math.pi / 2, 0, 0),
    )
    obj = bpy.context.object
    obj.name = name
    obj.parent = parent
    obj.location = location
    obj.data.materials.append(mat)
    obj["component"] = component
    return obj


def poly_curve(name, points, bevel, mat, parent=None, component="relief-curve"):
    data = bpy.data.curves.new(name, "CURVE")
    data.dimensions = "3D"
    data.resolution_u = 8
    data.bevel_depth = bevel
    data.bevel_resolution = 4
    spline = data.splines.new("POLY")
    spline.points.add(len(points) - 1)
    for point, co in zip(spline.points, points):
        point.co = (*co, 1.0)
    obj = bpy.data.objects.new(name, data)
    bpy.context.collection.objects.link(obj)
    obj.parent = parent
    obj.data.materials.append(mat)
    obj["component"] = component
    return obj


def pull_curve(name, center, width, height, projection, mat, parent, radius=0.017):
    """Continuous rounded pull bar with a recessed channel behind it."""
    data = bpy.data.curves.new(name, "CURVE")
    data.dimensions = "3D"
    data.resolution_u = 16
    data.bevel_depth = radius
    data.bevel_resolution = 6
    spline = data.splines.new("BEZIER")
    half = width / 2
    leg_top = height / 2 - half * 0.72
    points = [
        (-half, 0, -height / 2),
        (-half, -projection, -height / 2 + half * 0.72),
        (-half, -projection, leg_top),
    ]
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
    obj["component"] = "pull-recess-channel" if "Recess" in name else "pull-handle"
    return obj


def tag(obj, resize_mode, role="assembly"):
    obj["resizeMode"] = resize_mode
    obj["role"] = role
    return obj


def add_leaf(role, width, height, hinge_side, front_mat, back_mat, core_mat, edge_mat, gasket_mat, pivot):
    direction = 1 if hinge_side == "left" else -1
    center_x = direction * width / 2
    group = empty(f"{role}LeafGeometry", pivot)
    group["role"] = role.lower()
    group["baseWidth"] = width
    group["baseHeight"] = height
    core = cube(f"{role}_Core", (width - 0.026, LEAF_THICKNESS - 0.014, height - 0.024), (center_x, 0, height / 2), core_mat, group, 0.004, "leaf-core")
    tag(core, "leaf-center", role.lower())
    front = cube(f"DoorLeaf_{role}_Front", (width - 0.010, 0.004, height - 0.010), (center_x, -(LEAF_THICKNESS / 2 + 0.002), height / 2), front_mat, group, 0.002, "door-leaf-front")
    back = cube(f"DoorLeaf_{role}_Back", (width - 0.010, 0.004, height - 0.010), (center_x, LEAF_THICKNESS / 2 + 0.002, height / 2), back_mat, group, 0.002, "door-leaf-back")
    tag(front, "leaf-center", role.lower())
    tag(back, "leaf-center", role.lower())

    for edge_name, local_x in (("Hinge", direction * 0.010), ("Latch", direction * (width - 0.010))):
        edge = cube(f"{role}_FoldedEdge_{edge_name}", (0.018, LEAF_THICKNESS, height), (local_x, 0, height / 2), edge_mat, group, 0.003, "leaf-folded-edge")
        tag(edge, f"leaf-edge-{edge_name.lower()}", role.lower())
        seal = cube(f"{role}_LeafSeal_{edge_name}", (0.012, 0.012, height - 0.030), (local_x, 0.052, height / 2), gasket_mat, group, 0.002, "leaf-gasket")
        tag(seal, f"leaf-edge-{edge_name.lower()}", role.lower())
    for edge_name, z in (("Bottom", 0.012), ("Top", height - 0.012)):
        edge = cube(f"{role}_FoldedEdge_{edge_name}", (width, LEAF_THICKNESS, 0.024), (center_x, 0, z), edge_mat, group, 0.003, "leaf-folded-edge")
        tag(edge, f"leaf-edge-{edge_name.lower()}", role.lower())
    return group


def add_frame(assembly, frame_mat, casing_mat, dark, brushed):
    frame = empty("FrameGroup", assembly)
    casing = empty("CasingGroup", assembly)
    opening_w = BASE_W - JAMB * 2
    for side, sign in (("Left", -1), ("Right", 1)):
        x = sign * (BASE_W / 2 - JAMB / 2)
        jamb = cube(f"Frame_{side}_StructuralJamb", (JAMB, 0.164, BASE_H), (x, 0, BASE_H / 2), frame_mat, frame, 0.006, "frame-structural-jamb")
        jamb["frameSide"] = side.lower()
        stop = cube(f"Frame_{side}_RebateStop", (0.024, 0.050, BASE_H - 0.030), (sign * (BASE_W / 2 - JAMB + 0.012), -0.048, (BASE_H - 0.030) / 2), frame_mat, frame, 0.003, "frame-rebate-stop")
        stop["frameSide"] = side.lower()
        gasket = cube(f"Frame_{side}_Gasket", (0.012, 0.014, BASE_H - HEAD - THRESHOLD - 0.030), (sign * (opening_w / 2 - 0.006), -0.071, (BASE_H - HEAD - THRESHOLD) / 2 + THRESHOLD), dark, frame, 0.002, "frame-gasket")
        gasket["frameSide"] = side.lower()

        face = cube(f"Casing_{side}_FrontFlange", (0.074, 0.028, BASE_H + 0.080), (sign * (BASE_W / 2 + 0.036), -0.111, BASE_H / 2 + 0.040), casing_mat, casing, 0.005, "casing-front-flange")
        face["frameSide"] = side.lower()
        step = cube(f"Casing_{side}_InnerStep", (0.018, 0.016, BASE_H + 0.048), (sign * (BASE_W / 2 + 0.006), -0.129, BASE_H / 2 + 0.024), casing_mat, casing, 0.002, "casing-inner-step")
        step["frameSide"] = side.lower()
        reveal = cube(f"Casing_{side}_ShadowReveal", (0.010, 0.012, BASE_H + 0.070), (sign * (BASE_W / 2 + 0.076), -0.130, BASE_H / 2 + 0.035), dark, casing, 0.001, "casing-shadow-reveal")
        reveal["frameSide"] = side.lower()
        ret = cube(f"Casing_{side}_WallReturn", (0.026, 0.210, BASE_H + 0.075), (sign * (BASE_W / 2 + 0.060), -0.010, BASE_H / 2 + 0.0375), casing_mat, casing, 0.003, "casing-wall-return")
        ret["frameSide"] = side.lower()

    head = cube("Frame_Top_StructuralHead", (opening_w, 0.164, HEAD), (0, 0, BASE_H - HEAD / 2), frame_mat, frame, 0.006, "frame-structural-head")
    stop = cube("Frame_Top_RebateStop", (opening_w, 0.050, 0.024), (0, -0.048, BASE_H - HEAD + 0.012), frame_mat, frame, 0.003, "frame-rebate-stop")
    top_face = cube("Casing_Top_FrontFlange", (BASE_W + 0.146, 0.028, 0.074), (0, -0.111, BASE_H + 0.037), casing_mat, casing, 0.005, "casing-front-flange")
    top_step = cube("Casing_Top_InnerStep", (BASE_W + 0.070, 0.016, 0.018), (0, -0.129, BASE_H + 0.006), casing_mat, casing, 0.002, "casing-inner-step")
    top_reveal = cube("Casing_Top_ShadowReveal", (BASE_W + 0.154, 0.012, 0.010), (0, -0.130, BASE_H + 0.078), dark, casing, 0.001, "casing-shadow-reveal")
    top_return = cube("Casing_Top_WallReturn", (BASE_W + 0.132, 0.210, 0.028), (0, -0.010, BASE_H + 0.061), casing_mat, casing, 0.003, "casing-wall-return")
    for obj in (head, stop, top_face, top_step, top_reveal, top_return):
        obj["frameSide"] = "top"
    threshold = cube("Frame_Threshold", (opening_w, 0.180, THRESHOLD), (0, 0.012, THRESHOLD / 2), casing_mat, frame, 0.004, "threshold")
    threshold["frameSide"] = "bottom"
    seal = cube("Frame_Threshold_Gasket", (opening_w - 0.025, 0.018, 0.012), (0, -0.067, THRESHOLD + 0.006), dark, frame, 0.002, "threshold-gasket")
    seal["frameSide"] = "bottom"
    return frame, casing


def add_side_light(assembly, glass, frame_mat, width, height):
    group = empty("SideLightGroup", assembly)
    opening_w = BASE_W - JAMB * 2
    x = -opening_w / 2 + width / 2
    panel = cube("SideLight_Glass", (width - 0.024, 0.020, height - 0.026), (x, 0.010, THRESHOLD + height / 2), glass, group, 0.003, "side-light-glass")
    panel["baseDimensions"] = [width - 0.024, 0.020, height - 0.026]
    for name, loc, dims in (
        ("Left", (x - width / 2 + 0.012, 0, THRESHOLD + height / 2), (0.024, 0.080, height)),
        ("Right", (x + width / 2 - 0.012, 0, THRESHOLD + height / 2), (0.024, 0.080, height)),
        ("Top", (x, 0, THRESHOLD + height - 0.012), (width, 0.080, 0.024)),
        ("Bottom", (x, 0, THRESHOLD + 0.012), (width, 0.080, 0.024)),
    ):
        bar = cube(f"SideLight_{name}Bar", dims, loc, frame_mat, group, 0.003, "side-light-frame")
        bar["sideLightSide"] = name.lower()
    group["baseWidth"] = width
    group["baseHeight"] = height
    return group


def add_hinges(role, leaf_height, hinge_side, hinge_mat, dark, pivot, frame):
    direction = 1 if hinge_side == "left" else -1
    leaf_group = empty(f"{role}LeafHingePlates", pivot)
    frame_group = empty(f"{role}FrameHinges", frame)
    for index, z in enumerate((0.28, leaf_height * 0.52, leaf_height - 0.28), 1):
        barrel = cylinder(f"{role}_Hinge_{index}_Barrel", 0.014, 0.145, (0, -0.014, z), hinge_mat, leaf_group, rotation=(0, math.pi / 2, 0), component="hinge-barrel")
        barrel["hingeIndex"] = index
        plate = cube(f"{role}_Hinge_{index}_LeafPlate", (0.052, 0.008, 0.122), (direction * 0.026, -0.004, z), hinge_mat, leaf_group, 0.002, "hinge-leaf-plate")
        plate["hingeIndex"] = index
        frame_plate = cube(f"{role}_Hinge_{index}_FramePlate", (0.046, 0.008, 0.122), (direction * 0.018, 0.010, z), hinge_mat, frame_group, 0.002, "hinge-frame-plate")
        frame_plate["hingeIndex"] = index
        for screw_z in (-0.038, 0.038):
            cylinder(f"{role}_Hinge_{index}_Screw_{int((z + screw_z) * 1000)}", 0.006, 0.004, (direction * 0.018, 0.003, z + screw_z), dark, frame_group, rotation=(math.pi / 2, 0, 0), component="hinge-screw", vertices=24)
    return leaf_group, frame_group


def add_lock_edge(role, width, hinge_side, brushed, dark, pivot):
    direction = 1 if hinge_side == "left" else -1
    latch_x = direction * width
    group = empty(f"{role}LockEdge", pivot)
    # Match the side mortise to the D90 front smart-lock datum: 286 mm tall
    # and centred at 1100 mm. The old 420 mm edge plate looked oversized as
    # soon as the main leaf was opened.
    lock_center_z = 1.10
    lock_height = 0.286
    case = cube(f"{role}_LockEdge_MortiseCase", (0.038, LEAF_THICKNESS - 0.030, 0.256), (latch_x - direction * 0.018, 0, lock_center_z), dark, group, 0.003, "lock-mortise-case")
    tag(case, "hardware-latch-edge", role.lower())
    plate = cube(f"{role}_LockEdge_Faceplate", (0.010, LEAF_THICKNESS - 0.012, lock_height), (latch_x, 0, lock_center_z), brushed, group, 0.002, "lock-edge-faceplate")
    tag(plate, "hardware-latch-edge", role.lower())
    # Keep the central tongue at the same 1100 mm centreline as the smart
    # lock. The upper tongue is lowered to 1180 mm so the first visible tooth
    # does not sit above the lock body; the lower tongue remains at 1020 mm.
    for index, z in enumerate((1.02, 1.10, 1.18), 1):
        bolt = cube(f"{role}_LockEdge_Bolt_{index}", (0.038, 0.038, 0.032), (latch_x + direction * 0.018, 0, z), brushed, group, 0.002, "lock-bolt")
        tag(bolt, "hardware-latch-edge", role.lower())
    return group


def add_hardware(role, width, hinge_side, dark, black, chrome, brass, pivot):
    direction = 1 if hinge_side == "left" else -1
    latch_x = direction * width
    # Hardware is set in from the latch edge by a fixed factory datum. It is
    # intentionally not attached to the leaf centre, so changing the opening
    # height/width does not make the lock drift across the face.
    anchor_x = latch_x - direction * 0.170
    front_y = -(LEAF_THICKNESS / 2 + 0.014)
    all_group = empty(f"{role}Hardware", pivot)
    all_group["role"] = role.lower()

    long_group = empty(f"{role}Hardware_Long", all_group)
    long_group["hardwareType"] = "long"
    long_group["hardwareAnchorX"] = anchor_x
    long_group["handleModel"] = "SL48F外拉手：110mm宽、940mm高、圆角连续拉杆、双安装座与暗槽"
    pull_height = 0.94
    pull_width = 0.11
    pull_center_z = 1.18
    groove = cube(f"{role}_LongPull_RecessChannel", (0.126, 0.010, 1.00), (anchor_x, front_y + 0.002, pull_center_z), dark, long_group, 0.010, "pull-recess-channel")
    rail = pull_curve(f"{role}_LongPull_RoundedBar", (anchor_x, front_y - 0.012, pull_center_z), pull_width, pull_height, 0.055, chrome, long_group, radius=0.014)
    for item in (groove, rail):
        tag(item, "hardware-latch", role.lower())
    for index, z in enumerate((pull_center_z - pull_height / 2, pull_center_z + pull_height / 2), 1):
        rose = cylinder(f"{role}_LongPull_Mount_{index}_Rose", 0.027, 0.012, (anchor_x, front_y - 0.014, z), dark, long_group, rotation=(math.pi / 2, 0, 0), component="pull-mount-rose")
        collar = cylinder(f"{role}_LongPull_Mount_{index}_Collar", 0.017, 0.042, (anchor_x, front_y - 0.034, z), chrome, long_group, rotation=(math.pi / 2, 0, 0), component="pull-mount-collar")
        for item in (rose, collar):
            tag(item, "hardware-latch", role.lower())

    smart_group = empty(f"{role}Hardware_Smart", all_group)
    smart_group["hardwareType"] = "smart"
    smart_group["hardwareAnchorX"] = anchor_x
    smart_group["hardwareModel"] = "雅帝乐07LM-Y+智能锁：正反面实拍贴图、圆角铝框、34mm实体厚度"
    smart_photo = photo_material("YADILO_07LM_Y_Plus_SmartLock_Photo", SMART_LOCK_IMAGE)
    body = cube(f"{role}_SmartLock_Body", (0.080, 0.034, 0.342), (anchor_x, front_y - 0.010, 1.10), black, smart_group, 0.012, "smart-lock-body")
    front_panel = image_panel(f"{role}_SmartLock_FrontTexture", 0.068, 0.332, (anchor_x, front_y - 0.028, 1.10), smart_photo, smart_group, (0.173, 0.069, 0.439, 0.929), "smart-lock-front-texture")
    back_panel = image_panel(f"{role}_SmartLock_BackTexture", 0.068, 0.332, (anchor_x, front_y + 0.011, 1.10), smart_photo, smart_group, (0.559, 0.069, 0.831, 0.929), "smart-lock-back-texture")
    for item in (body, front_panel, back_panel):
        tag(item, "hardware-latch", role.lower())

    ring_group = empty(f"{role}Hardware_Ring", all_group)
    ring_group["hardwareType"] = "ring"
    ring_group["hardwareAnchorX"] = anchor_x
    disc = cylinder(f"{role}_RingHandle_Disc", 0.072, 0.014, (anchor_x, front_y - 0.020, 1.16), brass, ring_group, rotation=(math.pi / 2, 0, 0), component="ring-handle-disc")
    loop = torus(f"{role}_RingHandle_Loop", 0.055, 0.010, (anchor_x, front_y - 0.036, 1.16), chrome, ring_group, "ring-handle-loop")
    tag(disc, "hardware-latch", role.lower())
    tag(loop, "hardware-latch", role.lower())

    # YT82 is a separate round lock, not the same component as the ring pull.
    # Keep its mounting plate, lock face and reader independent so the browser
    # can configure the lock and handle without accidentally showing both.
    round_group = empty(f"{role}Hardware_RoundLock", all_group)
    round_group["hardwareType"] = "yt82"
    round_group["hardwareAnchorX"] = anchor_x
    round_base = cylinder(f"{role}_RoundLock_Base", 0.070, 0.018, (anchor_x, front_y - 0.020, 1.02), brass, round_group, rotation=(math.pi / 2, 0, 0), component="round-lock-base")
    round_face = cylinder(f"{role}_RoundLock_Face", 0.043, 0.020, (anchor_x, front_y - 0.038, 1.02), black, round_group, rotation=(math.pi / 2, 0, 0), component="round-lock-face")
    round_reader = cylinder(f"{role}_RoundLock_Reader", 0.010, 0.024, (anchor_x, front_y - 0.052, 1.02), chrome, round_group, rotation=(math.pi / 2, 0, 0), component="round-lock-reader")
    tag(round_base, "hardware-latch", role.lower())
    tag(round_face, "hardware-latch", role.lower())
    tag(round_reader, "hardware-latch", role.lower())

    concealed_group = empty(f"{role}Hardware_Concealed", all_group)
    concealed_group["hardwareType"] = "concealed"
    concealed_group["hardwareAnchorX"] = anchor_x
    disc2 = cylinder(f"{role}_Concealed_Lock", 0.048, 0.016, (anchor_x, front_y - 0.022, 1.11), black, concealed_group, rotation=(math.pi / 2, 0, 0), component="concealed-lock")
    keyhole = cylinder(f"{role}_Concealed_Keyhole", 0.012, 0.018, (anchor_x, front_y - 0.034, 1.11), chrome, concealed_group, rotation=(math.pi / 2, 0, 0), component="concealed-keyhole")
    tag(disc2, "hardware-latch", role.lower())
    tag(keyhole, "hardware-latch", role.lower())

    # A small independent cylinder is part of several photographed products
    # (for example 拾翠 and 颂歌). It is not baked into the door-skin texture;
    # the browser enables it per product profile and keeps its datum fixed.
    aux_group = empty(f"{role}Hardware_AuxCylinder", all_group)
    aux_group["hardwareType"] = "aux"
    aux_group["hardwareAnchorX"] = anchor_x
    aux_disc = cylinder(f"{role}_AuxCylinder_Disc", 0.015, 0.012, (anchor_x, front_y - 0.024, .84), chrome, aux_group, rotation=(math.pi / 2, 0, 0), component="aux-cylinder")
    aux_center = cylinder(f"{role}_AuxCylinder_Center", 0.006, 0.016, (anchor_x, front_y - 0.034, .84), brass, aux_group, rotation=(math.pi / 2, 0, 0), component="aux-cylinder-center")
    tag(aux_disc, "hardware-latch", role.lower())
    tag(aux_center, "hardware-latch", role.lower())
    return all_group


def panel_frame(parent, role, direction, center_z, width, height, trim, dark, y):
    center_x = direction * width * 0.50
    group = empty(f"{role}Panel_{int(center_z * 100)}", parent, (0, 0, 0))
    thickness = 0.012
    rail = 0.022
    for name, loc, dims in (
        ("Left", (center_x - direction * (width / 2 - rail / 2), y, center_z), (rail, thickness, height)),
        ("Right", (center_x + direction * (width / 2 - rail / 2), y, center_z), (rail, thickness, height)),
        ("Top", (center_x, y, center_z + height / 2 - rail / 2), (width, thickness, rail)),
        ("Bottom", (center_x, y, center_z - height / 2 + rail / 2), (width, thickness, rail)),
    ):
        cube(f"{group.name}_{name}", dims, loc, trim, group, 0.004, "raised-panel-trim")
    inner = cube(f"{group.name}_Inset", (width - 0.030, 0.006, height - 0.030), (center_x, y + 0.008, center_z), dark, group, 0.002, "panel-inset")
    return group


def add_arch_photo_mask(pivot, role, width, height, mat):
    # Guanmin is a true arched double door. The source photo has a white
    # studio background above the arch; this thin front/back mask removes only
    # that background while leaving the photographed ornament untouched.
    direction = 1 if role == "Child" else -1
    for face, y in (("Front", -(LEAF_THICKNESS / 2 + 0.014)), ("Back", LEAF_THICKNESS / 2 + 0.014)):
        points = [(0, y, height), (direction * width, y, height)]
        for index in range(20, -1, -1):
            t = index / 20
            u = width * t
            boundary = height - 0.265 * (1 - t * t)
            points.append((direction * u, y, boundary))
        mesh = bpy.data.meshes.new(f"D90GuanminArchMask_{role}_{face}_Mesh")
        mesh.from_pydata(points, [], [list(range(len(points)))])
        mesh.update()
        obj = bpy.data.objects.new(f"D90PhotoMask_guanmin_{role}_{face}", mesh)
        bpy.context.collection.objects.link(obj)
        obj.parent = pivot
        obj.data.materials.append(mat)
        obj["component"] = "arched-photo-mask"
        obj["baseWidth"] = width
        obj["baseHeight"] = height
        obj.hide_render = True


def add_style_layers(pivot, role, width, height, mats):
    direction = 1 if role == "Child" else -1
    y = -(LEAF_THICKNESS / 2 + 0.009)
    black, black2, champagne, brass, silver, green, dark = mats
    styles = {}
    for style in ("shicui", "aige", "songge", "guanmin", "jinqu", "shirui"):
        styles[style] = empty(f"D90Style_{style}_{role}", pivot)

    shicui = styles["shicui"]
    for z in (height * 0.28, height * 0.72):
        panel_frame(shicui, role, direction, z, width * 0.70, height * 0.34, black2, dark, y)
    insert = cube(f"D90Shicui_{role}_JadeBar", (width * 0.62, 0.016, 0.065), (direction * width * 0.50, y - 0.008, height * 0.50), green, shicui, 0.018, "stone-insert")
    insert["style"] = "shicui"

    aige = styles["aige"]
    panel_frame(aige, role, direction, height * 0.70, width * 0.66, height * 0.44, black2, dark, y)
    panel_frame(aige, role, direction, height * 0.26, width * 0.66, height * 0.25, black2, dark, y)
    panel_frame(aige, role, direction, height * 0.095, width * 0.70, height * 0.10, black2, dark, y)

    songge = styles["songge"]
    panel_frame(songge, role, direction, height * 0.72, width * 0.66, height * 0.42, black2, dark, y)
    panel_frame(songge, role, direction, height * 0.29, width * 0.66, height * 0.33, black2, dark, y)
    for z in (height * 0.51, height * 0.08):
        curve = []
        center_x = direction * width * 0.50
        half = width * 0.34
        for index in range(25):
            a = math.pi * index / 24
            curve.append((center_x + math.cos(a) * half, y - 0.012, z + math.sin(a) * 0.10))
        poly_curve(f"D90Songge_{role}_Arch_{int(z * 100)}", curve, 0.010, black2, songge, "arched-relief")

    guanmin = styles["guanmin"]
    panel_frame(guanmin, role, direction, height * 0.22, width * 0.68, height * 0.30, brass, dark, y)
    top = panel_frame(guanmin, role, direction, height * 0.82, width * 0.62, height * 0.24, brass, dark, y)
    center_x = direction * width * 0.50
    medallion = torus(f"D90Guanmin_{role}_Medallion", 0.085, 0.020, (center_x, y - 0.020, height * 0.53), brass, guanmin, "ornamental-medallion")
    gem = cylinder(f"D90Guanmin_{role}_Gem", 0.030, 0.016, (center_x, y - 0.028, height * 0.53), green, guanmin, rotation=(math.pi / 2, 0, 0), component="ornamental-gem")
    styles["guanmin"].location.z = 0

    jinqu = styles["jinqu"]
    for offset in (-0.10, 0.08):
        points = []
        center_x = direction * width * 0.50
        for index in range(28):
            t = index / 27
            x = center_x + direction * (width * 0.28 * math.sin(t * math.pi * 1.15) + offset)
            z = height * 0.10 + t * height * 0.80
            points.append((x, y - 0.018, z))
        poly_curve(f"D90Jinqu_{role}_Ribbon_{int(offset * 1000)}", points, 0.018, champagne, jinqu, "metal-ribbon")

    shirui = styles["shirui"]
    block_w = width * 0.24
    for index, z in enumerate((height * 0.20, height * 0.44, height * 0.68, height * 0.86)):
        block = cube(f"D90Shirui_{role}_Panel_{index}", (block_w, 0.016, height * 0.18), (direction * width * 0.50, y - 0.008, z), champagne, shirui, 0.006, "panel-block")
        gap = cube(f"D90Shirui_{role}_GreenSlot_{index}", (0.028, 0.016, height * 0.17), (direction * width * 0.18, y - 0.010, z), green, shirui, 0.004, "green-slot")
    for style_name, style_group in styles.items():
        style_group.hide_render = style_name != "shicui"
    return styles


def build_door():
    # The front/back face maps are replaced in the browser with the original
    # high-resolution D90 photos. These neutral materials keep the GLB valid
    # as a standalone asset and provide a real PBR metal response while loading.
    black = material("D90_BlackMetal", (0.018, 0.020, 0.022), 0.78, 0.24, 0.28)
    black2 = material("D90_ReliefMetal", (0.035, 0.038, 0.041), 0.82, 0.19, 0.30)
    champagne = material("D90_ChampagneMetal", (0.52, 0.25, 0.08), 0.86, 0.22, 0.25)
    brass = material("D90_Brass", (0.46, 0.24, 0.06), 0.90, 0.18, 0.30)
    silver = material("D90_Chrome", (0.62, 0.68, 0.70), 0.96, 0.13, 0.30)
    green = material("D90_GlassGreen", (0.04, 0.32, 0.22), 0.52, 0.16, 0.42)
    dark = material("D90_DeepReveal", (0.005, 0.006, 0.007), 0.20, 0.46)
    glass = material("D90_SidelightGlass", (0.12, 0.21, 0.20), 0.34, 0.09, 0.60)
    core = material("D90_InsulatedCore", (0.035, 0.040, 0.045), 0.66, 0.36)
    folded = material("D90_FoldedEdge", (0.07, 0.075, 0.080), 0.78, 0.24)

    assembly = empty("D90DoorAssembly")
    assembly["product"] = "YADILO D90 金属门系列"
    assembly["series"] = "D90"
    assembly["modelFamily"] = "D90独立GLB：门扇、门框、门套、边门与五金分层"
    assembly["baseWidthMm"] = 1380
    assembly["baseHeightMm"] = 2600
    assembly["leafThicknessMm"] = 90
    assembly["pullHandleModel"] = "D90 SL48F外拉手：110mm宽、940mm高、圆角连续拉杆、双安装座与暗槽"
    assembly["smartLockModel"] = "雅帝乐07LM-Y+：正反面实拍贴图、圆角实体外壳、34mm厚度"
    assembly["modelRevision"] = "20260808-d90-product-hardware-v5-smart-lock-photo-and-rounded-pull"

    frame, casing = add_frame(assembly, black, black2, dark, silver)
    opening_w = BASE_W - JAMB * 2
    leaf_h = BASE_H - HEAD - THRESHOLD
    main_w = (opening_w - GAP) / 2
    child_w = main_w
    child_pivot = empty("ChildLeafPivot", assembly, (-opening_w / 2, 0, THRESHOLD))
    main_pivot = empty("MainLeafPivot", assembly, (opening_w / 2, 0, THRESHOLD))
    for pivot, role, side, width in ((child_pivot, "child", "left", child_w), (main_pivot, "main", "right", main_w)):
        pivot["role"] = role
        pivot["hingeSide"] = side
        pivot["baseWidth"] = width
        pivot["baseHeight"] = leaf_h
        pivot["isDoorPivot"] = True

    add_leaf("Child", child_w, leaf_h, "left", black, black, core, folded, dark, child_pivot)
    add_leaf("Main", main_w, leaf_h, "right", black, black, core, folded, dark, main_pivot)
    for pivot, role, side, width in ((child_pivot, "Child", "left", child_w), (main_pivot, "Main", "right", main_w)):
        add_hinges(role, leaf_h, side, silver, dark, pivot, frame)
        add_lock_edge(role, width, side, silver, dark, pivot)
        add_hardware(role, width, side, dark, black, silver, brass, pivot)
        add_style_layers(pivot, role, width, leaf_h, (black, black2, champagne, brass, silver, green, dark))
        add_arch_photo_mask(pivot, role, width, leaf_h, black)
    add_side_light(assembly, glass, black2, SIDE_LIGHT_W, leaf_h)
    return assembly


def point_at(obj, target):
    obj.rotation_euler = (Vector(target) - obj.location).to_track_quat("-Z", "Y").to_euler()


def add_preview_scene():
    world = bpy.context.scene.world or bpy.data.worlds.new("D90 Studio")
    bpy.context.scene.world = world
    world.use_nodes = True
    background = world.node_tree.nodes.get("Background")
    background.inputs["Color"].default_value = (0.025, 0.027, 0.030, 1)
    background.inputs["Strength"].default_value = 0.20
    floor_mat = material("D90PreviewFloor", (0.12, 0.13, 0.14), 0.12, 0.62)
    bpy.ops.mesh.primitive_plane_add(size=14, location=(0, 0, 0))
    floor = bpy.context.object
    floor.name = "Preview_Floor"
    floor.data.materials.append(floor_mat)
    floor["previewOnly"] = True
    wall = cube("Preview_Wall", (5.8, 0.10, 4.5), (0, 0.62, 2.25), floor_mat, None, 0, "preview-only")
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
        point_at(obj, (0, 0, 1.30))
        return obj

    area("Window_Key", (-2.8, -3.8, 4.7), 1250, 3.6, (1.0, 0.80, 0.60))
    area("Soft_Fill", (2.8, -2.1, 3.0), 720, 2.6, (0.70, 0.82, 1.0))
    area("Edge_Rim", (1.5, 1.9, 3.6), 980, 2.0, (1.0, 0.48, 0.26))
    camera_data = bpy.data.cameras.new("Camera")
    camera = bpy.data.objects.new("Camera", camera_data)
    bpy.context.collection.objects.link(camera)
    camera.location = (2.80, -5.9, 2.65)
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
    bpy.ops.wm.save_as_mainfile(filepath=OUTPUT_BLEND)
    bpy.ops.render.render(write_still=True)
    print("D90 GLB exported:", OUTPUT_GLB)
    print("D90 preview rendered:", OUTPUT_RENDER)


if __name__ == "__main__":
    main()
