"""Render the two 若简 K80 hardware GLBs at the authored door hardware datums.

This is a non-product audit render: it confirms that independently exported
hardware has the same origin, front-plane direction and scale expected by the
existing K80 door asset before the configurator begins loading it at runtime.
"""

import bpy
import os


PROJECT = "/Users/wubin/Documents/Github/baijia"
DOOR = os.path.join(PROJECT, "assets", "models", "yadilo-door-custom.glb")
LOCK = os.path.join(PROJECT, "assets", "models", "hardware", "k80-r55h-smart-lock.glb")
PULL = os.path.join(PROJECT, "assets", "models", "hardware", "k80-sl48f-full-height-pull.glb")
OUTPUT = os.path.join(PROJECT, "audit", "2026-08-14-hardware-glb", "k80-ruojian-fit-check.png")


def clear_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)


def import_at(path, location):
    before = set(bpy.context.scene.objects)
    bpy.ops.import_scene.gltf(filepath=path)
    imported = [obj for obj in bpy.context.scene.objects if obj not in before]
    roots = [obj for obj in imported if obj.parent is None]
    for root in roots:
        root.location = tuple(root.location[i] + location[i] for i in range(3))


def target_constraint(obj, target):
    constraint = obj.constraints.new(type="TRACK_TO")
    constraint.target = target
    constraint.track_axis = "TRACK_NEGATIVE_Z"
    constraint.up_axis = "UP_Y"


def main():
    clear_scene()
    bpy.ops.import_scene.gltf(filepath=DOOR)
    # Hide only the baked variants. The independent assets below take the same
    # positions as the K80 main-leaf smart lock and long pull datums.
    baked_roots = [obj for obj in bpy.context.scene.objects if obj.name.startswith(("MainHardware", "MainLockEdge"))]
    for obj in bpy.context.scene.objects:
        # The imported mesh often sits below two empty nodes. Resolve its
        # ancestry instead of assuming a hide flag on the top empty inherits.
        ancestor = obj
        while ancestor is not None:
            if ancestor in baked_roots:
                obj.hide_render = True
                obj.hide_viewport = True
                break
            ancestor = ancestor.parent
    import_at(LOCK, (-0.6561, -0.0645, 1.1000))
    import_at(PULL, (-0.6561, -0.0665, 1.1800))

    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x = 1200
    scene.render.resolution_y = 1200
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.world.color = (0.018, 0.022, 0.030)

    target = bpy.data.objects.new("Camera target", None)
    bpy.context.collection.objects.link(target)
    target.location = (0, 0, 1.30)
    camera_data = bpy.data.cameras.new("Audit camera")
    camera = bpy.data.objects.new("Audit camera", camera_data)
    bpy.context.collection.objects.link(camera)
    camera.location = (2.10, -5.40, 2.25)
    camera.data.lens = 58
    target_constraint(camera, target)
    scene.camera = camera

    for location, energy, size in [((-2.2, -2.8, 3.8), 750, 2.5), ((2.3, -2.0, 2.1), 420, 1.7), ((0, 1.2, 1.7), 260, 1.4)]:
        data = bpy.data.lights.new("Audit softbox", "AREA")
        data.energy = energy
        data.shape = "DISK"
        data.size = size
        light = bpy.data.objects.new("Audit softbox", data)
        bpy.context.collection.objects.link(light)
        light.location = location
        target_constraint(light, target)

    os.makedirs(os.path.dirname(OUTPUT), exist_ok=True)
    scene.render.filepath = OUTPUT
    bpy.ops.render.render(write_still=True)
    print("Rendered", OUTPUT)


if __name__ == "__main__":
    main()
