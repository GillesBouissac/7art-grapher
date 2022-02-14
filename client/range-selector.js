
const rangeSelector = function ( svg ) {
    let _selector = null;
    let _onMovedCb = null;
    const _scale = d3.scaleLinear();
    const _width = svg.node() ? svg.node().parentNode.getClientRects()[0].width : 0 ;
    const _height = 40;
    const _margin = ({top: 1, right: 1, bottom: 1, left: 1});
    const _minWidth = 3;

    const _selectorG = svg
        .attr("width",_width)
        .attr("height",_height)
        .append("g")
        .classed("range-selector", true);

    const brush = d3.brushX()
        .extent([[_margin.left, _margin.top], [_width - _margin.right, _height - _margin.bottom]])
        .on("end", function(event){
            const range = event.selection;
            if (!event.sourceEvent || !range) return; // avoid infinite loops
            range[1] = (range[0]+_minWidth)>range[1] ? range[0]+_minWidth : range[1];
            d3.select(this).call(brush.move, range);
            if ( _onMovedCb!=null ) _onMovedCb( [_scale.invert(range[0]), _scale.invert(range[1])] );
        });

    _selectorG
        .call(brush);

    _scale.range([0, _width])

    _selector = {
        move: function(d) {
            const range = [ _scale(d[0]), _scale(d[1]) ];
            range[1] = (range[0]+_minWidth)>range[1] ? range[0]+_minWidth : range[1];
            brush.move(_selectorG, range );
        },
        domain: function(v) {if(v==null){return _scale.domain()}; _scale.domain(v);return this },
        range: function(v) {if(v==null){return _scale.range()}; _scale.range(v);return this },

        // cb: callback called with the bbox
        onMoved: function (cb) { _onMovedCb = cb; return this }
    }
    return _selector;
}

