struct ParticleDrawInfo {
    pos: vec2<f32>, // @0
    scale: f32, // @8
    reserved0: f32, // @12
    color: vec4<f32>, // @16
    reserved1: vec4<f32>, // @32
    reserved2: vec4<f32>, // @48
} // @64

struct ParticleState {
    pos: vec2<f32>, // @0
    vel: vec2<f32>, // @8
    lifetime: f32, // @12
    rand_seed: u32, // @16
    scale: f32, // @24
    reserved0: f32, // @28
} // @32

struct ParticleSystem {
    len: u32, // @0
    particles: array<ParticleState>, // @8
} // @(8 + N * 32)

@group(0) @binding(0) var<storage, read> currState: ParticleSystem;
@group(1) @binding(0) var<storage, write> drawInfo: array<ParticleDrawInfo>;

fn rand(x: u32) -> u32 {
    let a: u32 = 0x93d765ddu;

    return a * x;
}

@stage(compute)
@workgroup_size(64)
fn kGenDrawInfo(@builtin(global_invocation_id) global_id : vec3<u32>) {
    let id = global_id.x;
    if (id >= currState.len) {
        return;
    }

    let particle = currState.particles[id];
    drawInfo[id].pos = particle.pos;
    drawInfo[id].scale = particle.scale;

    var rand_state = currState.particles[id].rand_seed;
    
    let color_r: f32 = f32(rand_state & 0xFFu) / 255.0;
    rand_state = rand(rand_state);

    let color_g: f32 = f32(rand_state & 0xFFu) / 255.0;
    rand_state = rand(rand_state);

    let color_b: f32 = f32(rand_state & 0xFFu) / 255.0;
    rand_state = rand(rand_state);

    drawInfo[id].color = vec4<f32>(color_r, color_b, color_b, particle.lifetime);
}