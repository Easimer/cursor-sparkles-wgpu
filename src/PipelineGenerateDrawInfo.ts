import { Pipeline } from './Pipeline';

export class PipelineGenerateDrawInfo extends Pipeline {
    private bindLayoutInput: GPUBindGroupLayout;
    private bindLayoutOutput: GPUBindGroupLayout;

    private bindGroupsInput: GPUBindGroup[] = [];
    private bindGroupOutput: GPUBindGroup | null = null;

    private nextFrameIndex = 0;

    constructor(args: {
        device: GPUDevice,
        queue: GPUQueue,
        pipeline: GPUComputePipeline,
        bindLayoutInput: GPUBindGroupLayout,
        bindLayoutOutput: GPUBindGroupLayout,
    }) {
        super(args.device, args.queue, args.pipeline);
        this.bindLayoutInput = args.bindLayoutInput;
        this.bindLayoutOutput = args.bindLayoutOutput;
    }

    static async make(device: GPUDevice, queue: GPUQueue, module: GPUShaderModule) {
        const bindLayoutInput = device.createBindGroupLayout({
            entries: [
                {
                    binding: 0,
                    visibility: GPUShaderStage.COMPUTE,
                    buffer: {
                        type: 'read-only-storage',
                    },
                },
            ]
        });
        const bindLayoutOutput = device.createBindGroupLayout({
            entries: [
                {
                    binding: 0,
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
                bindGroupLayouts: [bindLayoutInput, bindLayoutOutput],
            }),
        });

        return new PipelineGenerateDrawInfo({
            device, queue, pipeline, bindLayoutInput, bindLayoutOutput,
        });
    }

    setBindGroups(pass: GPUComputePassEncoder): void {
        if (!this.bindGroupOutput) throw new Error('Output bind group doesn\'t exist');
        if (this.bindGroupsInput.length < 2) throw new Error('Input bind groups don\'t exist');

        pass.setBindGroup(0, this.bindGroupsInput[this.nextFrameIndex]);
        pass.setBindGroup(1, this.bindGroupOutput);
    }

    setSystemStateBuffers(buffers: [GPUBuffer, GPUBuffer]) {
        const bindGroup0 = this.device.createBindGroup({
            layout: this.bindLayoutInput,
            entries: [
                {
                    binding: 0,
                    resource: {
                        buffer: buffers[0]
                    }
                },
            ]
        });
        const bindGroup1 = this.device.createBindGroup({
            layout: this.bindLayoutInput,
            entries: [
                {
                    binding: 0,
                    resource: {
                        buffer: buffers[1]
                    }
                },
            ]
        });
        this.bindGroupsInput = [bindGroup0, bindGroup1];
    }

    setBuffers(bufferDrawInfo: GPUBuffer) {
        this.bindGroupOutput = this.device.createBindGroup({
            layout: this.bindLayoutOutput,
            entries: [
                {
                    binding: 0,
                    resource: {
                        buffer: bufferDrawInfo
                    }
                },
            ]
        });
    }

    advanceFrame() {
        const idxFrame = this.nextFrameIndex;
        const idxNextFrame = idxFrame === 0 ? 1 : 0;
        this.nextFrameIndex = idxNextFrame;
    }
}
