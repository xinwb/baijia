"""Build the K80 catalogue hardware as independent, reusable GLB assets.

The door configurator used to only have hardware baked into whole-door GLBs.
These files preserve the catalogue's hardware families as separately addressable
objects: they can be loaded, replaced, and positioned at the door datum without
having to remodel the leaf.

Reference families:
  - 若简 K80: R55H smart lock + SL48F full-height pull
  - 星海 K80: YTF07D sliding smart lock + SL-115 fixed pull
  - 逐玉 K80: F07D sliding smart lock + SL-108 fixed pull
"""

import bpy
import math
import os


PROJECT = "/Users/wubin/Documents/Github/baijia"
OUTPUT_DIR = os.path.join(PROJECT, "assets", "models", "hardware")
PREVIEW_DIR = os.path.join(PROJECT, "audit", "2026-08-14-hardware-glb")


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


def material(name, color, metallic=0.0, roughness=0.5, coat=0.0, emission=None, emission_strength=0.0):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    shader = next(node for node in mat.node_tree.nodes if node.type == "BSDF_PRINCIPLED")
    set_socket(shader, "Base Color", (*color, 1.0))
    set_socket(shader, "Metallic", metallic)
    set_socket(shader, "Roughness", roughness)
    set_socket(shader, "Coat Weight", coat)
    set_socket(shader, "Coat Roughness", 0.16)
    if emission is not None:
        set_socket(shader, "Emission Color", (*emission, 1.0))
        set_socket(shader, "Emission Strength", emission_strength)
    return mat


MATS = {}


def mats():
    global MATS
    MATS = {
        # Keep PVD bodies visibly black under a bright configurator HDRI;
        # fully metallic near-black values reflect the scene as pale grey.
        "black": material("PVD Black", (0.003, 0.005, 0.008), 0.22, 0.26, 0.20),
        "charcoal": material("Satin Charcoal", (0.017, 0.022, 0.029), 0.34, 0.35, 0.14),
        "glass": material("Gloss Black Glass", (0.001, 0.002, 0.004), 0.10, 0.10, 0.52),
        "chrome": material("Bright Chrome", (0.30, 0.33, 0.37), 0.78, 0.18, 0.28),
        "nickel": material("Satin Nickel", (0.19, 0.21, 0.23), 0.70, 0.31, 0.18),
        "copper": material("Warm Copper", (0.30, 0.052, 0.012), 0.64, 0.28, 0.20),
        "amber": material("Warm Amber Light", (0.82, 0.16, 0.025), 0.08, 0.18, 0.08, (1.0, 0.20, 0.025), 2.6),
        "teal": material("Jade Accent", (0.003, 0.16, 0.14), 0.38, 0.27, 0.22),
        "blue": material("Status Blue", (0.004, 0.045, 0.18), 0.30, 0.24, 0.30),
    }


def empty(name, parent=None, location=(0, 0, 0)):
    obj = bpy.data.objects.new(name, None)
    bpy.context.collection.objects.link(obj)
    obj.parent = parent
    obj.location = location
    return obj


def cube(name, dims, location, mat, parent, bevel=0.0025, component=None):
    bpy.ops.mesh.primitive_cube_add(location=location)
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = dims
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if mat:
        obj.data.materials.append(mat)
    if bevel:
        modifier = obj.modifiers.new("Edge radius", "BEVEL")
        modifier.width = min(bevel, min(dims) * 0.42)
        modifier.segments = 4
    obj.parent = parent
    obj["component"] = component or name
    obj["baseDimensionsM"] = list(dims)
    return obj


def cylinder(name, radius, depth, location, mat, parent, rotation=(math.pi / 2, 0, 0), component=None, vertices=48):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth, location=location, rotation=rotation)
    obj = bpy.context.object
    obj.name = name
    obj.data.materials.append(mat)
    modifier = obj.modifiers.new("Edge radius", "BEVEL")
    modifier.width = min(0.002, radius * 0.18)
    modifier.segments = 3
    obj.parent = parent
    obj["component"] = component or name
    return obj


def torus(name, major_radius, minor_radius, location, mat, parent, component):
    bpy.ops.mesh.primitive_torus_add(
        major_radius=major_radius,
        minor_radius=minor_radius,
        major_segments=48,
        minor_segments=12,
        location=location,
        rotation=(math.pi / 2, 0, 0),
    )
    obj = bpy.context.object
    obj.name = name
    obj.data.materials.append(mat)
    obj.parent = parent
    obj["component"] = component
    return obj


def curved_bar(name, points, radius, mat, parent, component="pull-handle"):
    data = bpy.data.curves.new(name, "CURVE")
    data.dimensions = "3D"
    data.resolution_u = 16
    data.bevel_depth = radius
    data.bevel_resolution = 5
    spline = data.splines.new("BEZIER")
    spline.bezier_points.add(len(points) - 1)
    for point, coords in zip(spline.bezier_points, points):
        point.co = coords
        point.handle_left_type = "AUTO"
        point.handle_right_type = "AUTO"
    obj = bpy.data.objects.new(name, data)
    bpy.context.collection.objects.link(obj)
    obj.data.materials.append(mat)
    obj.parent = parent
    obj["component"] = component
    return obj


def screw(name, x, z, parent, mat=None):
    return cylinder(name, 0.0047, 0.0032, (x, -0.024, z), mat or MATS["black"], parent, component="mounting-screw", vertices=24)


def add_fingerprint(parent, x, z, radius=0.018):
    torus("Fingerprint ring", radius, 0.0018, (x, -0.025, z), MATS["chrome"], parent, "fingerprint-ring")
    cylinder("Fingerprint sensor", radius * 0.78, 0.002, (x, -0.0264, z), MATS["black"], parent, component="fingerprint-sensor")


def add_camera(parent, x, z, radius=0.010):
    cylinder("Face camera", radius, 0.003, (x, -0.025, z), MATS["glass"], parent, component="face-camera")
    cylinder("Camera lens", radius * 0.42, 0.0036, (x, -0.027, z), MATS["blue"], parent, component="camera-lens")


def add_keypad(parent, x, z, cols=3, rows=4, pitch_x=0.019, pitch_z=0.023, size=0.004):
    for row in range(rows):
        for col in range(cols):
            cylinder(
                "Touch key %s-%s" % (row + 1, col + 1),
                size,
                0.0017,
                (x + (col - (cols - 1) / 2) * pitch_x, -0.0258, z + ((rows - 1) / 2 - row) * pitch_z),
                MATS["chrome"],
                parent,
                component="touch-key",
                vertices=20,
            )


def create_root(code, kind, reference, dimensions_mm):
    root = empty(code)
    root["assetType"] = kind
    root["catalogCode"] = code
    root["catalogReference"] = reference
    root["dimensionsMm"] = dimensions_mm
    root["mountPlane"] = "door-front-y-zero"
    root["exportIntent"] = "independent-configurator-hardware"
    return root


def build_r55h():
    root = create_root("K80_R55H_SmartLock", "smart-lock", "若简 K80 / R55H", "84 × 39 × 335")
    cube("R55H outer shell", (0.084, 0.039, 0.335), (0, 0.020, 0), MATS["charcoal"], root, 0.010, "lock-shell")
    cube("R55H glass face", (0.072, 0.0022, 0.302), (0, -0.0015, 0.010), MATS["glass"], root, 0.006, "lock-glass-face")
    for x in (-0.026, 0, 0.026):
        add_camera(root, x, 0.118, 0.0062)
    cube("Welcome display", (0.050, 0.0028, 0.020), (0, -0.0031, 0.071), MATS["charcoal"], root, 0.002, "lock-display")
    add_keypad(root, 0, 0.012, pitch_x=0.022, pitch_z=0.028, size=0.0045)
    add_fingerprint(root, 0, -0.102, 0.021)
    cube("R55H lower push pad", (0.052, 0.008, 0.068), (0, -0.006, -0.145), MATS["charcoal"], root, 0.008, "lock-push-pad")
    for x in (-0.031, 0.031):
        screw("R55H screw", x, -0.147, root, MATS["black"])
    return root


def build_sl48f():
    root = create_root("K80_SL48F_FullHeightPull", "pull-handle", "若简 K80 / SL48F", "110 × 78 × 940")
    # The catalogue elevation and hardware sheet show SL48F as a single
    # full-height fixed rail: a narrow rounded body, a recessed dark channel,
    # and two end mounts. The orange line in the product PDF is the door's
    # integrated centre light, so it must not be duplicated inside the pull.
    cube("SL48F fixed pull rail", (0.060, 0.034, 0.940), (0, -0.042, 0), MATS["copper"], root, 0.010, "fixed-pull-grip")
    cube("SL48F recessed inner channel", (0.026, 0.005, 0.846), (0, -0.062, 0), MATS["black"], root, 0.004, "pull-inlay")
    for z in (-0.445, 0.445):
        cube("SL48F end cap", (0.060, 0.040, 0.022), (0, -0.043, z), MATS["copper"], root, 0.004, "pull-end-cap")
        cylinder("SL48F mount", 0.015, 0.010, (0, -0.006, z), MATS["nickel"], root, component="pull-mount")
    root["preferredFinish"] = "warm-copper"
    root["referenceEvidence"] = "Catalog PDF p.32 / exterior-handle sheet p.279: one full-height illuminated rail"
    return root


def build_ytf07d():
    root = create_root("K80_YTF07D_SlidingSmartLock", "smart-lock", "星海 K80 / YTF07D", "86 × 41 × 360")
    cube("YTF07D outer shell", (0.086, 0.041, 0.360), (0, 0.0205, 0), MATS["charcoal"], root, 0.010, "lock-shell")
    cube("YTF07D glossy slider", (0.073, 0.0025, 0.238), (0, -0.0016, 0.051), MATS["glass"], root, 0.007, "sliding-cover")
    cube("YTF07D cover seam", (0.070, 0.0032, 0.004), (0, -0.0032, -0.008), MATS["nickel"], root, 0.001, "slider-seam")
    cube("YTF07D slide tab", (0.036, 0.006, 0.016), (0, -0.005, 0.135), MATS["nickel"], root, 0.006, "slider-tab")
    add_camera(root, -0.020, 0.092, 0.008)
    add_camera(root, 0.020, 0.092, 0.008)
    add_keypad(root, 0, 0.020, pitch_x=0.020, pitch_z=0.026, size=0.004)
    add_fingerprint(root, 0, -0.086, 0.019)
    torus("YTF07D lower dial", 0.022, 0.004, (0, -0.025, -0.143), MATS["chrome"], root, "mechanical-dial")
    cylinder("YTF07D lower dial core", 0.016, 0.003, (0, -0.026, -0.143), MATS["charcoal"], root, component="mechanical-dial")
    return root


def build_sl115():
    root = create_root("K80_SL115_FixedPull", "pull-handle", "星海 K80 / SL-115", "96 × 66 × 610")
    # SL-115 is a restrained fixed handle: a straight material ribbon with
    # visible standoffs rather than the full-height U profile of SL48F.
    cube("SL115 grip", (0.040, 0.020, 0.530), (0, -0.047, 0), MATS["nickel"], root, 0.012, "fixed-pull-grip")
    cube("SL115 shadow channel", (0.061, 0.005, 0.560), (0, -0.013, 0), MATS["black"], root, 0.012, "pull-shadow-channel")
    for z in (-0.245, 0.245):
        cylinder("SL115 standoff", 0.015, 0.045, (0, -0.028, z), MATS["charcoal"], root, component="pull-mount")
        cylinder("SL115 cover cap", 0.012, 0.003, (0, -0.052, z), MATS["copper"], root, component="pull-mount-cap")
    root["preferredFinish"] = "satin-nickel-with-copper-mounts"
    root["referenceEvidence"] = "Catalog PDF p.68 / exterior-handle sheet p.280: SL-115 sliding-cover fixed pull"
    return root


def build_f07d():
    root = create_root("K80_F07D_SlidingSmartLock", "smart-lock", "逐玉 K80 / F07D", "84 × 40 × 304")
    cube("F07D outer shell", (0.084, 0.040, 0.304), (0, 0.020, 0), MATS["black"], root, 0.009, "lock-shell")
    cube("F07D sliding cover", (0.072, 0.0025, 0.175), (0, -0.0014, 0.068), MATS["glass"], root, 0.007, "sliding-cover")
    cube("F07D copper slider", (0.042, 0.005, 0.010), (0, -0.004, 0.137), MATS["copper"], root, 0.004, "slider-tab")
    add_camera(root, -0.018, 0.091, 0.007)
    add_camera(root, 0.018, 0.091, 0.007)
    add_keypad(root, 0, 0.031, pitch_x=0.019, pitch_z=0.023, size=0.0038)
    add_fingerprint(root, 0, -0.079, 0.020)
    cube("F07D doorbell", (0.022, 0.004, 0.019), (0, -0.004, -0.130), MATS["teal"], root, 0.005, "doorbell")
    return root


def build_sl108():
    root = create_root("K80_SL108_FixedPull", "pull-handle", "逐玉 K80 / SL-108", "110 × 58 × 448")
    # The teal inlay follows 逐玉's angular jade-colour composition from the
    # catalogue rather than applying a generic stainless straight pull.
    cube("SL108 outer grip", (0.057, 0.024, 0.386), (0, -0.043, 0), MATS["charcoal"], root, 0.014, "fixed-pull-grip")
    cube("SL108 jade inlay", (0.013, 0.004, 0.306), (0, -0.058, 0), MATS["teal"], root, 0.006, "jade-inlay")
    cube("SL108 upper chevron", (0.056, 0.006, 0.036), (0, -0.059, 0.160), MATS["teal"], root, 0.004, "jade-chevron")
    bpy.context.object.rotation_euler[1] = math.radians(-18)
    for z in (-0.155, 0.155):
        cylinder("SL108 concealed standoff", 0.014, 0.042, (0, -0.027, z), MATS["black"], root, component="pull-mount")
    root["preferredFinish"] = "charcoal-with-jade-inlay"
    root["referenceEvidence"] = "Catalog PDF p.80 / exterior-handle sheet p.280: SL-108 sliding-cover fixed pull"
    return root


def build_jiangchuan_round_pull():
    """One of the paired low circular pulls on 雅帝江川赋.

    The catalogue elevation uses two shallow dark discs with a fine warm-gold
    rim, one on each leaf.  It is intentionally not a generic ring: the
    exposed face is a recessed mineral-black disc and the grip projects only
    a small amount from the leaf.
    """
    root = create_root("K80_Jiangchuan_RoundPull", "fixed-pull", "雅帝江川赋 K80 / 双圆低位拉手", "218 × 56 × 218")
    cylinder("Jiangchuan recessed backplate", 0.109, 0.012, (0, 0.006, 0), MATS["black"], root, component="pull-backplate")
    cylinder("Jiangchuan mineral grip disc", 0.090, 0.026, (0, -0.019, 0), MATS["charcoal"], root, component="fixed-pull-grip")
    torus("Jiangchuan antique bronze rim", 0.098, 0.0065, (0, -0.035, 0), MATS["copper"], root, "pull-rim")
    torus("Jiangchuan inner shadow ring", 0.078, 0.0032, (0, -0.038, 0), MATS["black"], root, "pull-inner-ring")
    for angle in (math.radians(42), math.radians(222)):
        x = math.cos(angle) * 0.066
        z = math.sin(angle) * 0.066
        cylinder("Jiangchuan concealed mount", 0.008, 0.017, (x, -0.016, z), MATS["black"], root, component="pull-mount")
    root["preferredFinish"] = "antique-bronze-rim / mineral-black-disc"
    root["referenceEvidence"] = "雅帝江川赋正面效果图：双门中下部一对独立圆形固定拉手"
    return root


def build_qingya_center_pull():
    """Compact vertical pull set into 清雅's middle dark cross band."""
    root = create_root("K80_Qingya_CenterPull", "recessed-pull", "雅帝清雅 K80 / 中部短金属拉手", "92 × 58 × 286")
    cube("Qingya dark recess", (0.092, 0.012, 0.286), (0, 0.006, 0), MATS["black"], root, 0.010, "pull-recess")
    cube("Qingya brushed gold grip", (0.039, 0.030, 0.194), (0, -0.027, 0), MATS["copper"], root, 0.010, "fixed-pull-grip")
    cube("Qingya inner shadow", (0.014, 0.004, 0.154), (0, -0.044, 0), MATS["charcoal"], root, 0.004, "pull-inlay")
    for z in (-0.108, 0.108):
        cylinder("Qingya hidden standoff", 0.011, 0.034, (0, -0.010, z), MATS["nickel"], root, component="pull-mount")
    root["preferredFinish"] = "champagne-gold / black-recess"
    root["referenceEvidence"] = "雅帝清雅效果图：中部深色横带内的短金属拉手，不使用通天拉手"
    return root


def build_qinghuafu_moon_pull():
    """Round moon pull reconstructed for 清华赋's ink-green elevation."""
    root = create_root("K80_Qinghuafu_MoonPull", "fixed-pull", "雅帝清华赋 K80 / 圆月拉手", "276 × 70 × 276")
    cylinder("Qinghuafu moon backplate", 0.138, 0.012, (0, 0.006, 0), MATS["black"], root, component="pull-backplate")
    torus("Qinghuafu moon brass halo", 0.112, 0.010, (0, -0.031, 0), MATS["copper"], root, "moon-halo")
    cylinder("Qinghuafu moon jade centre", 0.083, 0.018, (-0.018, -0.023, 0), MATS["teal"], root, component="moon-jade-core")
    cylinder("Qinghuafu moon silver disc", 0.049, 0.026, (0.032, -0.039, 0.006), MATS["chrome"], root, component="moon-grip-disc")
    curved_bar(
        "Qinghuafu crescent grip",
        [(-0.038, -0.047, -0.060), (0.017, -0.058, -0.094), (0.078, -0.047, -0.038)],
        0.008,
        MATS["copper"],
        root,
        "crescent-fixed-pull",
    )
    root["preferredFinish"] = "antique-gold / jade / moon-silver"
    root["referenceEvidence"] = "雅帝清华赋效果图：墨绿门面上的独立圆月式固定拉手"
    return root


def world_setup():
    scene = bpy.context.scene
    # Blender 4 uses EEVEE_NEXT while the installed Blender 5.1 build keeps
    # the compatibility enum as BLENDER_EEVEE.
    engines = {item.identifier for item in bpy.types.RenderSettings.bl_rna.properties["engine"].enum_items}
    scene.render.engine = "BLENDER_EEVEE_NEXT" if "BLENDER_EEVEE_NEXT" in engines else "BLENDER_EEVEE"
    scene.render.resolution_x = 1000
    scene.render.resolution_y = 1000
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.film_transparent = False
    scene.world.color = (0.025, 0.030, 0.038)


def add_preview_camera(root):
    camera_data = bpy.data.cameras.new("Preview camera")
    camera = bpy.data.objects.new("Preview camera", camera_data)
    bpy.context.collection.objects.link(camera)
    camera.location = (0.26, -1.60, 0.10)
    target = empty("Preview target", location=(0, 0, 0))
    constraint = camera.constraints.new(type="TRACK_TO")
    constraint.target = target
    constraint.track_axis = "TRACK_NEGATIVE_Z"
    constraint.up_axis = "UP_Y"
    camera.data.type = "ORTHO"
    asset_height_mm = float(str(root.get("dimensionsMm", "0 × 0 × 360")).split("×")[-1].strip())
    camera.data.ortho_scale = max(0.16, asset_height_mm / 1000 * 1.28)
    bpy.context.scene.camera = camera
    for location, energy, size in [((-0.55, -0.65, 0.58), 290, 1.8), ((0.55, -0.35, 0.18), 135, 1.2), ((0, 0.45, -0.35), 90, 1.0)]:
        light_data = bpy.data.lights.new("Preview softbox", "AREA")
        light_data.energy = energy
        light_data.shape = "DISK"
        light_data.size = size
        light = bpy.data.objects.new("Preview softbox", light_data)
        bpy.context.collection.objects.link(light)
        light.location = location
        track = light.constraints.new(type="TRACK_TO")
        track.target = target
        track.track_axis = "TRACK_NEGATIVE_Z"
        track.up_axis = "UP_Y"


def export_asset(root, filename):
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    os.makedirs(PREVIEW_DIR, exist_ok=True)
    world_setup()
    add_preview_camera(root)
    bpy.context.scene.render.filepath = os.path.join(PREVIEW_DIR, filename.replace(".glb", ".png"))
    bpy.ops.render.render(write_still=True)
    bpy.ops.object.select_all(action="DESELECT")
    for obj in bpy.context.scene.objects:
        if obj.type in {"MESH", "CURVE", "EMPTY"} and obj.name != "Preview target":
            obj.select_set(True)
    bpy.context.view_layer.objects.active = root
    bpy.ops.export_scene.gltf(
        filepath=os.path.join(OUTPUT_DIR, filename),
        export_format="GLB",
        use_selection=True,
        export_apply=True,
        export_yup=True,
        export_cameras=False,
        export_lights=False,
        export_materials="EXPORT",
        export_extras=True,
    )


def main():
    assets = [
        (build_r55h, "k80-r55h-smart-lock.glb"),
        (build_sl48f, "k80-sl48f-full-height-pull.glb"),
        (build_ytf07d, "k80-ytf07d-sliding-smart-lock.glb"),
        (build_sl115, "k80-sl115-fixed-pull.glb"),
        (build_f07d, "k80-f07d-sliding-smart-lock.glb"),
        (build_sl108, "k80-sl108-fixed-pull.glb"),
        (build_jiangchuan_round_pull, "k80-jiangchuan-round-pull.glb"),
        (build_qingya_center_pull, "k80-qingya-center-pull.glb"),
        (build_qinghuafu_moon_pull, "k80-qinghuafu-moon-pull.glb"),
    ]
    for builder, filename in assets:
        clear_scene()
        mats()
        root = builder()
        export_asset(root, filename)
        print("Exported", filename)


if __name__ == "__main__":
    main()
