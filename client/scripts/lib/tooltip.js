// @ts-check


import * as d3 from "https://cdn.skypack.dev/d3@7";
export { Tooltip };

/**
 * Tooltip formatting and positioning.
 */

class Tooltip {

    /**
     * Tooltip constructor.
     * 
     * @param {Element?} node the DOM node where this object will be attached
     */
    constructor( node ) {
        this._target = null;
        this._bodyfn = null;
        this._tiptoast = d3.select(node ? node : "main")
            .append("div")
            .classed("toast", true)
            .classed("container", true)
            .attr("role", "alert")
            .style("display", "none")
            .style("position", "fixed");
        this._tipbody = this._tiptoast
            .append("div")
            .classed("toast-header", true);
        this.body("...");
    }

    /**
     * Set the body of the tooltip.
     * 
     * @param {*} b Body content, this can be text of a callback.
     *              call back will be called with current datum
     *              and this is the tooltip dom Node
     * @returns {Tooltip} this
     */
    body(b) {
        this._tipbody.selectChildren().remove();
        if(b instanceof Function) {
            this._bodyfn = b;
            //(this._tipbody, ...Array.from(arguments).slice(1));
        }
        else {
            this._bodyfn = function() { `<p>${b}</p>`; };
        }
        return this;
    }

    /**
     * Activate the tooltip to track the mouse over the given node,
     * Tooltip will be automatically removed when mouse leave the node.
     * 
     * @returns {Function} The show handler
     */
    show() {
        const _this = this;
        return function (_,d) {
            if ( _this._bodyfn ) {
                const res = _this._bodyfn.call(_this._tipbody.node(), d);
                if (res) _this._tipbody.node().innerHTML = res;
            }
            _this._tiptoast.style("display", "block")
                .raise();
            _this._target = d3.select(this)
                .on("mousemove.tooltip", _this.onMouseMove())
                .on("mouseout.tooltip", _this.onMouseLeave());
            return _this;
        };
    }

    /**
     * Hide the tooltip
     * 
     * @returns {Function} The hide function
     */
    hide() {
        const _this = this;
        return function() {
            _this._hide();
        };
    }

    /**
     * Hides the tooltip.
     * 
     * @returns {Tooltip} this
     */
    _hide() {
        if (this._target) {
            this._target
                .on("mouseover.tooltip", null)
                .on("mouseout.tooltip", null);
        }
        this._target = null;
        this._tiptoast.style("display", "none");
        return this;
    }

    /**
     * Mouse move tracker builder.
     * 
     * @returns {Function} The tracking function
     */
    onMouseMove() {
        const _this = this;
        return function(e) {
            if ( _this._target!=null ) {
                _this._tiptoast
                    .style("top", `${e.clientY}px`)
                    .style("left", `${e.clientX}px`)
                    .raise();
            }
            return _this;
        };
    }

    /**
     * Mouse leave tracker builder.
     * 
     * @returns {Tooltip} this
     */
    onMouseLeave() {
        return this._hide();
    }

}

