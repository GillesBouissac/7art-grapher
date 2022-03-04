import * as d3 from "https://cdn.skypack.dev/d3@7";

export { UiFastSearch };

/**
 * Class to handle the left tray of the page
 */
class UiFastSearch {

    /**
     * Construtor to set the handlers
     */
    constructor() {
        this.opened = false;

        // Needed to guess drag direction
        this.menuToggle = d3.select("#menu-item-toggle-fast-search");
        this.tray = d3.select("#fast-search-tray");
        this.input = d3.select("#fast-search-input");

        this.menuToggle
            .on("click.fast-search", this.onToggle());

        this.close();
    }

    /**
     * Opens the tray
     */
    open() {
        this.opened = true;
        this.tray.classed("show", true);
        this.input.node().focus();
    }

    /**
     * Closes the tray
     */
    close() {
        this.opened = false;
        this.tray.classed("show", false);
        this.input.node().blur();
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
         */
        return function() {
            if (_this.opened) {
                _this.close();
            }
            else {
                _this.open();
            }
        };
    }

}
