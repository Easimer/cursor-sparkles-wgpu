export class QuadMesh {
    protected constructor(private bufPos: GPUBuffer, private bufIdx: GPUBuffer) {
    }

    setBuffers(pass: GPURenderPassEncoder) {
        pass.setVertexBuffer(0, this.bufPos);
        pass.setIndexBuffer(this.bufIdx, 'uint16');
    }

    static async make(device: GPUDevice, queue: GPUQueue): Promise<QuadMesh> {
        const createBufferWithStaging = async (arrBuffer: Float32Array | Uint16Array, usage: number) => {
            const sizBuf = (arrBuffer.byteLength + 3) & ~3;
            const bufBuffer = device.createBuffer({
                usage: usage | GPUBufferUsage.COPY_DST,
                size: sizBuf,
            });
            queue.writeBuffer(bufBuffer, 0, arrBuffer, 0, arrBuffer.length);
            await queue.onSubmittedWorkDone();
            return bufBuffer;
        };

        const arrPos = new Float32Array([
            -0.5, -0.5,
            -0.5, +0.5,
            +0.5, -0.5,
            +0.5, +0.5,
        ]);
        const arrIdx = new Uint16Array([0, 1, 2, 2, 1, 3]);
        const bufPosFuture = createBufferWithStaging(arrPos, GPUBufferUsage.VERTEX);
        const bufIdxFuture = createBufferWithStaging(arrIdx, GPUBufferUsage.INDEX);

        const [bufPos, bufIdx] = await Promise.all([bufPosFuture, bufIdxFuture]);
        return new QuadMesh(bufPos, bufIdx);
    }
}