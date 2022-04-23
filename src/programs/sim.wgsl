struct ParticleState {
    pos: vec2<f32>, // @0
    vel: vec2<f32>, // @8
    lifetime: f32, // @16
    rand_seed: u32, // @20
    scale: f32, // @24
    reserved0: f32, // @28
} // @32

struct ParticleSystem {
    len: u32, // @0
    particles: array<ParticleState>, // @8
} // @(8 + N * 32)

struct Uniforms {
    timeStep: f32, // @0
} // @4

let LIFETIME_SPEED = 0.25;
let SCALE_GROW_SPEED = 1.00;

@group(0) @binding(0) var<storage, read> currState: ParticleSystem;
@group(0) @binding(1) var<storage, write> nextState: ParticleSystem;

@group(1) @binding(0) var<uniform> uniforms: Uniforms;

fn rand(x: u32) -> u32 {
    let a: u32 = 0x93d765ddu;

    return a * x;
}

@stage(compute)
@workgroup_size(64)
fn kPhysicsStep(@builtin(global_invocation_id) global_id : vec3<u32>) {
    let id = global_id.x;
    if (id >= currState.len) {
        return;
    }

    let particle = currState.particles[id];
    let nextVel = particle.vel + uniforms.timeStep * vec2<f32>(0.0, -10.0);
    let nextPos = particle.pos + uniforms.timeStep * nextVel;
    let nextLifetime = max(0.0, particle.lifetime - uniforms.timeStep * LIFETIME_SPEED);

    var nextRandSeed = rand(currState.particles[id].rand_seed);
    let scaleGrowDir = nextRandSeed & 1u;

    nextState.particles[id].scale =
    particle.scale
    + f32(scaleGrowDir) * uniforms.timeStep * SCALE_GROW_SPEED
    - f32((~scaleGrowDir) & 1u) * uniforms.timeStep * SCALE_GROW_SPEED;

    nextState.particles[id].pos = nextPos;
    nextState.particles[id].vel = nextVel;
    nextState.particles[id].lifetime = nextLifetime;
    nextState.particles[id].rand_seed = nextRandSeed;
}