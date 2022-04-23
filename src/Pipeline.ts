export abstract class Pipeline {
    protected constructor(
        protected device: GPUDevice,
        private queue: GPUQueue,
        private pipeline: GPUComputePipeline) {
    }

    dispatch(encoder: GPUCommandEncoder, x: number) {
        const computePass = encoder.beginComputePass();
        computePass.setPipeline(this.pipeline);
        this.setBindGroups(computePass);
        computePass.dispatch(x);
        computePass.end();
    }

    abstract setBindGroups(pass: GPUComputePassEncoder): void;
}