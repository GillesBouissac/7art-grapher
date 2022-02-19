/**
 * Tooltip formatting and positioning.
 */

class Tooltip {

    /**
     * Tooltip constructor.
     * 
     * @param {*} node 
     */
    constructor( node ) {
        this._target = null;
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
    }

    /**
     * Set the body of the tooltip.
     * 
     * @param {*} b Body content, this can be text of a callback.
     *              call back will be called with tooltip body node
     *              all other input parameters will be given unchanged
     * @returns this
     */
    body(b) {
        this._tipbody.selectChildren().remove();
        if(b instanceof Function) {
            b(this._tipbody, ...Array.from(arguments).slice(1));
        }
        else {
            this._tipbody
                .append("p")
                .text(b)
        }
        return this;
    }

    /**
     * Activate the tooltip to track the mouse over the given node,
     * Tooltip will be automatically removed when mouse leave the node.
     * 
     * @param {*} node 
     * @returns this
     */
    track(node) {
        this._tiptoast.style("display", "block")
            .raise()
        this._target = d3.select(node)
            .on("mousemove.tooltip", this.onMouseMove())
            .on("mouseout.tooltip", this.onMouseLeave());
        return this;
    }

    /**
     * Hides the tooltip.
     * 
     * @returns this
     */
    hide() {
        if (this._target) {
            this._target
                .on("mouseover.tooltip", null)
                .on("mouseout.tooltip", null);
            this._tiptoast
                .raise();
        }
        this.body("...");
        this._target = null;
        this._tiptoast.style("display", "none")
        return this;
    }

    /**
     * Mouse move tracker builder.
     * 
     * @returns The tracking function
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
        }
    }

    /**
     * Mouse leave tracker builder.
     * 
     * @returns The tracking function
     */
     onMouseLeave() {
        const _this = this;
        return function(e) {
            _this.hide();
            return this;
        }
    }

}

