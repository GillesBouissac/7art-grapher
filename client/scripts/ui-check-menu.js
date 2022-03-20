// @ts-check
import * as d3 from "https://cdn.skypack.dev/d3@7";
import { Listened } from "./lib/util.js";

export { UICheckMenu };

/**
 * Class to handle a checkbox selector menu opened with a button in the menu bar
 * 
 * Fired events:
 *   - "selected": function(item)
 */
class UICheckMenu extends Listened {

    /**
     * Construtor to set the handlers
     * 
     * @param {d3.Selection} menuItem The menu item that will control the menu
     * @param {string} defaultItem Default selected label
     */
    constructor(menuItem, defaultItem) {
        super();

        /** @type {string[]} List of items to choose */
        this._items = [];
        /** @type {string} Current selected item */
        this._selected = defaultItem;
        /** @type {boolean} The menu is opened or closed */
        this.opened = false;
        /** @type {d3.Selection} */
        this.body = d3.select("body");
        /** @type {d3.Selection} */
        this.box = d3.select("#select-data-position");
        /** @type {d3.Selection} */
        this.list = d3.select("#select-data-list");
        /** @type {d3.Selection} */
        this.template = d3.select("#Templates").select(".select-data-item-template");

        /** @type {d3.Selection} */
        this.menuToggle = menuItem;

        this.menuToggle
            .on(`click.select-data-${this.menuToggle.attr("id")}`, this.buildOnToggle());
        this.body
            .on(`click.select-data-${this.menuToggle.attr("id")}`, this.buildOnClickBackground());
    }

    /**
     * Getter/Setter for menu items
     * 
     * @param {string[]|null} items List of menu items labels to set (setter)
     * @returns {UICheckMenu|string[]} This (setter) or list of items (getter)
     */
    items(items) {
        if (items) {
            this._items = items;
            return this;
        }
        return this._items;
    }

    /**
     * Getter/Setter for current selected item
     * 
     * @param {string} item Item to select (setter)
     * @returns {UICheckMenu|string} This (setter) or selected item (getter)
     */
    selected(item) {
        if (item) {
            this._selected = item;
            this.fire("selected", this._selected);
            return this;
        }
        return this._selected;
    }

    /**
     * Creates a new item in the menu with given label
     * 
     * @param {string} label The new item label
     * @returns {d3.selection} The created element
     */
    newItem(label) {
        const newElement = this.template.clone(true).remove();
        newElement.selectAll(".select-data-item-label")
            .attr("for", `select-item-${label}`)
            .text(label);
        newElement.selectAll(".select-data-item-input")
            .attr("id", `select-item-${label}`);
        return newElement;
    }

    /**
     * Opens the tray
     */
    open() {
        const _this = this;
        this.opened = false;
        if (this._items) {
            this.list
                .selectAll(".select-data-item-template")
                .remove();
            this.list
                .selectAll(".select-data-item-template")
                .data(this._items)
                .join(
                    enter => enter
                        .append((label) => _this.newItem(label).node())
                        .on("click", _this.buildOnSelected())
                )
                .select(".select-data-item-input")
                    .property("checked", d => d==_this._selected)
                ;
            this.box.classed("show", true);
            const bodyRect = document.body.getBoundingClientRect();
            const commandRect = this.menuToggle.node().getBoundingClientRect();
            const x = commandRect.left-bodyRect.left-bodyRect.left;
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
     * Build a menu-item-select-data handler bound to this object
     * 
     * @returns {Function} Callback for event
     */
    buildOnToggle() {
        const _this = this;
        /**
         * The button handler
         * 
         * @param {d3.event} e event
         */
        return function(e) {
            if (_this.opened) {
                _this.close();
                e.stopPropagation();
            }
            else {
                _this.open();
                e.stopPropagation();
            }
        };
    }
}
