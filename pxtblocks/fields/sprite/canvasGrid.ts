namespace pxtblockly {
    const alphaCellWidth = 5;
    const dropdownPaddding = 4;
    const lightModeBackground = "#dedede";

    export class CanvasGrid {
        protected cellWidth: number = 16;
        protected cellHeight: number = 16;

        private gesture: GestureState;
        private context: CanvasRenderingContext2D;
        private bounds: ClientRect;
        private fadeAnimation: Fade;

        protected backgroundLayer: HTMLCanvasElement;
        protected paintLayer: HTMLCanvasElement;
        protected overlayLayer: HTMLCanvasElement;

        constructor(protected palette: string[], public image: Bitmap, protected lightMode = false) {
            this.paintLayer = document.createElement("canvas");

            if (!this.lightMode) {
                this.backgroundLayer = document.createElement("canvas");
                this.overlayLayer = document.createElement("canvas")
                this.context = this.paintLayer.getContext("2d");
            }
            else {
                this.context = this.paintLayer.getContext("2d", { alpha: false });
                this.context.fillStyle = lightModeBackground;
                this.context.fill();
            }

            this.hideOverlay();
        }

        repaint(): void {
            this.redraw();
        }

        applyEdit(edit: Edit) {
            edit.doEdit(this.image);
            this.repaint();
        }

        bitmap() {
            return this.image;
        }

        outerWidth(): number {
            return this.paintLayer.getBoundingClientRect().width;
        }

        outerHeight(): number {
            return this.paintLayer.getBoundingClientRect().height;
        }

        writeColor(col: number, row: number, color: number) {
            const old = this.image.get(col, row);
            this.image.set(col, row, color);
            this.drawColor(col, row, color);
        }

        drawColor(col: number, row: number, color: number) {
            this.setCellColor(col, row, color === 0 ? undefined : this.palette[color - 1]);
        }

        restore(bitmap: Bitmap, repaint = false) {
            if (bitmap.height != this.image.height || bitmap.width != this.image.width) {
                this.image = bitmap.copy();
                this.resizeGrid(bitmap.width, bitmap.width * bitmap.height);
            }
            else {
                this.image.apply(bitmap);
            }

            if (repaint) {
                this.repaint();
            }
        }

        showOverlay(): void {
            if (this.lightMode) return;

            if (this.fadeAnimation) {
                this.fadeAnimation.kill();
            }
            this.overlayLayer.style.visibility = "visible";
            const w = this.overlayLayer.width;
            const h = this.overlayLayer.height;
            const xOffset = this.cellWidth / 2;
            const yOffset = this.cellHeight / 2;
            const context = this.overlayLayer.getContext("2d");
            const toastWidth = 100;
            const toastHeight = 40;
            const toastLeft = w / 2 - toastWidth / 2;
            const toastTop = h / 2 - toastWidth / 4;

            this.fadeAnimation = new Fade((opacity, dead) => {
                if (dead) {
                    this.hideOverlay();
                    return;
                }

                context.clearRect(0, 0, w, h);
                context.globalAlpha = opacity;
                context.fillStyle = "#898989";

                // After 32x32 the grid isn't easy to see anymore so skip it
                if (this.image.width <= 32 && this.image.height <= 32) {
                    for (let c = 1; c < this.image.width; c++) {
                        context.fillRect(c * this.cellWidth, 0, 1, h);
                    }
                    for (let r = 1; r < this.image.height; r++) {
                        context.fillRect(0, r * this.cellHeight, w, 1);
                    }
                }

                context.fillRect(toastLeft, toastTop, toastWidth, toastHeight);
                context.fillStyle = "#ffffff";
                context.font = "30px sans-serif";
                context.textBaseline = "middle";
                context.textAlign = "center";

                context.fillText(this.image.width.toString(), toastLeft + toastWidth / 2 - 25, toastTop  + toastHeight / 2);
                context.fillText("x", toastLeft + 50, toastTop + toastHeight / 2, 10);
                context.fillText(this.image.height.toString(), toastLeft + toastWidth / 2 + 25, toastTop + toastHeight / 2);
            }, 750, 500);
        }

        hideOverlay() {
            if (!this.lightMode) {
                this.overlayLayer.style.visibility = "hidden";
            }
        }

        resizeGrid(rowLength: number, numCells: number): void {
            this.repaint();
        }

        setCellDimensions(width: number, height: number): void {
            this.cellWidth = width;
            this.cellHeight = height;

            const canvasWidth = this.cellWidth * this.image.width;
            const canvasHeight = this.cellHeight * this.image.height;

            this.paintLayer.width = canvasWidth;
            this.paintLayer.height = canvasHeight;

            if (!this.lightMode) {
                this.backgroundLayer.width = canvasWidth;
                this.backgroundLayer.height = canvasHeight;
                this.overlayLayer.width = canvasWidth;
                this.overlayLayer.height = canvasHeight;
            }
        }

        setGridDimensions(width: number, height = width, lockAspectRatio = true): void {
            const maxCellWidth = width / this.image.width;
            const maxCellHeight = height / this.image.height;

            if (lockAspectRatio) {
                const aspectRatio = this.cellWidth / this.cellHeight;

                if (aspectRatio >= 1) {
                    const w = Math.min(maxCellWidth, maxCellHeight * aspectRatio);
                    this.setCellDimensions(w, w * aspectRatio);
                }
                else {
                    const h = Math.min(maxCellHeight, maxCellWidth / aspectRatio)
                    this.setCellDimensions(h / aspectRatio, h);
                }
            }
            else {
                this.setCellDimensions(maxCellWidth, maxCellHeight);
            }
        }

        setCellColor(column: number, row: number, color: string, opacity?: number): void {
            const x = column * this.cellWidth;
            const y = row * this.cellHeight;
            if (color) {
                this.context.fillStyle = color;
                this.context.fillRect(x, y, this.cellWidth, this.cellHeight);
            }
            else if (!this.lightMode) {
                this.context.clearRect(x, y, this.cellWidth, this.cellHeight);
            }
            else {
                this.context.fillStyle = lightModeBackground;
                this.context.fillRect(x, y, this.cellWidth, this.cellHeight);
            }
        }

        down(handler: (col: number, row: number) => void): void {
            this.initDragSurface();
            this.gesture.subscribe(GestureType.Down, handler);
        }

        up(handler: (col: number, row: number) => void): void {
            this.initDragSurface();
            this.gesture.subscribe(GestureType.Up, handler);
        }

        drag(handler: (col: number, row: number) => void): void {
            this.initDragSurface();
            this.gesture.subscribe(GestureType.Drag, handler);
        }

        move(handler: (col: number, row: number) => void): void {
            this.initDragSurface();
            this.gesture.subscribe(GestureType.Move, handler);
        }

        leave(handler: () => void): void {
            this.initDragSurface();
            this.gesture.subscribe(GestureType.Leave, handler);
        }

        updateBounds(top: number, left: number, width: number, height: number) {
            this.layoutCanvas(this.paintLayer, top, left, width, height);

            if (!this.lightMode) {
                this.layoutCanvas(this.overlayLayer, top, left, width, height);
                this.layoutCanvas(this.backgroundLayer, top, left, width, height);
            }

            this.redraw();
            this.drawBackground();

            this.bounds = undefined;
        }

        render(parent: HTMLDivElement) {
            if (!this.lightMode) {
                parent.appendChild(this.backgroundLayer);
            }

            parent.appendChild(this.paintLayer);

            if (!this.lightMode) {
                parent.appendChild(this.overlayLayer);
            }
        }

        protected redraw() {
            for (let c = 0; c < this.image.width; c++) {
                for (let r = 0; r < this.image.height; r++) {
                    this.drawColor(c, r, this.image.get(c, r));
                }
            }
        }

        protected drawBackground() {
            if (this.lightMode) return;
            const context = this.backgroundLayer.getContext("2d", { alpha: false });
            const alphaCols = Math.ceil(this.paintLayer.width / alphaCellWidth);
            const alphaRows = Math.ceil(this.paintLayer.height / alphaCellWidth);
            context.fillStyle = "#ffffff";
            context.fillRect(0, 0, this.paintLayer.width, this.paintLayer.height);

            context.fillStyle = "#dedede";
            for (let ac = 0; ac < alphaCols; ac++) {
                for (let ar = 0; ar < alphaRows; ar++) {
                    if ((ac + ar) % 2) {
                        context.fillRect(ac * alphaCellWidth, ar * alphaCellWidth, alphaCellWidth, alphaCellWidth);
                    }
                }
            }
        }

        protected clientToCell(clientX: number, clientY: number) {
            if (!this.bounds) this.bounds = this.paintLayer.getBoundingClientRect();

            return [
                Math.floor((clientX - this.bounds.left) / this.cellWidth),
                Math.floor((clientY - this.bounds.top) / this.cellHeight)
            ];
        }

        private initDragSurface() {
            if (!this.gesture) {
                this.gesture = new GestureState();

                this.paintLayer.addEventListener("pointermove", (ev: MouseEvent) => {
                    const [col, row] = this.clientToCell(ev.clientX, ev.clientY);
                    if (ev.buttons & 1) {
                        this.gesture.handle(InputEvent.Down, col, row);
                    }
                    this.gesture.handle(InputEvent.Move, col, row);
                });

                this.paintLayer.addEventListener("pointerdown", (ev: MouseEvent) => {
                    const [col, row] = this.clientToCell(ev.clientX, ev.clientY);
                    this.gesture.handle(InputEvent.Down, col, row);
                });

                this.paintLayer.addEventListener("pointerup", (ev: MouseEvent) => {
                    const [col, row] = this.clientToCell(ev.clientX, ev.clientY);
                    this.gesture.handle(InputEvent.Up, col, row);
                });

                this.paintLayer.addEventListener("pointerclick", (ev: MouseEvent) => {
                    const [col, row] = this.clientToCell(ev.clientX, ev.clientY);
                    this.gesture.handle(InputEvent.Down, col, row);
                    this.gesture.handle(InputEvent.Up, col, row);
                });

                this.paintLayer.addEventListener("pointerleave", ev => {
                    const [col, row] = this.clientToCell(ev.clientX, ev.clientY);
                    this.gesture.handle(InputEvent.Leave, col, row);
                });
            }
        }

        private layoutCanvas(canvas: HTMLCanvasElement, top: number, left: number, width: number, height: number) {
            canvas.style.position = "absolute";
            canvas.style.left = (left + dropdownPaddding + (width - canvas.width) / 2) + "px";
            canvas.style.top = (top + dropdownPaddding + (height - canvas.height) / 2) + "px";
        }
    }

    enum InputEvent {
        Up,
        Down,
        Move,
        Leave
    }

    enum GestureType {
        Up,
        Down,
        Move,
        Drag,
        Leave
    }

    type GestureHandler = (col: number, row: number) => void;

    class GestureState {
        lastCol: number;
        lastRow: number;

        isDown = false;

        handlers: {[index: number]: GestureHandler} = {};

        handle(event: InputEvent, col: number, row: number) {
            switch (event) {
                case InputEvent.Up:
                    this.update(col, row);
                    this.isDown = false;
                    this.fire(GestureType.Up);
                    break;
                case InputEvent.Down:
                    if (!this.isDown) {
                        this.isDown = true;
                        this.fire(GestureType.Down);
                    }
                    break;
                case InputEvent.Move:
                    if (col === this.lastCol && row === this.lastRow) return;
                    this.update(col, row);
                    if (this.isDown) {
                        this.fire(GestureType.Drag);
                    }
                    else {
                        this.fire(GestureType.Move);
                    }
                    break;

                case InputEvent.Leave:
                    this.update(col, row);
                    this.isDown = false;
                    this.fire(GestureType.Leave);
                    break;
            }
        }

        subscribe(type: GestureType, handler: GestureHandler) {
            this.handlers[type] = handler;
        }

        protected update(col: number, row: number) {
            this.lastCol = col;
            this.lastRow = row;
        }

        protected fire(type: GestureType) {
            if (this.handlers[type]) {
                this.handlers[type](this.lastCol, this.lastRow);
            }
        }
    }

    class Fade {
        start: number;
        end: number;
        slope: number;
        dead: boolean;

        constructor (protected draw: (opacity: number, dead: boolean) => void, delay: number, duration: number) {
            this.start = Date.now() + delay;
            this.end = this.start + duration;
            this.slope = 1 / duration;
            this.dead = false;

            draw(1, false);

            setTimeout(() => requestAnimationFrame(() => this.frame()), delay);
        }

        frame() {
            if (this.dead) return;
            const now = Date.now();
            if (now < this.end) {
                const v = 1 - (this.slope * (now - this.start));
                this.draw(v, false);
                requestAnimationFrame(() => this.frame());
            }
            else {
                this.draw(0, true);
                this.kill();
            }
        }

        kill() {
            this.dead = true;
        }
    }
}