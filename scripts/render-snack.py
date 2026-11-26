"""Render the snack asset with Blender 5.3, no external dependencies.
Run: blender --background --python scripts/render-snack.py
"""
from pathlib import Path
import math
import random
import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / 'public' / 'mascot' / 'play' / 'snack.png'
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
random.seed(17)

def material(name, color, roughness=0.4):
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = (*color, 1)
    mat.use_nodes = True
    shader = mat.node_tree.nodes.get('Principled BSDF')
    shader.inputs['Base Color'].default_value = (*color, 1)
    shader.inputs['Roughness'].default_value = roughness
    return mat

dough = material('Warm baked biscuit', (0.66, 0.32, 0.105), 0.48)
# Fine baked texture remains subtle at icon size.
nodes = dough.node_tree.nodes
noise = nodes.new('ShaderNodeTexNoise')
noise.inputs['Scale'].default_value = 38
noise.inputs['Detail'].default_value = 2
bump = nodes.new('ShaderNodeBump')
bump.inputs['Strength'].default_value = 0.17
bump.inputs['Distance'].default_value = 0.035
dough.node_tree.links.new(noise.outputs['Fac'], bump.inputs['Height'])
dough.node_tree.links.new(bump.outputs['Normal'], nodes.get('Principled BSDF').inputs['Normal'])
chocolate = material('Milk chocolate', (0.095, 0.035, 0.021), 0.32)
eye_mat = material('Espresso eyes and smile', (0.024, 0.014, 0.012), 0.27)
glint = material('Eye catchlight', (1, 0.91, 0.75), 0.2)
blush = material('Soft peach cheeks', (0.80, 0.22, 0.11), 0.6)

def sphere(name, location, scale, mat):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=32, ring_count=20, location=location)
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    obj.data.materials.append(mat)
    for polygon in obj.data.polygons:
        polygon.use_smooth = True
    return obj

bpy.ops.mesh.primitive_cylinder_add(vertices=96, radius=1, depth=0.36, rotation=(math.pi / 2, 0, 0))
body = bpy.context.object
body.name = 'Soft thick cookie'
body.data.materials.append(dough)
bevel = body.modifiers.new('Rounded baked edge', 'BEVEL')
bevel.width = 0.15
bevel.segments = 5
body.modifiers.new('Weighted smooth normals', 'WEIGHTED_NORMAL')
for polygon in body.data.polygons:
    polygon.use_smooth = True

for i, (x, z, size) in enumerate([
    (-0.57, 0.48, 0.13), (-0.12, 0.71, 0.12), (0.40, 0.59, 0.14),
    (0.73, 0.15, 0.11), (0.59, -0.49, 0.14), (0.04, -0.72, 0.13),
    (-0.55, -0.52, 0.12), (-0.77, -0.03, 0.10),
]):
    chip = sphere('Chocolate chip %02d' % i, (x, -0.185, z), (size, 0.075, size * 0.85), chocolate)
    chip.rotation_euler[1] = random.uniform(-1, 1)
for x in (-0.27, 0.27):
    sphere('Friendly eye', (x, -0.205, 0.12), (0.060, 0.037, 0.085), eye_mat)
    sphere('Eye highlight', (x - 0.014, -0.24, 0.15), (0.017, 0.010, 0.021), glint)
    sphere('Rosy cheek', (x * 1.43, -0.202, -0.09), (0.10, 0.014, 0.048), blush)
curve = bpy.data.curves.new('Happy smile curve', 'CURVE')
curve.dimensions = '3D'
curve.bevel_depth = 0.022
curve.bevel_resolution = 4
spline = curve.splines.new('POLY')
spline.points.add(24)
for i, point in enumerate(spline.points):
    t = math.pi + math.pi * i / 24
    point.co = (0.14 * math.cos(t), -0.219, -0.12 + 0.12 * math.sin(t), 1)
smile = bpy.data.objects.new('Small happy smile', curve)
bpy.context.collection.objects.link(smile)
smile.data.materials.append(eye_mat)

def aim(obj, point):
    obj.rotation_euler = (Vector(point) - obj.location).to_track_quat('-Z', 'Y').to_euler()

def area(name, location, energy, size, color):
    bpy.ops.object.light_add(type='AREA', location=location)
    light = bpy.context.object
    light.name = name
    light.data.energy = energy
    light.data.shape = 'DISK'
    light.data.size = size
    light.data.color = color
    aim(light, (0, 0, 0))

area('Large soft studio key', (-3, -4, 5), 450, 4, (1, 0.93, 0.85))
area('Cool robot matching fill', (4, -2, 2), 230, 3, (0.79, 0.86, 1))
area('Soft upper rim', (1, 3, 4), 380, 3, (1, 0.96, 0.90))
bpy.ops.object.camera_add(location=(1.5, -7, 2.1))
camera = bpy.context.object
aim(camera, (0, 0, 0))
camera.data.type = 'ORTHO'
camera.data.ortho_scale = 2.55
scene = bpy.context.scene
scene.camera = camera
scene.render.engine = 'CYCLES'
scene.cycles.samples = 96
scene.cycles.use_denoising = True
scene.render.resolution_x = 160
scene.render.resolution_y = 160
scene.render.resolution_percentage = 100
scene.render.film_transparent = True
scene.world.color = (0.22, 0.22, 0.22)
scene.view_settings.view_transform = 'AgX'
scene.render.image_settings.file_format = 'PNG'
scene.render.image_settings.color_mode = 'RGBA'
scene.render.image_settings.color_depth = '8'
OUTPUT.parent.mkdir(parents=True, exist_ok=True)
scene.render.filepath = str(OUTPUT)
bpy.ops.render.render(write_still=True)
print('Rendered transparent snack:', OUTPUT)
