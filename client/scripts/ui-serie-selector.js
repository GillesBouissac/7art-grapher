import * as d3 from "https://cdn.skypack.dev/d3@7";
import { Listened } from "./lib/util.js";
import { Serie } from "./lib/title.js";

export { UiSelectData };

/**
 * Class to handle the left tray of the page
 * 
 * Fired events:
 *   - "selected": function(serie)
 */
class UiSelectData extends Listened {
    static SERIE_DEFAULT = Serie.Names.title;

    /**
     * Construtor to set the handlers
     */
    constructor() {
        super();

        /** @type {string[]} List of series to choose */
        this._series = null;
        /** @type {string} Current selected serie */
        this._selected = UiSelectData.SERIE_DEFAULT;
        /** @type {boolean} The menu is opened or closed */
        this.opened = false;

        // Needed to guess drag direction
        /** @type {d3.Selection} */
        this.body = d3.select("body");
        /** @type {d3.Selection} */
        this.menuToggle = d3.select("#menu-item-select-data");
        /** @type {d3.Selection} */
        this.box = d3.select("#select-data-position");
        /** @type {d3.Selection} */
        this.list = d3.select("#select-data-list");
        /** @type {d3.Selection} */
        this.template = d3.select("#Templates").select(".select-data-item-template");

        this.menuToggle
            .on("click.select-data", this.buildOnToggle());
        this.body
            .on("click.select-data", this.buildOnClickBackground());
    }

    /**
     * Getter/Setter for indexed data
     * 
     * @param {string[]|null} seriesIn list of series
     * @returns {UiSelectData|string[]} This (setter) or list of series (getter)
     */
    series(seriesIn) {
        if (seriesIn) {
            this._series = seriesIn;
            return this;
        }
        return this._series;
    }

    /**
     * Getter/Setter for current selected item
     * 
     * @param {string} serie list of series
     * @returns {UiSelectData|string} This (setter) or selected serie (getter)
     */
    selected(serie) {
        if (serie) {
            this._selected = serie;
            this.fire("selected", this._selected);
            return this;
        }
        return this._selected;
    }

    /**
     * Creates a new serie item to display the given serie
     * 
     * @param {string} serie The current serie name
     * @returns {d3.selection} The created element
     */
    newItem(serie) {
        const newElement = this.template.clone(true).remove();
        newElement.selectAll(".select-data-item-label")
            .attr("for", `select-item-${serie}`)
            .text(serie);
        newElement.selectAll(".select-data-item-input")
            .attr("id", `select-item-${serie}`);
        return newElement;
    }

    /**
     * Opens the tray
     */
    open() {
        const _this = this;
        this.opened = false;
        if (this._series) {
            this.list.selectAll(".select-data-item-template")
                .data(this._series)
                .join(
                    enter => enter
                        .append((serie) => _this.newItem(serie).node())
                        .on("click", _this.buildOnSelected())
                )
                .select(".select-data-item-input")
                    .property("checked", d => d==_this._selected)
                ;
            this.box.classed("show", true);
            const bodyRect = document.body.getBoundingClientRect();
            const commandRect = this.menuToggle.node().getBoundingClientRect();
            const menuRect = this.list.node().getBoundingClientRect();
            const x = commandRect.left+commandRect.width/2-menuRect.width/2-bodyRect.left;
            const y = commandRect.bottom-bodyRect.top;
            this.box.style("top", `${y}px`).style("left", `${x}px`);
            this.opened = true;
        }
    }

    /**
     * Closes the tray
     */
    close() {
        this.box.classed("show", false);
        this.opened = false;
    }

    /**
     * Build a click on background handler bound to this object
     * 
     * @returns {Function} Callback for event
     */
    buildOnClickBackground() {
        const _this = this;
        /** The click on background handler */
        return function() {
            _this.close();
        };
    }

    /**
     * Build a new filter type selection change handler bound to this object
     * 
     * @returns {Function} Callback for "click" event on DOM Element
     */
    buildOnSelected() {
        const _this = this;
        /**
         * The filter type selector change handler
         * 
         * @param {d3.event} e event
         */
        return function (e) {
            _this.close();
            _this._selected = d3.select(this).select(".select-data-item-label").text();
            _this.fire("selected", _this._selected);
            e.stopPropagation();
        };
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
         * 
         * @param {d3.event} e event
         */
        return function(e) {
            if (_this.opened) {
                _this.close(e);
                e.stopPropagation();
            }
            else {
                _this.open(e);
                e.stopPropagation();
            }
        };
    }
}
