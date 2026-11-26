"""Render the supplied mascot without modifying its .blend.
Usage (Blender 5.3):
  blender --background --python scripts/render-mascot.py -- --source PATH
Optional: --output DIR --size 768 --samples 48 --poses idle wave1
All poses share a camera and canvas. Rotations deform the original weighted rig.
"""
import argparse
import math
import sys
from pathlib import Path
import bpy
from mathutils import Quaternion, Vector

POSES = ('idle', 'wave1', 'wave2', 'poke', 'pet', 'eat1', 'eat2', 'happy', 'blink')
p = argparse.ArgumentParser(description=__doc__)
p.add_argument('--source', type=Path, default=Path('C:/Users/fhzh/AppData/Local/Temp/codex-file-preview-SuBZBv/mascot-3d-v1.blend'))
p.add_argument('--output', type=Path, default=Path(__file__).resolve().parents[1] / 'public/mascot/play')
p.add_argument('--size', type=int, default=768)
p.add_argument('--samples', type=int, default=48)
p.add_argument('--poses', nargs='+', choices=POSES, default=POSES)
a = p.parse_args(sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else [])
bpy.ops.wm.open_mainfile(filepath=str(a.source.resolve()))
s = bpy.context.scene
rig = bpy.data.objects['Mascot Rig']
rig.animation_data_clear()
s.render.engine = 'CYCLES'
s.cycles.device = 'CPU'
s.cycles.samples = a.samples
s.cycles.use_denoising = True
s.cycles.seed = 27
s.render.resolution_x = s.render.resolution_y = a.size
s.render.resolution_percentage = 100
s.render.image_settings.file_format = 'PNG'
s.render.image_settings.color_mode = 'RGBA'
s.render.image_settings.color_depth = '8'
s.render.image_settings.compression = 100
s.render.film_transparent = True
s.render.use_file_extension = True
bpy.data.objects['Studio backdrop'].hide_render = True
s.camera = bpy.data.objects['Mascot • front']
s.camera.data.type = 'ORTHO'
s.camera.data.ortho_scale = 5.6
s.camera.location = (4.0, -16.0, 4.4)
target = Vector((0, 0, 2.18))
s.camera.rotation_euler = (target - s.camera.location).to_track_quat('-Z', 'Y').to_euler()

# Express rotations about character/world axes in each rest bone's local basis.
# Inherited rotations preserve shoulder -> elbow -> mitten and torso -> head motion.
def rotate(name, x=0, y=0, z=0):
    b = rig.pose.bones[name]
    rest = b.bone.matrix_local.to_quaternion()
    q = Quaternion((1, 0, 0), math.radians(x)) @ Quaternion((0, 1, 0), math.radians(y)) @ Quaternion((0, 0, 1), math.radians(z))
    b.rotation_mode = 'QUATERNION'
    b.rotation_quaternion = rest.inverted() @ q @ rest

def eyes(scale):
    for side in ('L', 'R'):
        rig.pose.bones['Eye.' + side].scale.y = scale

# A small biscuit supplies a clear eating cue; the mascot meshes are untouched.
bpy.ops.mesh.primitive_cylinder_add(vertices=48, radius=.145, depth=.07, location=(0, -1.1, 1.75), rotation=(math.pi/2, 0, 0))
cookie = bpy.context.object
cookie.name = 'Render-only biscuit'
mat = bpy.data.materials.new('Render-only biscuit gold')
mat.diffuse_color = (.62, .29, .075, 1)
cookie.data.materials.append(mat)
bevel = cookie.modifiers.new('Soft biscuit edge', 'BEVEL')
bevel.width = .025
bevel.segments = 3
for poly in cookie.data.polygons:
    poly.use_smooth = True

def pose(name):
    for b in rig.pose.bones:
        b.location = (0, 0, 0)
        b.rotation_mode = 'QUATERNION'
        b.rotation_quaternion = (1, 0, 0, 0)
        b.scale = (1, 1, 1)
    cookie.hide_render = name not in ('eat1', 'eat2')
    if name == 'idle':
        rotate('Head', z=-3)
        rotate('Upper Arm.L', x=-3, y=-4)
    elif name in ('wave1', 'wave2'):
        phase = name == 'wave2'
        rotate('Body', y=-4 if phase else 3, z=-3)
        rotate('Head', y=4 if phase else -3, z=5)
        rotate('Upper Arm.L', x=-65, y=-105 if phase else -88)
        rotate('Forearm.L', y=-35 if phase else -65, z=-12 if phase else 10)
        rotate('Hand.L', y=-18 if phase else 20)
        rotate('Upper Arm.R', y=-10)
    elif name == 'poke':
        rotate('Body', x=-8, y=9)
        rotate('Head', x=6, y=-14, z=-8)
        rotate('Upper Arm.L', x=-45, y=-36)
        rotate('Forearm.L', x=-36, y=-22)
        rotate('Upper Arm.R', y=18)
        eyes(.70)
    elif name == 'pet':
        rotate('Body', x=8, y=-5)
        rotate('Head', x=10, y=-9, z=7)
        rotate('Upper Arm.L', y=-25)
        rotate('Upper Arm.R', y=25)
        eyes(.18)
    elif name in ('eat1', 'eat2'):
        chew = name == 'eat2'
        rotate('Body', x=3 if chew else -3, y=-3)
        rotate('Head', x=7 if chew else 1, z=-4 if chew else 3)
        rotate('Upper Arm.R', x=-64, y=26)
        rotate('Forearm.R', x=-52, y=-15, z=-20)
        rotate('Upper Arm.L', x=-30, y=-18)
        rotate('Forearm.L', x=-36, y=15)
        cookie.location = (-.16, -1.15, 1.92 if chew else 1.65)
        cookie.scale = (.73, .73, .73) if chew else (1, 1, 1)
        eyes(.50 if chew else .90)
    elif name == 'happy':
        rotate('Body', x=-4, y=4)
        rotate('Head', x=-5, z=-6)
        rotate('Upper Arm.L', x=-55, y=-115)
        rotate('Upper Arm.R', x=-55, y=115)
        rotate('Forearm.L', y=-25)
        rotate('Forearm.R', y=25)
        rotate('Leg.L', y=-7)
        rotate('Leg.R', y=7)
        eyes(.40)
    elif name == 'blink':
        rotate('Head', z=-3)
        rotate('Upper Arm.L', x=-3, y=-4)
        eyes(.08)
    bpy.context.view_layer.update()
    # Keep the soles grounded after torso lean; use evaluated geometry, not rest bounds.
    deps = bpy.context.evaluated_depsgraph_get()
    low = min((o.evaluated_get(deps).matrix_world @ Vector(v)).z for o in bpy.data.objects if o.type == 'MESH' and o.parent == rig for v in o.evaluated_get(deps).bound_box)
    rig.location.z = -low + .04
    bpy.context.view_layer.update()

a.output.mkdir(parents=True, exist_ok=True)
for name in a.poses:
    rig.location = (0, 0, 0)
    pose(name)
    s.render.filepath = str((a.output / (name + '.png')).resolve())
    bpy.ops.render.render(write_still=True)
    print('POSE_RENDERED', name, s.render.filepath, flush=True)
print('Source preserved:', a.source, flush=True)
