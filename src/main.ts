/// <reference types="@webgpu/types" />

import { Renderer } from './Renderer';
import { Simulator } from './Simulator';
import { MaybeOwnedElement } from './MaybeOwnedElement';

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

    const numMaxFramesInFlight = 2;

    const numMaxParticles = opts?.numMaxParticles || 1024;
    const simulator = await Simulator.make(device, queue, numMaxParticles, numMaxFramesInFlight);

    let renderer: Renderer;

    let elemCanvas: MaybeOwnedElement<HTMLCanvasElement>;
    if (opts && opts.canvas) {
        elemCanvas = new MaybeOwnedElement(opts.canvas, false);
    } else {
        const elem = document.createElement('canvas');
        elem.style.width = '100vw';
        elem.style.height = '100vh';
        elem.style.pointerEvents = 'none';
        elem.style.position = 'absolute';
        elem.style.top = elem.style.left = '0';
        document.body.appendChild(elem);
        elemCanvas = new MaybeOwnedElement(elem, true);

        const ro = new ResizeObserver(entries => {
            if (entries.length < 0) return;
            const ent = entries[0];
            elem.width = ent.contentRect.width;
            elem.height = ent.contentRect.height;

            if (renderer) {
                renderer.canvasResized();
            }
        });

        ro.observe(elem);
    }

    renderer = await Renderer.make(device, elemCanvas.element, queue, numMaxFramesInFlight);

    const handler = (() => {
        let prevMousePos: [number, number] | null = null;
        return function handleMouseMove(ev: MouseEvent) {
            if (prevMousePos === null) {
                prevMousePos = [ev.clientX, -ev.clientY];
            }

            let posCanvasX = elemCanvas.element.offsetLeft;
            let posCanvasY = elemCanvas.element.offsetTop;

            // Compute cursor position relative to the canvas
            const posCursorX = ev.clientX - posCanvasX;
            const posCursorY = -(ev.clientY - posCanvasY);
            const deltaX = posCursorX - prevMousePos[0];
            const deltaY = posCursorY - prevMousePos[1];
            simulator.addParticle(posCursorX, posCursorY, 8 * deltaX, 8 * deltaY);
            prevMousePos = [posCursorX, posCursorY];
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

        if (!shutdown) {
            requestAnimationFrame(step);
        } else {
            elemCanvas.release();
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
