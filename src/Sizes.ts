export const LEN_PARTICLE = 4 * 2;
export const SIZ_PARTICLE = LEN_PARTICLE * 4;

const LEN_HEADER = 2;
const SIZ_HEADER = LEN_HEADER * 4;

export const LEN_DRAWINFO = 2 + 1 + 1 + 4 + 4 + 4;
export const SIZ_DRAWINFO = 4 * LEN_DRAWINFO;

export function computeParticleSystemSize(numParticles: number) {
    return SIZ_HEADER + numParticles * SIZ_PARTICLE;
}

export function offsetOfParticle(idxParticle: number) {
    return SIZ_HEADER + idxParticle * SIZ_PARTICLE;

}