"""Touch reactions for the original weighted mascot, in its rig's rest axes."""

import bpy
from mathutils import Matrix, Vector


def _smiling_eyes(rig, eyes):
    """Attach two curved signal strokes to the helmet for the closed-eye poses."""
    head = rig.data.bones['Head']
    head_tip = head.matrix_local @ Matrix.Translation((0, head.length, 0))
    eyes(.001)
    for side in ('L', 'R'):
        eye_name = 'Eye.' + side
        eye = rig.pose.bones[eye_name]
        # Tuck the original light behind the visor for this expression.
        eye.scale.x = .001
        eye.location.z = -.14
        name = 'Touch smile.' + side
        if bpy.data.objects.get(name):
            continue
        center = eye.bone.head_local
        curve = bpy.data.curves.new(name, 'CURVE')
        curve.dimensions = '3D'
        curve.bevel_depth = .036
        curve.bevel_resolution = 4
        curve.use_fill_caps = True
        arc = curve.splines.new('POLY')
        arc.points.add(20)
        for i, point in enumerate(arc.points):
            t = (i - 10) / 10
            point.co = (
                center.x + .182 * t, center.y - .019,
                center.z + .055 - .105 * t * t, 1,
            )
            point.radius = .18 if abs(t) == 1 else .94 - .16 * abs(t)
        stroke = bpy.data.objects.new(name, curve)
        bpy.context.scene.collection.objects.link(stroke)
        curve.materials.append(bpy.data.objects['Signal eye.' + side].data.materials[0])
        stroke.parent = rig
        stroke.parent_type = 'BONE'
        stroke.parent_bone = 'Head'
        stroke.matrix_parent_inverse = head_tip.inverted()
        # The renderer restores eye scales before every pose, including idle.
        driver = stroke.driver_add('hide_render').driver
        signal = driver.variables.new()
        signal.name = 'eye_width'
        signal.type = 'SINGLE_PROP'
        signal.targets[0].id = rig
        signal.targets[0].data_path = f'pose.bones["{eye_name}"].scale[0]'
        driver.expression = 'eye_width > 0.01'


def _shift(rig, name, offset):
    bone = rig.pose.bones[name]
    bone.location = bone.bone.matrix_local.to_3x3().inverted() @ Vector(offset)


def apply(name, rotate, eyes, rig, cookie):
    """Pose after the caller resets all pose-bone transforms."""
    cookie.hide_render = True
    if name == 'poke':
        # The raised foot and thrown-out left arm counterbalance the recoil.
        rotate('Body', x=-16, y=22, z=-8)
        rotate('Head', x=-3, y=-7, z=-12)
        rotate('Upper Arm.L', x=-24, y=-55, z=-12)
        rotate('Forearm.L', x=-37, y=-19)
        rotate('Upper Arm.R', x=-60, y=32, z=25)
        rotate('Forearm.R', x=-45, y=4)
        rotate('Leg.R', x=-44, y=25)
        rotate('Foot.R', x=-12, y=13)
        rotate('Leg.L', x=11, y=-19)
        rotate('Foot.L', x=5, y=-5)
        rig.pose.bones['Eye.L'].scale = (1.28, .99, 1)
        rotate('Eye.R', y=-52)
        rig.pose.bones['Eye.R'].scale = (.66, .74, 1)
    elif name == 'poke-recover':
        # Land in a wide stance, chin tucked and the near palm still guarding.
        rotate('Body', x=15, y=6, z=-5)
        _shift(rig, 'Leg.R', (-.09, -.02, -.025))
        _shift(rig, 'Leg.L', (.09, 0, .14))
        _shift(rig, 'Head', (.02, .03, -.09))
        rotate('Head', x=-4, y=-17, z=14)
        rotate('Upper Arm.R', x=-18, y=24, z=10)
        rotate('Forearm.R', x=-30, y=14)
        rotate('Upper Arm.L', x=-52, y=-12)
        rotate('Forearm.L', x=-54, y=10)
        rotate('Leg.L', x=-32, y=-30)
        rotate('Leg.R', x=-46, y=27)
        # Keep the outsoles level as the legs splay for the landing.
        bpy.context.view_layer.update()
        for side in ('R', 'L'):
            foot = rig.pose.bones['Foot.' + side]
            parent = foot.parent
            leg_turn = parent.matrix.to_quaternion() @ parent.bone.matrix_local.to_quaternion().inverted()
            rest = foot.bone.matrix_local.to_quaternion()
            foot.rotation_quaternion = rest.inverted() @ leg_turn.inverted() @ rest
        rotate('Eye.R', y=-14)
        rig.pose.bones['Eye.R'].scale = (1, .44, 1)
        rig.pose.bones['Eye.L'].scale = (1.05, .84, 1)
    elif name in ('pet', 'pet-nuzzle'):
        snug = name == 'pet-nuzzle'
        rotate('Body', x=2 if snug else 0, y=-12 if snug else -4, z=15)
        rotate('Head', x=-4 if snug else -7, y=-22 if snug else -12, z=-6)
        if snug:
            _shift(rig, 'Upper Arm.R', (0, -.25, -.03))
            _shift(rig, 'Head', (0, .12, .02))
        rotate('Upper Arm.R', x=-70, y=6, z=34)
        rotate('Forearm.R', x=-64 if snug else -51, y=-7, z=11)
        rotate('Upper Arm.L', x=-53 if snug else -27, y=16 if snug else 0)
        rotate('Forearm.L', x=-44 if snug else -34, y=31, z=-14)
        rotate('Leg.L', x=23 if snug else 2, y=-12 if snug else 3)
        rotate('Foot.L', x=9 if snug else -4)
        rotate('Leg.R', x=-8 if snug else -2, y=10 if snug else 4)
        rotate('Foot.R', y=7 if snug else 3)
        _smiling_eyes(rig, eyes)
    else:
        raise ValueError(f'Unknown touch pose {name!r}')
