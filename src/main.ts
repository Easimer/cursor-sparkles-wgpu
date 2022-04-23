/// <reference types="@webgpu/types" />

import { Renderer } from './Renderer';
import { BufferAllocator } from './BufferAllocator';
import { Simulator } from './Simulator';

export async function start(opts?: {
    canvas?: HTMLCanvasElement;
    numMaxParticles?: number;
}) {
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

    const numMaxParticles = opts?.numMaxParticles || 1024;
    const simulator = await Simulator.make(device, queue, numMaxParticles, bufferAllocator);

    let renderer: Renderer;

    let elemCanvas = opts?.canvas;
    if (!elemCanvas) {
        elemCanvas = document.createElement('canvas');
        elemCanvas.style.width = '100vw';
        elemCanvas.style.height = '100vh';
        elemCanvas.style.pointerEvents = 'none';
        elemCanvas.style.position = 'absolute';
        elemCanvas.style.top = elemCanvas.style.left = '0';
        document.body.appendChild(elemCanvas);

        const c = elemCanvas;

        const ro = new ResizeObserver(entries => {
            if (entries.length < 0) return;
            const ent = entries[0];
            c.width = ent.contentRect.width;
            c.height = ent.contentRect.height;

            if (renderer) {
                renderer.canvasResized();
            }
        });

        ro.observe(elemCanvas);
    }

    renderer = await Renderer.make(device, elemCanvas, queue, bufferAllocator);

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

    let shutdown = false;
    let shutdownCb: (() => void) | null = null;

    async function step(time: number) {
        if (!prevTime) {
            prevTime = time;
            requestAnimationFrame(step);
            return;
        }

        const delta = (time - prevTime) / 1000.0;
        await simulator.step(delta);
        const drawInfo = await simulator.getDrawInfo();
        await renderer.step(numMaxParticles, drawInfo);
        bufferAllocator.advanceFrame(queue.onSubmittedWorkDone());

        if (!shutdown) {
            requestAnimationFrame(step);
        } else {
            if (shutdownCb) {
                shutdownCb();
            }
        }

        prevTime = time;
    }

    requestAnimationFrame(step);

    return new class {
        cancel(): Promise<void> {
            shutdown = true;

            return new Promise<void>(resolve => {
                shutdownCb = resolve;
            });
        }

        addParticle(px: number, py: number, vx: number, vy: number) {
            if (shutdown) throw new Error('Already shutdown');
            simulator.addParticle(px, py, vx, vy);
        }
    };
}
