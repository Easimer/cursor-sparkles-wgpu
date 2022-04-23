export class BufferAllocator {
    // TODO: replace string IDs with enums
    private bufferLists: Record<string, GPUBuffer[]> = {};
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

    getBuffer(name: string, descriptor: GPUBufferDescriptor): GPUBuffer {
        if (!(name in this.bufferLists)) {
            this.bufferLists[name] = Array.from(new Array(this.maxFramesInFlight)).map(x => this.device.createBuffer(descriptor));

            console.log(this.bufferLists);
        }

        return this.bufferLists[name][this.idxFrame];
    }
}
