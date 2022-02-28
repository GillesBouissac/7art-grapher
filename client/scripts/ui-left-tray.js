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
        this.lastDragPos = [0, 0];
        this.direction = "none";

        this.body = d3.select("body");
        this.menuToggle = d3.select("#menu-item-open-left");
        this.tray = d3.select("#left-tray");
        this.trayHandle = d3.select("#left-tray-handle");

        this.menuToggle
            .on("click.left-tray", this.onOpen());
        this.tray
            .on("click.left-tray", this.onClick())
            .call(d3.drag()
                .on("drag.left-tray", this.onDrag())
                .on("end.left-tray", this.onDrop())
            );
        this.trayHandle
            .on("click.left-tray", this.onClick())
            .call(d3.drag()
                .on("drag.left-tray", this.onDrag())
                .on("end.left-tray", this.onDrop())
            );
        this.body
            .on("click.left-tray", this.onClickBackground());
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
           // Prevent the background to get the event it will close the menu
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
            _this.tray.style("transform", "none");
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
            if (_this.lastDragPos[0]!=e.x) {
                if (_this.lastDragPos[0]<e.x) {
                    _this.direction = "right";
                }
                else {
                    _this.direction = "left";
                }
            }
            _this.lastDragPos = [e.x, e.y];
            const trayCurrentWidth = _this.tray.node().clientWidth;
            _this.tray.style("transform", `translateX(${Math.min(e.x,trayCurrentWidth)}px)`);
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
            if (_this.direction=="right")
                _this.tray.style("transform", "translateX(100%)");
            else
                _this.tray.style("transform", "none");
        };
    }

    /**
     * Build a menu-item-open-left handler bound to this object
     * 
     * @returns {Function} Callback for event
     */
     onOpen() {
        const _this = this;
        /**
         * The menu-item-open-left button handler
         * 
         * @param {d3.event} e Event
         */
        return function(e) {
            e.stopPropagation();
            if (_this.tray.style("transform") == "none")
                _this.tray.style("transform", "translateX(100%)");
            else
                _this.tray.style("transform", "none");
        };
    }

}
