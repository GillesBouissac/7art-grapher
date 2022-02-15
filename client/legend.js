const joinBoxes = function ( boxes, margin=0 ) {
    const xmin = -margin+(boxes.length>0 ? Math.min(...boxes.map( b => b.x)) : 0);
    const ymin = -margin+(boxes.length>0 ? Math.min(...boxes.map( b => b.y)) : 0);
    const xmax = +margin+(boxes.length>0 ? Math.max(...boxes.map( b => b.x+b.width)) : 0);
    const ymax = +margin+(boxes.length>0 ? Math.max(...boxes.map( b => b.y+b.height)) : 0);
    return {
        x:xmin,
        y:ymin,
        width:xmax-xmin,
        height:ymax-ymin,
    }
}

const interactiveLegend = function ( svg, x, y ) {
    const legendSize = 20;
    const legendMargin = 5;

    let allseries = [];
    let activeSeries = [];
    let allcolors = null;
    let onSelectionChangedCb = null;
    let onEndRenderingCb = null;
    let showAll = false;
    let legend = null;
    let legendPos = {x:x==null?100:x,y:y==null?y:legendMargin,width:200,height:10};

    const legendG = svg.append("g")
        .classed("legend", true);

    svg.on("click.legend-out", function() {
            showAll = false;
            legend.update();
        });

    const legendBbox = legendG.append("rect")
        .classed("legendBbox", true)
        .style("fill", "white")
        .style("fill-opacity", "90%")
        .on("click", function(e) {
            e.stopPropagation();
            showAll = true;
            legend.update();
        });

    legend = {
        update: function (series=null) {

            if (series!=null) activeSeries = series;
            const displayedSeries = showAll ? allseries : activeSeries;
            legendG.raise();

            const transition = d3.transition()
                .duration(200)
                .on( "end", function() {
                    const bboxes = [ legendPos ];
                    legendG.selectAll(".legendDots").each(function() { bboxes.push(this.getBBox()) });
                    legendG.selectAll(".legendLabels").each(function() { bboxes.push(this.getBBox()) });
                    const bbox = joinBoxes(bboxes, legendMargin);
                    legendBbox
                        .attr("x", bbox.x)
                        .attr("y", bbox.y)
                        .attr("width", bbox.width)
                        .attr("height", bbox.height)
                    if (onEndRenderingCb!=null) onEndRenderingCb(bbox);
                });

            // Add one dot in the legend for each name
            legendG.selectAll(".legendDots")
                .data(displayedSeries, d=>d)
                .join("rect")
                .classed("legendDots", true)
                .on("click", function(e) {
                    e.stopPropagation();
                    const wasOpened = showAll;
                    showAll = true;
                    d3.select(this).each(d => wasOpened?legend.toggle(d):legend.update());
                })
                .transition(transition)
                .attr("x", legendPos.x)
                .attr("y", function(_,i){ return legendPos.y + i*(legendSize+5)})
                .attr("width", legendSize)
                .attr("height", legendSize)
                .style("fill", function(d){ return activeSeries.includes(d) ? allcolors(d) : "lightgrey"});

            // Add serie name
            legendG.selectAll(".legendLabels")
                .data(displayedSeries, d=>d)
                .join("text")
                .classed("legendLabels", true)
                .on("click", function(e) {
                    e.stopPropagation();
                    const wasOpened = showAll;
                    showAll = true;
                    d3.select(this).each(d => wasOpened?legend.toggle(d):legend.update());
                })
                .transition(transition)
                .attr("x", legendPos.x + legendSize*1.2)
                .attr("y", function(_,i){ return legendPos.y + i*(legendSize+5) + (legendSize/2)+5})
                .style("fill", function(d){ return allcolors(d)})
                .text(function(d){ return d})
                .attr("text-anchor", "left")
                .style("alignment-baseline", "middle");
    
            return this;
        },

        toggle: function( datum ) {
            if ( activeSeries.includes(datum) ) {
                activeSeries = activeSeries.filter(e => e!=datum);
            }
            else {
                const unsorted = activeSeries.slice();
                unsorted.push(datum);
                activeSeries = allseries.filter(e => unsorted.includes(e));
            }
            if ( onSelectionChangedCb!=null ) onSelectionChangedCb(activeSeries);
            this.update();
            return this;
        },

        allseries: function (s) {if(s!=null) { allseries=s; return this}; return allseries; },
        allcolors: function (c) {if(c!=null) { allcolors=c; return this}; return allcolors; },

        // cb: callback called with the array of new selected series indexes (from allseries)
        onSelectionChanged: function (cb) { onSelectionChangedCb = cb; return this },
        // cb: callback called with the legend controller and bbox
        onEndRendering: function (cb) { onEndRenderingCb = cb; return this }

    }
    return legend;
}

