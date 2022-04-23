import { BufferAllocator } from './BufferAllocator';
import * as shaders from './programs/render.wgsl';
import { QuadMesh } from './QuadMesh';

export class Renderer {
    private ctx: GPUCanvasContext;

    constructor(
        private device: GPUDevice,
        private queue: GPUQueue,
        private pipeline: GPURenderPipeline,
        private canvas: HTMLCanvasElement,
        private quad: QuadMesh,
        private bufferAllocator: BufferAllocator) {
        this.canvasResized();
    }

    canvasResized() {
        const canvasCfg: GPUCanvasConfiguration = {
            device: this.device,
            format: 'bgra8unorm',
            usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.COPY_SRC,
            compositingAlphaMode: 'premultiplied',
        };
        const ctx = this.canvas.getContext('webgpu');
        if (!ctx) {
            throw new Error('Couldn\'t get canvas ctx');
        }
        this.ctx = ctx;
        this.ctx.configure(canvasCfg);
    }

    async step(numParticles: number, particleDrawInfo: GPUBuffer) {
        const framebufferTexture = this.ctx.getCurrentTexture();
        const framebufferTextureView = framebufferTexture.createView();

        // TODO: can we reuse the same command encoder?
        const encoder = this.device.createCommandEncoder();

        const pass = encoder.beginRenderPass({
            colorAttachments: [{
                view: framebufferTextureView,
                loadOp: 'clear',
                storeOp: 'store',
            }],
        });

        const bufUniforms = this.bufferAllocator.getBuffer('renderUniforms', {
            size: 64,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
        });

        // TODO: cache these reciprocals
        const scaleX = 2 / this.canvas.width;
        const scaleY = 2 / this.canvas.height;
        const arrUniforms = new Float32Array([
            scaleX, 0, 0, 0,
            0, scaleY, 0, 0,
            -1, 1, 1, 0,
        ]);
        this.queue.writeBuffer(bufUniforms, 0, arrUniforms);

        const bindGroup0 = this.device.createBindGroup({
            layout: this.pipeline.getBindGroupLayout(0),
            entries: [
                {
                    binding: 0,
                    resource: {
                        buffer: particleDrawInfo,
                    }
                },
                {
                    binding: 1,
                    resource: {
                        buffer: bufUniforms,
                    }
                }
            ],
        });

        pass.setPipeline(this.pipeline);
        pass.setBindGroup(0, bindGroup0);
        this.quad.setBuffers(pass);
        pass.drawIndexed(6, numParticles);

        pass.end();
        const cmdbuf = encoder.finish();

        this.queue.submit([cmdbuf]);
    }

    static async make(
        device: GPUDevice,
        canvas: HTMLCanvasElement,
        queue: GPUQueue,
        bufferAllocator: BufferAllocator
    ): Promise<Renderer> {
        console.debug('Renderer::make', 'Configuring canvas');

        console.debug('Renderer::make', 'Creating shader module');
        const modShader = device.createShaderModule({
            code: shaders,
        });

        console.debug('Renderer::make', 'Creating bind group layout');
        const bindGroupLayout = device.createBindGroupLayout({
            entries: [
                {
                    binding: 0,
                    buffer: {
                        type: 'read-only-storage'
                    },
                    visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
                },
                {
                    binding: 1,
                    buffer: {
                        type: 'uniform'
                    },
                    visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
                }
            ]
        });

        console.debug('Renderer::make', 'Creating pipeline layout');
        const layout = device.createPipelineLayout({
            bindGroupLayouts: [bindGroupLayout]
        });

        console.debug('Renderer::make', 'Creating pipeline');
        const pipeline = await device.createRenderPipelineAsync({
            vertex: {
                module: modShader,
                entryPoint: 'kVertex',
                buffers: [
                    {
                        stepMode: 'vertex',
                        arrayStride: 4 * 2,
                        attributes: [
                            {
                                shaderLocation: 0,
                                offset: 0,
                                format: 'float32x2',
                            }
                        ]
                    }
                ]
            },
            fragment: {
                module: modShader,
                entryPoint: 'kFragment',
                targets: [{
                    format: 'bgra8unorm',
                    blend: {
                        color: {
                            operation: 'add',
                            srcFactor: 'src-alpha',
                            dstFactor: 'one-minus-src-alpha'
                        },
                        alpha: {
                            operation: 'add',
                            srcFactor: 'one',
                            dstFactor: 'zero'
                        }
                    }
                }],
            },
            primitive: {
                frontFace: 'ccw',
                cullMode: 'none',
                topology: 'triangle-list',
            },
            layout,
        });

        console.debug('Renderer::make', 'Done');
        return new Renderer(device, queue, pipeline, canvas, await QuadMesh.make(device, queue), bufferAllocator);
    }
}
