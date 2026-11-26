"""Grounded inhale pose for the shared Blender renderer."""
import bpy
from mathutils import Vector


def apply(name, rotate, eyes, rig, cookie):
    """Apply after the renderer's idle pose, or after a neutral bone reset."""
    if name != 'idle-inhale':
        raise ValueError(f'Unknown breathing pose {name!r}')
    cookie.hide_render = True
    rotate('Head', z=-3)
    bpy.context.view_layer.update()
    planted = {name: rig.pose.bones[name].matrix.copy()
               for name in ('Leg.L', 'Leg.R', 'Foot.L', 'Foot.R')}
    head = rig.pose.bones['Head']
    head_matrix = head.matrix.copy()

    # Local Y follows the upright torso. Expand the chest gently without
    # rotating the pelvis or moving the rig root away from its idle position.
    body = rig.pose.bones['Body']
    body.scale = (1.025, 1.04, 1.035)
    body.location = body.bone.matrix_local.to_3x3().inverted() @ Vector((0, 0, .008))
    rotate('Upper Arm.L', x=1, y=-8, z=2)
    rotate('Upper Arm.R', x=3, y=5, z=-2)
    eyes(1)
    bpy.context.view_layer.update()

    # Keep the helmet rigid and raise it just 0.05 scene units. Disabling
    # inherited scale also prevents torso expansion from enlarging the boots.
    head.bone.inherit_scale = 'NONE'
    for side in ('L', 'R'):
        rig.pose.bones['Leg.' + side].bone.inherit_scale = 'NONE'
    bpy.context.view_layer.update()
    head_matrix.translation += Vector((0, 0, .05))
    head.matrix = head_matrix
    for name, matrix in planted.items():
        rig.pose.bones[name].matrix = matrix
        bpy.context.view_layer.update()

    drift = max(abs(rig.pose.bones[name].matrix[i][j] - matrix[i][j])
                for name, matrix in planted.items()
                for i in range(4) for j in range(4))
    if drift > 1e-5:
        raise RuntimeError(f'Planted leg/foot transform drifted by {drift:.8f}')
    print(f'INHALE planted-transform drift={drift:.8f}; head rise=0.050', flush=True)
