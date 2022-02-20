
/**
 * Constructs the heatmap data and graphics.
 * 
 * @param {string} datatype 
 * @param {number} width 
 * @param {number} height 
 */
const plotHeatmap = function ( datatype, width, height, maxStopsX, maxStopsY ) {

    width     = isNaN(parseInt(width,10)) ? window.innerWidth : parseInt(width,10);
    height    = isNaN(parseInt(height,10)) ? window.innerHeight : parseInt(height,10);
    maxStopsX = isNaN(parseInt(maxStopsX,10)) ? 500 : parseInt(maxStopsX,10);
    maxStopsY = isNaN(parseInt(maxStopsY,10)) ? 500 : parseInt(maxStopsY,10);

    // Default selected series
    const defaultSerieX = "Year";
    const defaultSerieY = "Countries";
    const nbColors = 100;

    // set the dimensions and margins of the graph
    const margin = { top: 10, right: 10, bottom: 80, left: 130 },
        plotw = width - margin.left - margin.right,
        ploth = height - margin.top - margin.bottom;

    // Create X axis scale
    const xscale = d3.scaleBand().range([0, plotw]).padding(0.05);
    const xAxis = d3.axisBottom(xscale);

    // Create Y axis scale
    const yscale = d3.scaleBand().range([ploth, 0]).padding(0.05);
    const yAxis = d3.axisLeft(yscale);

    // Colors for series
    const serieColor = colorScale();

    // Received data
    let titles = new TitleData();

    // Selected series
    let serieNameX = null;
    let serieNameY = null;
    let serieValuesX = [];
    let serieValuesY = [];

    // Subset to render according to range selector
    let subset = [];
    let subsetX = [];
    let subsetY = [];

    // Graph controller
    let graphCtrl = {};

    // Tooltip
    const tooltip = new Tooltip()
    tooltip.body ( d =>
        `<div class="row row-cols-2">
            <div class="col">Vertical</div><div class="col">${d[2]}</div>
            <div class="col">Horizontal</div><div class="col">${d[1]}</div>
            <div class="col">Number of films</div><div class="col">${d[3]}</div>
        </div>`
    );

    // SVG initialisation
    const graphparent = d3.select("#graph-goes-here");
    const svg = graphparent.append("svg")
        .attr("width", width)
        .attr("height", height)
        .style("fill", "currentColor")
        .style("background-color", "#333")

    const graph = svg.append("g")
        .attr("transform", "translate(" + margin.left + "," + margin.top + ")");
    const gx = graph.append("g");
    const gy = graph.append("g");

    const selectorparent = d3.select("#range-selector-goes-here");
    const embeddedselector = selectorparent.empty();
    const minimap = selectorparent.append("svg")
        .attr("visible",embeddedselector)
        .style("fill", "currentColor")
        .style("background-color", "#333")

    const selectorW = svg.node() ? svg.node().parentNode.getClientRects()[0].width/3 : 50;
    const xminiscale = d3.scaleBand().range([0, selectorW]);
    const yminiscale = d3.scaleBand().range([selectorW, 0]);
    const rangeSel = rangeSelectorXY (minimap, selectorW, selectorW )
        .onMoved( (pt1, pt2) => {
            subsetX = [];
            subsetY = [];
            let inRangeX = false;
            serieValuesX.forEach(x => {
                if (x==pt1[0]) inRangeX=true;
                if (x==pt2[0]) inRangeX=false;
                if (inRangeX) subsetX.push(x);
            });
            let inRangeY = false;
            serieValuesY.forEach(y => {
                if (y==pt2[1]) inRangeY=true;
                if (y==pt1[1]) inRangeY=false;
                if (inRangeY) subsetY.push(y);
            });
            graphCtrl.subsetChanged();
            graphCtrl.update();
        });
    svg.on("wheel", rangeSel.onWheel());

    /**
     * Update graphics.
     */
    graphCtrl.update = function () {
        const transition = d3.transition().duration(500);

        // Updates X scale
          gx.attr("transform", `translate(0,${ploth})`)
            .transition(transition)
            .call(xAxis)
            .selectAll("text")
            .attr("transform", "translate(-10,0)rotate(-45)")
            .style("text-anchor", "end");

        // Updates Y scale according to new data
          gy.attr("transform", "translate(0,0)")
            .transition(transition)
            .call(yAxis)

        // Update heatmap
        graph.selectAll(".dot")
            .data(subset, d=> d[0])
            .join(enter =>
                enter.append("rect")
                .attr("x", d => xscale(d[1])+xscale.bandwidth()/2)
                .attr("y", d => yscale(d[2])+yscale.bandwidth()/2)
                .attr("fill-opacity", "100%")
                .classed("dot", true)
                .on("mouseover", tooltip.show())
            )
            .attr("fill", d => serieColor(d[3]))
            .transition(transition)
            .attr("x", d => xscale(d[1]))
            .attr("y", d => yscale(d[2]))
            .attr("width", xscale.bandwidth())
            .attr("height", yscale.bandwidth())
            ;
        console.log(`${logDate()} main map updated`);
    }

    graphCtrl.updateMinimap = function () {
        // Update heatmap
        minimap.selectAll(".minidot")
            .data(subset, d=> d[0])
            .join(enter =>
                enter.append("rect")
                .attr("x", d => xminiscale(d[1])+xminiscale.bandwidth()/2)
                .attr("y", d => yminiscale(d[2])+yminiscale.bandwidth()/2)
                .attr("fill-opacity", "100%")
                .classed("minidot", true)
            )
            .attr("fill", d => serieColor(d[3]))
            .attr("x", d => xminiscale(d[1]))
            .attr("y", d => yminiscale(d[2]))
            .attr("width", xminiscale.bandwidth())
            .attr("height", yminiscale.bandwidth())
            ;
        rangeSel.raise();
        console.log(`${logDate()} minimap updated`);
    }

    /**
     * Update subset according to 2D selector.
     * 
     * @param {*} xkeyset Values on X
     * @param {*} ykeyset Values on Y
     */
    graphCtrl.subsetChanged = function() {
        xscale.domain(subsetX);
        yscale.domain(subsetY);
        xminiscale.domain(subsetX);
        yminiscale.domain(subsetY);

        let max = 0;
        subset = [];
        subsetX.forEach(x => {
            const films = Array.from(titles.series(serieNameX).get(x).values());
            subsetY.forEach(y => {
                const commons = films.filter(f => f.get(serieNameY).has(y));
                max = (commons.length<max) ? max : commons.length;
                if ( commons.length>0 ) subset.push([`${x}:${y}`,x,y,commons.length]);
            });
        });
        console.log(`${logDate()} Subset changed`);
        return max;
    }

    const sortAlphaSeries = [
        "Year", "IMDb rating", "Rotten Tomatoes rating", "IMDb ID", "TMDB ID", "Runtime"
    ];
    /**
     * Update series according to series selectors
     */
    graphCtrl.seriesChanged = function() {
        const unorderedSerieValuesX = titles.series(serieNameX);
        const unorderedSerieValuesY = titles.series(serieNameY);
        const xkeyset = Array.from(unorderedSerieValuesX.keys());
        const ykeyset = Array.from(unorderedSerieValuesY.keys());

        if ( sortAlphaSeries.includes(serieNameX) ) subsetX = xkeyset.sort((a,b) => compareAlphanumeric(a,b));
        else subsetX = xkeyset.sort((a,b) => unorderedSerieValuesX.compareElementByCount(a,b));

        if ( sortAlphaSeries.includes(serieNameY) ) subsetY = ykeyset.sort((a,b) => compareAlphanumeric(a,b));
        else subsetY = ykeyset.sort((a,b) => unorderedSerieValuesY.compareElementByCount(a,b));

        subsetX = (subsetX.length>maxStopsX) ? subsetX.slice(-maxStopsX) : subsetX;
        subsetY = (subsetY.length>maxStopsY) ? subsetY.slice(-maxStopsY) : subsetY;

        console.log(`${logDate()} Series changed`);

        serieValuesX = subsetX;
        serieValuesY = subsetY;

        rangeSel.scaleX().domain(serieValuesX);
        rangeSel.scaleY().domain(serieValuesY);
        rangeSel.move([serieValuesX[0], serieValuesY[serieValuesY.length-1]], [serieValuesX[serieValuesX.length-1], serieValuesY[0]]);
        console.log(`${logDate()} Range selector initialized`);

        const max = graphCtrl.subsetChanged();
        serieColor.count(max);
        graphCtrl.update();
        graphCtrl.updateMinimap();
    }

    onChangeSerieX = function(value) {
        const changed = value!=serieNameX;
        serieNameX = value;
        if (changed) graphCtrl.seriesChanged();
    }

    onChangeSerieY = function(value) {
        const changed = value!=serieNameY;
        serieNameY = value;
        if (changed) graphCtrl.seriesChanged();
    }

    onChangeMaxAxisStopsX = function(value) {
        const changed = value!=maxStopsX;
        maxStopsX = value;
        if (changed) graphCtrl.seriesChanged();
    }

    onChangeMaxAxisStopsY = function(value) {
        const changed = value!=maxStopsY;
        maxStopsY = value;
        if (changed) graphCtrl.seriesChanged();
    }

    // Graph initialisation from data
    const dataPath = `/stats/${datatype}.json`;
    console.log(`${logDate()} Request ${dataPath}`);
    d3.json(dataPath)
        .then(function (content) {
            console.log(`${logDate()} Received data set ${dataPath} with ${content.data.length} elements`);

            serieNameX = defaultSerieX;
            serieNameY = defaultSerieY;

            titles.parse(content);
            console.log(`${logDate()} Data parsed`);

            titles.columns().forEach( (c,i) => {
                d3.select("#selectorX")
                    .append("option")
                    .text(c)
                    .call(function(s) { if(c==defaultSerieX) s.attr("selected","true") });
                d3.select("#selectorY")
                    .append("option")
                    .text(c)
                    .call(function(s) { if(c==defaultSerieY) s.attr("selected","true") });
            });
            d3.select("#selectorX")
                .attr("onchange", "onChangeSerieX(this.value);");
            d3.select("#selectorY")
                .attr("onchange", "onChangeSerieY(this.value);");
            d3.select("#maxStopsX")
                .property("value", maxStopsX)
                .attr("onchange", "onChangeMaxAxisStopsX(this.value);");
            d3.select("#maxStopsY")
                .property("value", maxStopsY)
                .attr("onchange", "onChangeMaxAxisStopsY(this.value);");

            graphCtrl.seriesChanged();
        });
}
