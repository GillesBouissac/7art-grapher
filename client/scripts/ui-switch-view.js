import * as d3 from "https://cdn.skypack.dev/d3@7";
import { Listened } from "./lib/util.js";

export { UiSwitchView };

/**
 * Class to handle the left tray of the page
 * 
 * Fired events:
 *   - "to-grid": function(text)
 *   - "to-list": function(text)
 * 
 */
class UiSwitchView extends Listened {

    static ModeGrid = "grid";
    static ModeList = "list";

    /**
     * Construtor to set the handlers
     */
    constructor() {
        super();

        // this._mode = UiSwitchView.ModeGrid;
        this._mode = UiSwitchView.ModeList;

        /** @type {d3.Selection} */
        this.menuToggle = d3.select("#menu-item-switch-view")
            .on("click", this.buildOnClick())
            ;

        this.mode(this._mode);
    }

    /**
     * Getter/Setter of the current mode
     * 
     * @param {string|null} mode The new display mode
     * @returns {null|string} Current mode
     */
    mode(mode) {
        if (mode) {
            this._mode = mode;
            if (mode==UiSwitchView.ModeGrid) {
                // The menu shoes the icon to switch on the next mode
                this.menuToggle
                    .classed("bi-list-task", true)
                    .classed("bi-grid-3x3-gap", false)
                    ;
                this.fire("to-grid");
            }
            else if (mode==UiSwitchView.ModeList) {
                // The menu shoes the icon to switch on the next mode
                this.menuToggle
                    .classed("bi-grid-3x3-gap", true)
                    .classed("bi-list-task", false)
                    ;
                this.fire("to-list");
            }
            return this;
        }
        return this._mode;
    }

    /**
     * Ask if current mode is grid
     * 
     * @returns {boolean} True if current mode is grid
     */
    isModeGrid() {
        return this._mode==UiSwitchView.ModeGrid;
    }

    /**
     * Ask if current mode is list
     * 
     * @returns {boolean} True if current mode is list
     */
    isModeList() {
        return this._mode==UiSwitchView.ModeList;
    }

    /**
     * Build a click on menu handler bound to this object
     * 
     * @returns {Function} Callback for event
     */
    buildOnClick() {
        const _this = this;
        /**
         * The event handler
         * 
         * @param {d3.event} e Event
         */
        return function(e) {
            e.stopPropagation();
            if (_this._mode==UiSwitchView.ModeGrid)
                _this.mode(UiSwitchView.ModeList);
            else if (_this._mode==UiSwitchView.ModeList)
                _this.mode(UiSwitchView.ModeGrid);
        };
    }

}
