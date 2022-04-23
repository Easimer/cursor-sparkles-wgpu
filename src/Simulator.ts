import * as programSimulation from './programs/sim.wgsl';
import * as programGenDrawInfo from './programs/gendrawinfo.wgsl';
import { PipelinePhysicsStep } from './PipelinePhysicsStep';
import { PipelineGenerateDrawInfo } from './PipelineGenerateDrawInfo';
import { BufferAllocator } from './BufferAllocator';
import { SIZ_PARTICLE, LEN_PARTICLE, computeParticleSystemSize, offsetOfParticle, SIZ_DRAWINFO } from './Sizes';

export class Simulator {
    private idxNextParticle = 0;
    private prevFrameFinished = Promise.resolve();
    private idxStep = 0;

    private particleCreationQueue: Array<Float32Array> = [];

    protected constructor(
        private device: GPUDevice,
        private queue: GPUQueue,
        private pipelinePhysicsStep: PipelinePhysicsStep,
        private pipelineGenDrawInfo: PipelineGenerateDrawInfo,
        private numMaxParticles: number,
        private buffers: [GPUBuffer, GPUBuffer],
        private bufferAllocator: BufferAllocator) {
    }

    private async addQueuedParticles() {
        if (this.particleCreationQueue.length === 0)
            return;

        await this.queue.onSubmittedWorkDone();

        const idxStateBuffer = this.pipelinePhysicsStep.getCurrentBufferIndex();
        const bufState = this.buffers[idxStateBuffer];

        const encoder = this.device.createCommandEncoder();
        const stagingBuffers: GPUBuffer[] = [];

        while (this.particleCreationQueue.length > 0) {
            const numRemains = this.particleCreationQueue.length;
            const numCanFit = this.numMaxParticles - this.idxNextParticle;
            const numToFit = numRemains < numCanFit ? numRemains : numCanFit;
            const nextNextParticleIndex = (this.idxNextParticle + numToFit) % this.numMaxParticles;

            const bufStaging = this.device.createBuffer({
                size: numToFit * SIZ_PARTICLE,
                usage: GPUBufferUsage.COPY_SRC | GPUBufferUsage.MAP_WRITE,
                mappedAtCreation: true,
            });

            const arrRawParticles = bufStaging.getMappedRange();
            const arrParticles = new Float32Array(arrRawParticles);

            for (let i = 0; i < numToFit; i++) {
                const arrParticle = this.particleCreationQueue.pop();
                if (arrParticle === undefined) throw 'never';
                arrParticles.set(arrParticle, i * LEN_PARTICLE);
            }

            bufStaging.unmap();
            stagingBuffers.push(bufStaging);

            encoder.copyBufferToBuffer(bufStaging, 0, bufState, offsetOfParticle(this.idxNextParticle), numToFit * SIZ_PARTICLE);
            this.idxNextParticle = nextNextParticleIndex;
        }

        this.queue.submit([encoder.finish()]);
        stagingBuffers.forEach(buf => buf.destroy());
        //this.queue.onSubmittedWorkDone().then(() => {
        //    stagingBuffers.forEach(buf => buf.destroy());
        //});
    }

    async addParticle(px: number, py: number, vx: number, vy: number) {
        const randSeed = Math.random();
        this.particleCreationQueue.push(new Float32Array([px, py, vx, vy, 1.0, randSeed, 0.5]));
    }

    async step(timeStep: number) {
        const idxCurrentStep = this.idxStep;
        this.idxStep++;
        await this.prevFrameFinished;

        this.prevFrameFinished = new Promise<void>((async (resolve) => {
            await this.addQueuedParticles();
            const encoder = this.device.createCommandEncoder();

            const bufUniformsStaging = this.bufferAllocator.getBuffer('uniformsStaging', {
                size: 4,
                usage: GPUBufferUsage.COPY_SRC | GPUBufferUsage.MAP_WRITE,
            });

            const bufUniforms = this.bufferAllocator.getBuffer('uniforms', {
                size: 4,
                usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.UNIFORM,
            });

            await bufUniformsStaging.mapAsync(GPUMapMode.WRITE);
            const arrUniforms = new Float32Array(bufUniformsStaging.getMappedRange());
            arrUniforms[0] = timeStep;
            bufUniformsStaging.unmap();

            encoder.copyBufferToBuffer(bufUniformsStaging, 0, bufUniforms, 0, 4);

            this.pipelinePhysicsStep.setUniformBuffer(bufUniforms);

            this.pipelinePhysicsStep.dispatch(encoder, this.numMaxParticles);
            const buffer = encoder.finish();
            this.queue.submit([buffer]);

            resolve();
        }));

        return this.prevFrameFinished;
    }

    async getDrawInfo() {
        const encoder = this.device.createCommandEncoder();
        const bufDrawInfo = this.bufferAllocator.getBuffer('drawInfo', {
            size: this.numMaxParticles * SIZ_DRAWINFO,
            usage: GPUBufferUsage.STORAGE,
        });
        this.pipelineGenDrawInfo.setBuffers(this.buffers[this.pipelinePhysicsStep.getCurrentBufferIndex()], bufDrawInfo);

        this.pipelineGenDrawInfo.dispatch(encoder, this.numMaxParticles);
        const buffer = encoder.finish();
        this.queue.submit([buffer]);
        return bufDrawInfo;
    }

    async inspectState() {
        const sizBuffer = computeParticleSystemSize(this.numMaxParticles);
        const staging0 = this.device.createBuffer({
            usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
            size: sizBuffer,
        });

        const encoder0 = this.device.createCommandEncoder();
        encoder0.copyBufferToBuffer(this.buffers[this.pipelinePhysicsStep.getCurrentBufferIndex()], 0, staging0, 0, sizBuffer);
        const cmdBuf0 = encoder0.finish();

        this.queue.submit([cmdBuf0]);
        await this.queue.onSubmittedWorkDone();

        await staging0.mapAsync(GPUMapMode.READ);
        const ret0 = new Float32Array(new Float32Array(staging0.getMappedRange(0, sizBuffer)));
        staging0.unmap();
        staging0.destroy();

        return [ret0];
    }

    static async make(device: GPUDevice, queue: GPUQueue, numMaxParticles: number, bufferAllocator: BufferAllocator) {
        const module = device.createShaderModule({
            code: programSimulation,
        });
        const pipelinePhysicsStep = await PipelinePhysicsStep.make(device, queue, module);


        const lenBuffer = computeParticleSystemSize(numMaxParticles);
        const buffer0 = device.createBuffer({
            size: lenBuffer,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC,
        });

        const buffer1 = device.createBuffer({
            size: lenBuffer,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC,
        });

        // Initialize the state buffer headers
        const bufferInit = new Int32Array([numMaxParticles]);
        queue.writeBuffer(buffer0, 0, bufferInit);
        queue.writeBuffer(buffer1, 0, bufferInit);

        pipelinePhysicsStep.setSystemStateBuffers([buffer0, buffer1]);

        const moduleGen = device.createShaderModule({
            code: programGenDrawInfo,
        });
        const pipelineGenDrawInfo = await PipelineGenerateDrawInfo.make(device, queue, moduleGen);

        return new Simulator(device, queue, pipelinePhysicsStep, pipelineGenDrawInfo, numMaxParticles, [buffer0, buffer1], bufferAllocator);
    }
}
