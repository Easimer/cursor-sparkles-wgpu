import { Pipeline } from './Pipeline';

export class PipelineGenerateDrawInfo extends Pipeline {
    private bindGroup0: GPUBindGroup | null = null;
    private bindLayout: GPUBindGroupLayout;

    constructor(args: {
        device: GPUDevice,
        queue: GPUQueue,
        pipeline: GPUComputePipeline,
        bindLayout: GPUBindGroupLayout,
    }) {
        super(args.device, args.queue, args.pipeline);
        this.bindLayout = args.bindLayout;
    }

    static async make(device: GPUDevice, queue: GPUQueue, module: GPUShaderModule) {
        const bindLayout = device.createBindGroupLayout({
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

        const pipeline = await device.createComputePipelineAsync({
            compute: {
                module,
                entryPoint: 'kGenDrawInfo',
            },
            layout: device.createPipelineLayout({
                bindGroupLayouts: [bindLayout],
            }),
        });

        return new PipelineGenerateDrawInfo({
            device, queue, pipeline, bindLayout,
        });
    }

    setBindGroups(pass: GPUComputePassEncoder): void {
        pass.setBindGroup(0, this.bindGroup0);
    }

    setBuffers(bufferState: GPUBuffer, bufferDrawInfo: GPUBuffer) {
        // TODO: try breaking this bind group up and cache the first one
        this.bindGroup0 = this.device.createBindGroup({
            layout: this.bindLayout,
            entries: [
                {
                    binding: 0,
                    resource: {
                        buffer: bufferState
                    }
                },
                {
                    binding: 1,
                    resource: {
                        buffer: bufferDrawInfo
                    }
                },
            ]
        });
    }
}
