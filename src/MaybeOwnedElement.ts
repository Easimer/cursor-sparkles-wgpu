export class MaybeOwnedElement<T extends HTMLElement> {
    constructor(private elem: T, private isOwned: boolean) { }

    release() {
        if (!this.isOwned) return;

        this.elem.remove();
    }

    get element() {
        return this.elem;
    }
}