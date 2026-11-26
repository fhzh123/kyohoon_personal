"""Food poses for the original mascot rig. All geometry is render-only."""
import math
import bpy
from mathutils import Vector


def _dough():
    material = bpy.data.materials.new('Golden oat cookie')
    material.use_nodes = True
    nodes = material.node_tree.nodes
    links = material.node_tree.links
    shader = nodes.get('Principled BSDF')
    shader.inputs['Roughness'].default_value = .64
    noise = nodes.new('ShaderNodeTexNoise')
    noise.inputs['Scale'].default_value = 8
    noise.inputs['Detail'].default_value = 3
    ramp = nodes.new('ShaderNodeValToRGB')
    ramp.color_ramp.elements[0].color = (.31, .105, .017, 1)
    ramp.color_ramp.elements[1].color = (.91, .48, .105, 1)
    links.new(noise.outputs['Fac'], ramp.inputs[0])
    links.new(ramp.outputs[0], shader.inputs['Base Color'])
    grain = nodes.new('ShaderNodeTexNoise')
    grain.inputs['Scale'].default_value = 47
    bump = nodes.new('ShaderNodeBump')
    bump.inputs['Strength'].default_value = .23
    bump.inputs['Distance'].default_value = .018
    links.new(grain.outputs['Fac'], bump.inputs['Height'])
    links.new(bump.outputs['Normal'], shader.inputs['Normal'])
    return material


def _outline(bitten):
    start, end = (100, 375) if bitten else (0, 360)
    segments = 80
    edge = []
    for i in range(segments + int(bitten)):
        a = math.radians(start + (end - start) * i / segments)
        r = 1 + .013 * math.cos(5 * a) + .009 * math.sin(9 * a)
        edge.append(Vector((r * math.cos(a), r * math.sin(a))))
    if bitten:
        # Two overlapping tooth marks cut through the top right edge.
        tip = Vector((.44, .45))
        for p, control, q in ((edge[-1], (.56, .07), tip),
                              (tip, (-.095, .31), edge[0])):
            for i in range(1, 17):
                t = i / 16
                edge.append((1-t)**2*p + 2*t*(1-t)*Vector(control) + t*t*q)
        edge.pop()
    return edge


def _cookie_mesh(bitten):
    key = 'Chocolate chip cookie ' + ('bitten' if bitten else 'whole')
    if key in bpy.data.meshes:
        return bpy.data.meshes[key]
    edge = _outline(bitten)
    n = len(edge)
    vertices, faces = [], []
    # Front and back bevels plus a slightly domed face, in local XY.
    for radius, height in ((.92, -.20), (.98, -.15), (1, -.065),
                           (1, .03), (.98, .12), (.92, .17), (.66, .19)):
        vertices.extend((radius*p.x, radius*p.y, height) for p in edge)
    faces.append(tuple(reversed(range(n))))
    for ring in range(6):
        for i in range(n):
            a, b = ring*n + i, ring*n + (i+1) % n
            faces.append((a, b, b+n, a+n))
    faces.append(tuple(range(6*n, 7*n)))
    dough_faces = len(faces)
    chips = [(-.50,.43,.145), (-.13,.70,.11), (.44,.52,.15),
             (-.73,-.01,.105), (-.13,.12,.16), (.64,-.04,.13),
             (.21,-.39,.14), (-.48,-.43,.13), (-.08,-.70,.095)]
    for index, (cx, cy, size) in enumerate(chips):
        if bitten and index in (1, 2):
            continue
        base = len(vertices)
        # Buried, asymmetric seven-sided chunks with distinct dark facets.
        for radius, height, shift in ((1, .14, 0), (.89, .225, .05), (.50, .265, .20)):
            for i in range(7):
                a = i * math.tau / 7 + index
                r = radius * size * (1 + .14 * math.sin(3*a))
                vertices.append((cx+r*math.cos(a)+shift*size,
                                 cy+.9*r*math.sin(a), height))
        for ring in range(2):
            for i in range(7):
                a, b = base+7*ring+i, base+7*ring+(i+1)%7
                faces.append((a,b,b+7,a+7))
        faces.append(tuple(range(base+14, base+21)))
    mesh = bpy.data.meshes.new(key)
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    mesh.materials.append(bpy.data.materials.get('Golden oat cookie') or _dough())
    chocolate = bpy.data.materials.get('Dark chocolate chunks')
    if chocolate is None:
        chocolate = bpy.data.materials.new('Dark chocolate chunks')
        chocolate.use_nodes = True
        shader = chocolate.node_tree.nodes.get('Principled BSDF')
        shader.inputs['Base Color'].default_value = (.051, .016, .008, 1)
        shader.inputs['Roughness'].default_value = .43
    mesh.materials.append(chocolate)
    for p in mesh.polygons:
        p.material_index = int(p.index >= dough_faces)
        p.use_smooth = 0 < p.index < dough_faces-1
    return mesh


def _happy_eyes(rig):
    from mathutils.bvhtree import BVHTree
    visor = bpy.data.objects['Curved faceplate'].data
    surface_tree = BVHTree.FromPolygons([v.co for v in visor.vertices],
                                        [p.vertices[:] for p in visor.polygons])
    for side in ('L', 'R'):
        obj = bpy.data.objects['Signal eye.' + side]
        bone = rig.pose.bones['Eye.' + side]
        if obj.data.shape_keys is None:
            obj.shape_key_add(name='Basis')
        if 'Joy arc' not in obj.data.shape_keys.key_blocks:
            arc = obj.shape_key_add(name='Joy arc')
            cx, _, cz = bone.bone.head_local
            for v in arc.data:
                x, y, z = v.co
                t = (z-cz) / .242
                dx = .24*t
                # Rounded chevron with a steeper rise toward the center.
                root = math.sqrt(t*t + .025)
                dz = .145 - .31*(root-math.sqrt(.025))
                normal = Vector((.31*t/root, .24)).normalized()
                px = cx + dx + (x-cx)*.52*normal.x
                pz = cz + dz + (x-cx)*.52*normal.y
                surface, _, _, _ = surface_tree.ray_cast((px,-2,pz), (0,1,0))
                py = surface.y - .033 if surface is not None else -.98
                v.co = (px, py+(y+.94)*.40, pz)
            # The render harness restores bone scales before each pose.
            driver = arc.driver_add('value').driver
            variable = driver.variables.new()
            variable.name = 'depth'
            variable.targets[0].id = rig
            variable.targets[0].data_path = bone.path_from_id('scale') + '[2]'
            driver.expression = 'min(1,max(0,(depth-1)*100))'
        bone.scale.z = 1.011


def _arm(rig, side, directions):
    for segment, direction in zip(('Upper Arm.', 'Forearm.', 'Hand.'), directions):
        bpy.context.view_layer.update()
        bone = rig.pose.bones[segment + side]
        local = bone.matrix.to_quaternion().inverted() @ Vector(direction)
        bone.rotation_quaternion = Vector((0,1,0)).rotation_difference(local.normalized())
    bpy.context.view_layer.update()


def apply(name, rotate, eyes, rig, cookie):
    """Apply a food pose after the harness resets the rig to its rest pose."""
    cookie.hide_render = name in ('look', 'happy')
    if name == 'happy':
        rotate('Head', x=-5, y=5, z=3)
        rotate('Body', y=-3)
        _happy_eyes(rig)
        for side, sign in (('L', 1), ('R', -1)):
            _arm(rig, side, [(sign, -.22, .20), (.68*sign,-.40,.83),
                             (.60*sign,-.49,.65)])
        return

    # Right mitten carries the snack. Head follows its path to the lower visor.
    head, upper, fore, offset, tilt = {
        'look': ((12,-12,-16), (-.72,-.36,-.72), (-.59,-.66,-.22), (-.10,-.10,.26), -13),
        'reach': ((4,-8,-12), (-.75,-.60,-.44), (.06,-.88,.36), (.09,-.51,.24), -5),
        'eat1': ((-3,-6,-6), (-.24,-.92,.17), (.49,-.68,.65), (.22,-.55,.24), 7),
        'eat2': ((5,-8,-7), (-.32,-.92,-.18), (.37,-.77,.51), (.18,-.56,.16), -7),
    }[name]
    rotate('Head', x=head[0], y=head[1], z=head[2])
    rotate('Body', y=-3 if name == 'look' else 0)
    _arm(rig, 'R', (upper, fore, fore))
    if name in ('eat1', 'eat2'):
        _arm(rig, 'L', ((.37,-.82,-.42), (-.62,-.71,.31), (-.85,-.45,.20)))
    else:
        rotate('Upper Arm.L', y=-10 if name == 'look' else -24, x=-14)
    if name == 'eat2':
        eyes(.55)
    bpy.context.view_layer.update()
    hand = rig.pose.bones['Hand.R']
    palm = hand.matrix @ hand.bone.matrix_local.inverted() @ bpy.data.objects['Mitten.R'].location
    cookie.modifiers.clear()
    cookie.data = _cookie_mesh(name == 'eat2')
    cookie.location = palm + Vector(offset)
    cookie.rotation_euler = tuple(map(math.radians, (84, tilt, 14)))
    cookie.scale = (.43, .43, .43)
