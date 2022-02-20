
/**
 * Base class for brush helper
 */
class RangeSelectorBase {
    constructor( svg, width, height ) {
        this._selector = null;
        this._onMovedCb = null;
        this._width = width==null?(svg.node() ? svg.node().parentNode.getClientRects()[0].width : 40) : width ;
        this._height = height==null?this._width :height;
        this._margin = ({top: 1, right: 1, bottom: 1, left: 1});
        this._selectorG = svg
            .attr("width",this._width)
            .attr("height",this._height)
            .append("g")
            .classed("range-selector", true);

        let brush = this.createBrush().handleSize(30);
        this._brush = brush;
        this._selectorG
            .call(brush);
    };

    // cb: callback called with the bbox
    onMoved(cb) {
        this._onMovedCb = cb;
        return this;
    }

    onWheel() {
        return function(e) {
            e.preventDefault();
        }
    }

    raise() {
        this._selectorG.raise();
    }

    createBrush() {}
}

const invertScaleBand = function(r) {
    const step = this.step();
    const range = this.range();
    if ( range[0]<range[1]) {
        const index = Math.round((r-range[0])/step);
        return this.domain()[index];
    }
    const index = Math.round((r-range[1])/step);
    return this.domain()[this.domain().length-index];
}

/**
 * Brush that only allow move on X
 */
class RangeSelectorX extends RangeSelectorBase {
    constructor( svg, width, height ) {
        super(svg, width, height);
    }
    createBrush() {
        let _this = this;
        this._scale = d3.scaleBand().range([0, this._width]);
        this._scale.invert = invertScaleBand;
        this._minWidth = 3;
        return d3.brushX()
            .on("end", function(event){
                const range = event.selection;
                if (!event.sourceEvent || !range) return; // avoid infinite loops
                range[1] = (range[0]+_this._minWidth)>range[1] ? range[0]+_this._minWidth : range[1];
                d3.select(this).call(_this._brush.move, range);
                if ( _this._onMovedCb!=null ) _this._onMovedCb( [_this._scale.invert(range[0]), _this._scale.invert(range[1])] );
            });

    }
    move(d) {
        const range = [ this._scale(d[0]), this._scale(d[1])+this._scale.bandwidth() ];
        range[1] = (range[0]+this._minWidth)>range[1] ? range[0]+this._minWidth : range[1];
        this._brush.move(this._selectorG, range );
    };
    scale() { return this._scale }
}

/**
 * Brush that allow move on X and Y
 */
 class RangeSelectorXY extends RangeSelectorBase {
    constructor( svg, width, height ) {
        super(svg, width, height);
    }
    createBrush() {
        let _this = this;
        this._scaleX = d3.scaleBand().range([0, this._width]);
        this._scaleY = d3.scaleBand().range([this._height,0]);
        this._scaleX.invert = invertScaleBand;
        this._scaleY.invert = invertScaleBand;
        this._minWidth = 5;
        this._minHeight = 5;
        return d3.brush()
            .on("end", function(event){
                if (!event.sourceEvent || !event.selection || !event.selection[0] || !event.selection[1]) return; // avoid infinite loops
                const pt1 = event.selection[0];
                const pt2 = event.selection[1];
                pt2[0] = (pt1[0]+_this._minWidth)>pt2[0] ? pt1[0]+_this._minWidth : pt2[0];
                pt2[1] = (pt1[1]+_this._minHeight)>pt2[1] ? pt1[1]+_this._minHeight : pt2[1];
                d3.select(this).call(_this._brush.move, [pt1, pt2]);
                if ( _this._onMovedCb!=null ) _this._onMovedCb(
                    [_this._scaleX.invert(pt1[0]), _this._scaleY.invert(pt1[1])],
                    [_this._scaleX.invert(pt2[0]), _this._scaleY.invert(pt2[1])]
                );
            });
    }
    move(pt1,pt2) {
        pt1 = [this._scaleX(pt1[0]),this._scaleY(pt1[1])];
        pt2 = [this._scaleX(pt2[0])+this._scaleX.bandwidth(),this._scaleY(pt2[1])+this._scaleY.bandwidth()];
        this._brush.move(this._selectorG, [pt1, pt2] );
    };

    scaleX() { return this._scaleX }
    scaleY() { return this._scaleY }
}

const rangeSelectorX = function (svg, width, height) {
    return new RangeSelectorX(svg, width, height);
}

const rangeSelectorXY = function (svg, width, height) {
    return new RangeSelectorXY(svg, width, height);
}
