export class BufferAllocator<T extends number> {
    private bufferLists: Record<T, GPUBuffer[]> = [];
    private idxFrame = 0;
    private frameEndedPromises: Array<Promise<void>>;

    constructor(private device: GPUDevice, private maxFramesInFlight: number) {
        this.frameEndedPromises = new Array(maxFramesInFlight).map(x => Promise.resolve());
    }

    async advanceFrame(prevFrameEnded: Promise<void>): Promise<void> {
        const idxNextFrame = (this.idxFrame + 1) % this.maxFramesInFlight;
        await this.frameEndedPromises[idxNextFrame];
        this.frameEndedPromises[this.idxFrame] = prevFrameEnded;
        this.idxFrame = idxNextFrame;
    }

    getBuffer(name: T, descriptor: GPUBufferDescriptor): GPUBuffer {
        if (!(name in this.bufferLists)) {
            this.bufferLists[name] = Array.from(new Array(this.maxFramesInFlight)).map(x => this.device.createBuffer(descriptor));
        }

        return this.bufferLists[name][this.idxFrame];
    }
}
