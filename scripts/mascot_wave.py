"""Greeting poses for the original hoodie mascot rig."""

# Shoulder, elbow, wrist and sleeve extension for each beat. The mascot's
# right arm waves into clear space on the opposite side from its backpack fin.
_ARM = {
    'wave-up': (53, 34, 10, 1.14),
    'wave1': (82, 38, 16, 1.48),
    'wave2': (98, 18, -12, 1.50),
    'wave-down': (28, 22, 6, 1.06),
}

# Side-to-side torso roll, head tilt and free-knee bend, in degrees.
_WEIGHT = {
    'wave-up': (4, 3, 5),
    'wave1': (8, 20, 13),
    'wave2': (-12, 19, 7),
    'wave-down': (2, -1, 3),
}


def apply(name, rotate, eyes, rig, cookie):
    if name != 'wave-mid':
        return _apply_beat(name, rotate, eyes, rig, cookie)

    _apply_beat('wave1', rotate, eyes, rig, cookie)
    start = {bone.name: (bone.rotation_quaternion.copy(), bone.scale.copy())
             for bone in rig.pose.bones}
    _apply_beat('wave2', rotate, eyes, rig, cookie)
    for bone in rig.pose.bones:
        rotation, scale = start[bone.name]
        bone.rotation_quaternion = rotation.slerp(bone.rotation_quaternion, 0.5)
        bone.scale = scale.lerp(bone.scale, 0.5)


def _apply_beat(name, rotate, eyes, rig, cookie):
    shoulder, elbow, wrist, reach = _ARM[name]
    lean, tilt, knee = _WEIGHT[name]
    cookie.hide_render = True
    rotate('Body', y=lean)
    rotate('Head', x=2, y=tilt, z=-3)

    rotate('Upper Arm.R', x=-8, y=shoulder, z=10)
    rotate('Forearm.R', y=elbow, z=7)
    rotate('Hand.R', x=-15, y=wrist, z=18)
    rig.pose.bones['Upper Arm.R'].scale = (reach,) * 3
    rig.pose.bones['Hand.R'].scale = (1.08 / reach,) * 3

    rotate('Upper Arm.L', x=-7, y=-14)
    rotate('Leg.L', y=-lean)
    rotate('Leg.R', x=knee, y=-lean + knee / 2)
    rotate('Foot.R', x=-knee / 2, z=-4)
    eyes(.90 if name == 'wave1' else 1)
