import { Pipeline } from "./Pipeline";

export class PipelinePhysicsStep extends Pipeline {
    private bindGroup0: GPUBindGroup | null = null;
    private bindGroup1: GPUBindGroup | null = null;
    private bindGroupUniforms: GPUBindGroup | null = null;
    private nextBindGroup = 0;
    private bindLayoutState: GPUBindGroupLayout;
    private bindLayoutUniforms: GPUBindGroupLayout;

    protected constructor(args: {
        device: GPUDevice;
        queue: GPUQueue;
        pipeline: GPUComputePipeline;
        bindLayoutState: GPUBindGroupLayout;
        bindLayoutUniforms: GPUBindGroupLayout;
    }) {
        super(args.device, args.queue, args.pipeline);

        this.bindLayoutState = args.bindLayoutState;
        this.bindLayoutUniforms = args.bindLayoutUniforms;
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

        return new PipelinePhysicsStep({
            device, queue, pipeline, bindLayoutState, bindLayoutUniforms,
        });
    }

    setUniformBuffer(buffer: GPUBuffer) {
        // TODO: cache this bind group (reuse uniform buffers)
        this.bindGroupUniforms = this.device.createBindGroup({
            layout: this.bindLayoutUniforms,
            entries: [
                {
                    binding: 0,
                    resource: {
                        buffer: buffer,
                    },
                }
            ],
        });
    }

    setSystemStateBuffers(buffers: [GPUBuffer, GPUBuffer]) {
        this.bindGroup0 = this.device.createBindGroup({
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

        this.bindGroup1 = this.device.createBindGroup({
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
    }

    getBindGroup() {
        if (!this.bindGroup0 || !this.bindGroup1)
            throw new Error('No bind groups');

        if (this.nextBindGroup === 0) {
            this.nextBindGroup = 1;
            return this.bindGroup0;
        } else {
            this.nextBindGroup = 0;
            return this.bindGroup1;
        }
    }

    getCurrentBufferIndex() {
        return this.nextBindGroup;
    }

    setBindGroups(pass: GPUComputePassEncoder) {
        pass.setBindGroup(0, this.getBindGroup());
        pass.setBindGroup(1, this.bindGroupUniforms);
    }
}
