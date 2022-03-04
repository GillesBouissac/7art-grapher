import * as d3 from "https://cdn.skypack.dev/d3@7";

export { UiLeftTray };

/**
 * Class to handle the left tray of the page
 */
class UiLeftTray {

    /**
     * Construtor to set the handlers
     */
    constructor() {
        // Needed to guess drag direction
        this.lastDragX = 0;
        this.position = 0;
        this.direction = "none";

        this.body = d3.select("body");
        this.menuToggle = d3.select("#menu-item-open-left");
        this.tray = d3.select("#left-tray");
        this.trayHandle = d3.select("#left-tray-handle");
        this.drag = d3.drag()
            .on("start.left-tray", this.onDragStart())
            .on("drag.left-tray", this.onDrag())
            .on("end.left-tray", this.onDrop());

        this.menuToggle
            .on("click.left-tray", this.onToggle());
        this.tray
            .on("click", this.onClick())
            .call(this.drag);
        this.trayHandle
            .on("click", this.onClick())
            .call(this.drag);
        this.body
            .on("click.left-tray", this.onClickBackground());
    }

    /**
     * Returns the current tray position
     * 
     * @returns {number} position
     */
    getTrayPosition() {
        return this.position;
    }

    /**
     * Opens the tray
     */
    open() {
        this.setTrayPosition(this.tray.node().clientWidth);
    }

    /**
     * Closes the tray
     */
    close() {
        this.setTrayPosition(0);
    }

    /**
     * Forces current tray position
     * 
     * @param {number} pos new position
     */
    setTrayPosition(pos) {
        this.position = pos;
        this.tray.style("transform", `translateX(${this.position}px)`);
    }

    /**
     * Build a click on background handler bound to this object
     * 
     * @returns {Function} Callback for event
     */
    onClick() {
        /**
         * The click on background handler
         * 
         * @param {d3.event} e Event
         */
        return function(e) {
            e.stopPropagation();
        };
    }

    /**
     * Build a click on background handler bound to this object
     * 
     * @returns {Function} Callback for event
     */
    onClickBackground() {
        const _this = this;
        /** The click on background handler */
        return function() {
            _this.close();
        };
    }

    /**
     * Build a "start drag on left menu handle" handler bound to this object
     * 
     * @returns {Function} Callback for event
     */
    onDragStart() {
        const _this = this;
        /**
         * The "start drag on left menu handle" handler
         * 
         * @param {d3.event} e Event
         */
        return function(e) {
            _this.direction = "none";
            _this.lastDragX = e.x;
        };
    }

    /**
     * Build a "drag on left menu handle" handler bound to this object
     * 
     * @returns {Function} Callback for event
     */
    onDrag() {
        const _this = this;
        /**
         * The "drag on left menu handle" handler
         * 
         * @param {d3.event} e Event
         */
        return function(e) {
            const delta = e.x-_this.lastDragX;
            if (delta!=0) {
                if (delta>0) {
                    _this.direction = "right";
                }
                else {
                    _this.direction = "left";
                }
                _this.lastDragX = e.x;
                const trayCurrentWidth = _this.tray.node().clientWidth;
                _this.setTrayPosition(Math.min(_this.position+delta,trayCurrentWidth));
            }
        };
    }

    /**
     * Build a "drop on left menu handle" handler bound to this object
     * 
     * @returns {Function} Callback for event
     */
     onDrop() {
        const _this = this;
        /**
         * The "drop on left menu handle" handler
         */
        return function() {
            if (_this.direction=="right") {
                _this.open();
            }
            else if (_this.direction=="left") {
                _this.close();
            }
        };
    }

    /**
     * Build a menu-item-open-left handler bound to this object
     * 
     * @returns {Function} Callback for event
     */
     onToggle() {
        const _this = this;
        /**
         * The menu-item-open-left button handler
         * 
         * @param {d3.event} e Event
         */
        return function(e) {
            e.stopPropagation();
            if (_this.getTrayPosition() == 0)
                _this.open();
            else
                _this.close();
        };
    }

}
