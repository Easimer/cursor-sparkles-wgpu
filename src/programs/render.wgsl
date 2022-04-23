struct VSOut {
    @builtin(position) Position: vec4<f32>,
    
    @location(0) color: vec4<f32>,
}

struct ParticleDrawInfo {
    pos: vec2<f32>, // @0
    scale: f32, // @8
    reserved0: f32, // @12
    color: vec4<f32>, // @16
    reserved1: vec4<f32>, // @32
    reserved2: vec4<f32>, // @48
} // @64

struct Uniforms {
    matTransform: mat3x3<f32>, // @0
} // @48

@group(0) @binding(0) var<storage, read> particleDrawInfo : array<ParticleDrawInfo>;
@group(0) @binding(1) var<uniform> uniforms : Uniforms;

@stage(vertex)
fn kVertex(
    @location(0) inPos: vec2<f32>,
    @builtin(instance_index) instanceID: u32) -> VSOut {
    var vsOut: VSOut;
    let drawInfo = particleDrawInfo[instanceID];
    let posWorld = vec3<f32>(drawInfo.pos, 1.0);
    let posNDC = uniforms.matTransform * (posWorld + vec3<f32>(drawInfo.scale * 2.0 * inPos, 0.0));
    vsOut.Position = vec4<f32>(posNDC.xy, 0.0, 1.0);
    vsOut.color = drawInfo.color;
    return vsOut;
}

@stage(fragment)
fn kFragment(
    @location(0) color: vec4<f32>,
) -> @location(0) vec4<f32> {
    return color;
    //return vec4<f32>(matTransform[0][0], matTransform[1][1], matTransform[2][0], 1.0);
}