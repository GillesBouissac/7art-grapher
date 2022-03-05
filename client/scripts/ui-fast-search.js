import * as d3 from "https://cdn.skypack.dev/d3@7";
import { Listened } from "./util.js";

export { UiFastSearch };

/**
 * Class to handle the left tray of the page
 * 
 * Fired events:
 *   - "change": function(text)
 * 
 */
class UiFastSearch extends Listened {

    /**
     * Construtor to set the handlers
     */
    constructor() {
        super();

        /** @type {boolean} The menu is opened or closed */
        this.opened = false;

        // Needed to guess drag direction
        this.menuToggle = d3.select("#menu-item-toggle-fast-search");
        this.tray = d3.select("#fast-search-tray");
        this.input = d3.select("#fast-search-input")
            .on("input", () => this.fire("change", this.input.property("value")))
            ;

        this.menuToggle
            .on("click.fast-search", this.buildOnToggle());

        this.close();
    }

    /**
     * Opens the tray
     */
    open() {
        this.opened = true;
        this.tray.classed("show", true);
        this.input.node().select();
        this.fire("change", this.input.property("value"));
    }

    /**
     * Closes the tray
     */
    close() {
        this.opened = false;
        this.tray.classed("show", false);
        this.input.node().blur();
        // We don't clean the field value, just make the user think it is
        this.fire("change", "");
    }

    /**
     * Build a menu-item-open-left handler bound to this object
     * 
     * @returns {Function} Callback for event
     */
    buildOnToggle() {
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
