import { Pipeline } from "./Pipeline";

export class PipelinePhysicsStep extends Pipeline {
    private bindGroups: GPUBindGroup[] = [];
    private nextFrameIndex = 0;
    private bindLayoutState: GPUBindGroupLayout;

    private uniformBindGroups: GPUBindGroup[];
    private uniformBuffers: GPUBuffer[];
    private uniformStagingBuffers: GPUBuffer[];

    protected constructor(args: {
        device: GPUDevice;
        queue: GPUQueue;
        pipeline: GPUComputePipeline;
        bindLayoutState: GPUBindGroupLayout;
        uniformBindGroups: GPUBindGroup[];
        uniformBuffers: GPUBuffer[];
        uniformStagingBuffers: GPUBuffer[];
    }) {
        super(args.device, args.queue, args.pipeline);

        this.bindLayoutState = args.bindLayoutState;
        this.uniformBindGroups = args.uniformBindGroups;
        this.uniformBuffers = args.uniformBuffers;
        this.uniformStagingBuffers = args.uniformStagingBuffers;
    }

    static async make(device: GPUDevice, queue: GPUQueue, module: GPUShaderModule) {
        const bindLayoutState = device.createBindGroupLayout({
            entries: [
                {
                    binding: 0,
                    visibility: GPUShaderStage.COMPUTE,
                    buffer: {
                        type: 'read-only-storage',
                    },
                },
                {
                    binding: 1,
                    visibility: GPUShaderStage.COMPUTE,
                    buffer: {
                        type: 'storage',
                    },
                },
            ]
        });

        const bindLayoutUniforms = device.createBindGroupLayout({
            entries: [
                {
                    binding: 0,
                    visibility: GPUShaderStage.COMPUTE,
                    buffer: {
                        type: 'uniform',
                    },
                },
            ]
        });

        const pipeline = await device.createComputePipelineAsync({
            compute: {
                module,
                entryPoint: 'kPhysicsStep',
            },
            layout: device.createPipelineLayout({
                bindGroupLayouts: [bindLayoutState, bindLayoutUniforms],
            }),
        });

        const uniformBuffers = [0, 0].map(() => device.createBuffer({
            size: 4,
            usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.UNIFORM,
        }));

        const uniformStagingBuffers = [0, 0].map(() => device.createBuffer({
            size: 4,
            usage: GPUBufferUsage.COPY_SRC | GPUBufferUsage.MAP_WRITE,
        }));

        const uniformBindGroups = [0, 0].map((_, i) =>
            device.createBindGroup({
                layout: bindLayoutUniforms,
                entries: [
                    {
                        binding: 0,
                        resource: {
                            buffer: uniformBuffers[i],
                        },
                    }
                ],
            }));

        return new PipelinePhysicsStep({
            device, queue, pipeline, bindLayoutState, uniformBuffers, uniformStagingBuffers, uniformBindGroups,
        });
    }

    setSystemStateBuffers(buffers: [GPUBuffer, GPUBuffer]) {
        const bindGroup0 = this.device.createBindGroup({
            layout: this.bindLayoutState,
            entries: [
                {
                    binding: 0,
                    resource: {
                        buffer: buffers[0]
                    }
                },
                {
                    binding: 1,
                    resource: {
                        buffer: buffers[1]
                    }
                },
            ]
        });

        const bindGroup1 = this.device.createBindGroup({
            layout: this.bindLayoutState,
            entries: [
                {
                    binding: 0,
                    resource: {
                        buffer: buffers[1]
                    }
                },
                {
                    binding: 1,
                    resource: {
                        buffer: buffers[0]
                    }
                },
            ]
        });

        this.bindGroups = [bindGroup0, bindGroup1];
    }

    getCurrentBufferIndex() {
        return this.nextFrameIndex;
    }

    setBindGroups(pass: GPUComputePassEncoder) {
        if (this.bindGroups.length < 2)
            throw new Error('State bind groups missing');

        const idxFrame = this.nextFrameIndex;
        pass.setBindGroup(0, this.bindGroups[idxFrame]);
        pass.setBindGroup(1, this.uniformBindGroups[idxFrame]);
    }

    getUniformStagingBuffer(): GPUBuffer {
        return this.uniformStagingBuffers[this.nextFrameIndex];
    }

    commitUniformBuffer(encoder: GPUCommandEncoder) {
        const i = this.nextFrameIndex;
        encoder.copyBufferToBuffer(this.uniformStagingBuffers[i], 0, this.uniformBuffers[i], 0, 4);
    }

    advanceFrame() {
        const idxFrame = this.nextFrameIndex;
        const idxNextFrame = idxFrame === 0 ? 1 : 0;
        this.nextFrameIndex = idxNextFrame;
    }
}
