/// <reference types="@webgpu/types" />

import { Renderer } from './Renderer';
import { BufferAllocator } from './BufferAllocator';
import { Simulator } from './Simulator';

async function main() {
    const gpu = navigator.gpu;

    if (!gpu) {
        throw new Error('WebGPU is unsupported');
    }

    const adapter = await gpu.requestAdapter();
    if (!adapter) {
        throw new Error('No WebGPU adapter');
    }

    const device = await adapter.requestDevice({
    });
    const queue = device.queue;

    const bufferAllocator = new BufferAllocator(device, 2);

    const NUM_PARTICLES = 8192;
    const simulator = await Simulator.make(device, queue, NUM_PARTICLES, bufferAllocator);

    const elemCanvas = document.createElement('canvas');
    elemCanvas.style.width = '100vw';
    elemCanvas.style.height = '100vh';
    elemCanvas.style.pointerEvents = 'none';
    elemCanvas.style.position = 'absolute';
    elemCanvas.style.top = elemCanvas.style.left = '0';
    document.body.appendChild(elemCanvas);

    const renderer = await Renderer.make(device, elemCanvas, queue, bufferAllocator);

    const ro = new ResizeObserver(entries => {
        if (entries.length < 0) return;
        const ent = entries[0];
        elemCanvas.width = ent.contentRect.width;
        elemCanvas.height = ent.contentRect.height;

        renderer.canvasResized();
    });

    ro.observe(elemCanvas);

    const handler = (() => {
        let prevMousePos: [number, number] | null = null;
        return function handleMouseMove(ev: MouseEvent) {
            if (prevMousePos === null) {
                prevMousePos = [ev.clientX, -ev.clientY];
            }

            const dx = ev.clientX - prevMousePos[0];
            const dy = -ev.clientY - prevMousePos[1];
            simulator.addParticle(ev.clientX, -ev.clientY, 8 * dx, 8 * dy);
            prevMousePos = [ev.clientX, -ev.clientY];
        };
    })();

    document.addEventListener('mousemove', handler);

    let prevTime: number | null = null;

    async function step(time: number) {
        if (!prevTime) {
            prevTime = time;
            requestAnimationFrame(step);
            return;
        }

        const delta = (time - prevTime) / 1000.0;
        await simulator.step(delta);
        const drawInfo = await simulator.getDrawInfo();
        await renderer.step(NUM_PARTICLES, drawInfo);
        bufferAllocator.advanceFrame(queue.onSubmittedWorkDone());
        requestAnimationFrame(step);

        prevTime = time;
    }

    requestAnimationFrame(step);
}

main();