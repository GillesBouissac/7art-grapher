// @ts-check

import * as d3 from "https://cdn.skypack.dev/d3@7";
import { colorScale, logDate } from "./lib/util.js";
import { Tooltip } from "./lib/tooltip.js";
import { TitleData, Serie } from "./lib/title.js";
import { rangeSelectorXY } from "./lib/range-selector.js";
import params from "./parameters.js";

export { plotHeatmap };

/**
 * Constructs the heatmap data and graphics.
 * 
 * @param {string} datatype 
 * @param {number} width 
 * @param {number} height 
 */
const plotHeatmap = function ( width, height, maxStopsX, maxStopsY ) {

    width     = isNaN(parseInt(width,10)) ? window.innerWidth : parseInt(width,10);
    height    = isNaN(parseInt(height,10)) ? window.innerHeight : parseInt(height,10);
    maxStopsX = isNaN(parseInt(maxStopsX,10)) ? 500 : parseInt(maxStopsX,10);
    maxStopsY = isNaN(parseInt(maxStopsY,10)) ? 500 : parseInt(maxStopsY,10);

    const datasetUrl = params.databaseLocation;

    // Default selected series
    const defaultSerieX = "Year";
    const defaultSerieY = "Countries";

    // set the dimensions and margins of the graph
    const margin = { top: 10, right: 10, bottom: 80, left: 130 },
        plotw = width - margin.left - margin.right,
        ploth = height - margin.top - margin.bottom;
    const fontSize = 10;

    // Create X axis scale
    const xscale = d3.scaleBand().range([0, plotw]).padding(0.05);
    const xAxis = d3.axisBottom(xscale);

    // Create Y axis scale
    const yscale = d3.scaleBand().range([ploth, 0]).padding(0.05);
    const yAxis = d3.axisLeft(yscale);

    // Colors for series
    const serieColor = colorScale();

    // Initial sort criteria
    const defaultSortCriteria = Serie.SortCriterionCount;

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
    const tooltip = new Tooltip();
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
        .style("background-color", "#333");

    const graph = svg.append("g")
        .attr("transform", "translate(" + margin.left + "," + margin.top + ")");
    const gx = graph.append("g");
    const gy = graph.append("g");

    const selectorparent = d3.select("#range-selector-goes-here");
    const embeddedselector = selectorparent.empty();
    const minimap = selectorparent.append("svg")
        .attr("visible",embeddedselector)
        .style("fill", "currentColor")
        .style("background-color", "#333");

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
            .call(yAxis);

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
    };

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
            .attr("height", yminiscale.bandwidth());
        rangeSel.raise();
        console.log(`${logDate()} minimap updated`);
    };

    /**
     * Update subset according to 2D selector.
     * 
     * @returns {number} Maximum cell value for this subset.
     */
    graphCtrl.subsetChanged = function() {
        xscale.domain(subsetX);
        yscale.domain(subsetY);
        xminiscale.domain(subsetX);
        yminiscale.domain(subsetY);

        // reduces the number of X axis ticks to avoid overlap
        let bwCount = Math.ceil(fontSize/xscale.bandwidth());
        let ticks = subsetX.filter(function(v, i) { return i % bwCount === 0; });
        xAxis.tickValues(ticks);

        // reduces the number of Y axis ticks to avoid overlap
        bwCount = Math.ceil(fontSize/yscale.bandwidth());
        ticks = subsetY.filter(function(v, i) { return i % bwCount === 0; });
        yAxis.tickValues(ticks);

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
    };

    /**
     * Returns the list of serie elements sorted according to selected criteria
     * 
     * @param {string} serieName The serie to sort
     * @returns {string[]} Sorted serie elements values list 
     */
    const sortedSerieElements = function(serieName) {
        const allValues = titles.series(serieName);
        const keyset = Array.from(allValues.keys());
        const criteria = Object.prototype.hasOwnProperty.call(Serie.SortCriteria,serieName) ? Serie.SortCriteria[serieName] : [defaultSortCriteria];

        let result = 0;
        return keyset.sort(function(a,b){
            const ela = allValues.get(a);
            const elb = allValues.get(b);
            for (let criterion of criteria) {
                result = ela.compareBySerie(criterion, elb);
                if (result!=0) break;
            }
            return result;
        });
    };

    /**
     * Update series according to series selectors
     */
    graphCtrl.seriesChanged = function() {
        subsetX = sortedSerieElements(serieNameX);
        subsetX = (subsetX.length>maxStopsX) ? subsetX.slice(-maxStopsX) : subsetX;

        subsetY = sortedSerieElements(serieNameY);
        subsetY = (subsetY.length>maxStopsY) ? subsetY.slice(-maxStopsY) : subsetY;

        serieValuesX = subsetX;
        serieValuesY = subsetY;

        console.log(`${logDate()} Series changed`);

        rangeSel.scaleX().domain(serieValuesX);
        rangeSel.scaleY().domain(serieValuesY);
        rangeSel.move([serieValuesX[0], serieValuesY[serieValuesY.length-1]], [serieValuesX[serieValuesX.length-1], serieValuesY[0]]);
        console.log(`${logDate()} Range selector initialized`);

        const max = graphCtrl.subsetChanged();
        serieColor.count(max);
        graphCtrl.update();
        graphCtrl.updateMinimap();
    };

    const onChangeSortX = function() {
        if (!Object.prototype.hasOwnProperty.call(Serie.SortCriteria,serieNameX)) {
            Serie.SortCriteria[serieNameX] = [];
        }
        const changed = Serie.SortCriteria[serieNameX][0] != this.value;
        Serie.SortCriteria[serieNameX][0] = this.value;
        if (changed) graphCtrl.seriesChanged();
    };

    const onChangeSortY = function() {
        if (!Object.prototype.hasOwnProperty.call(Serie.SortCriteria,serieNameY)) {
            Serie.SortCriteria[serieNameY] = [];
        }
        const changed = Serie.SortCriteria[serieNameY][0] != this.value;
        Serie.SortCriteria[serieNameY][0] = this.value;
        if (changed) graphCtrl.seriesChanged();
    };

    const onChangeSerieX = function() {
        const changed = this.value!=serieNameX;
        serieNameX = this.value;
        if (changed) graphCtrl.seriesChanged();
    };

    const onChangeSerieY = function() {
        const changed = this.value!=serieNameY;
        serieNameY = this.value;
        if (changed) graphCtrl.seriesChanged();
    };

    const onChangeMaxAxisStopsX = function() {
        const changed = this.value!=maxStopsX;
        maxStopsX = this.value;
        if (changed) graphCtrl.seriesChanged();
    };

    const onChangeMaxAxisStopsY = function() {
        const changed = this.value!=maxStopsY;
        maxStopsY = this.value;
        if (changed) graphCtrl.seriesChanged();
    };

    // Graph initialisation from data
    console.log(`${logDate()} Request ${datasetUrl}`);
    d3.json(datasetUrl)
        .then(function (content) {
            console.log(`${logDate()} Received data set ${datasetUrl} with ${content.data.length} elements`);

            serieNameX = defaultSerieX;
            serieNameY = defaultSerieY;

            titles.parse(content);

            d3.select("#sortX1").append("option").text(Serie.SortCriterionNone)
                .call(function(s) { if(Serie.SortCriteria[serieNameX] && Serie.SortCriteria[serieNameX].includes(Serie.SortCriterionNone)) s.attr("selected","true"); });
            d3.select("#sortX1").append("option").text(Serie.SortCriterionKey)
                .call(function(s) { if(Serie.SortCriteria[serieNameX] && Serie.SortCriteria[serieNameX].includes(Serie.SortCriterionKey)) s.attr("selected","true"); });
            d3.select("#sortX1").append("option").text(Serie.SortCriterionCount)
                .call(function(s) { if(!Serie.SortCriteria[serieNameX] || Serie.SortCriteria[serieNameX].includes(Serie.SortCriterionCount)) s.attr("selected","true"); });
            d3.select("#sortY1").append("option").text(Serie.SortCriterionNone)
                .call(function(s) { if(Serie.SortCriteria[serieNameY] && Serie.SortCriteria[serieNameY].includes(Serie.SortCriterionNone)) s.attr("selected","true"); });
            d3.select("#sortY1").append("option").text(Serie.SortCriterionKey)
                .call(function(s) { if(Serie.SortCriteria[serieNameY] && Serie.SortCriteria[serieNameY].includes(Serie.SortCriterionKey)) s.attr("selected","true"); });
            d3.select("#sortY1").append("option").text(Serie.SortCriterionCount)
                .call(function(s) { if(!Serie.SortCriteria[serieNameY] || Serie.SortCriteria[serieNameY].includes(Serie.SortCriterionCount)) s.attr("selected","true"); });
            titles.columns().forEach( (c) => {
                d3.select("#selectorX").append("option").text(c)
                    .call(function(s) { if(c==defaultSerieX) s.attr("selected","true"); });
                d3.select("#selectorY").append("option").text(c)
                    .call(function(s) { if(c==defaultSerieY) s.attr("selected","true"); });
                if (Serie.getType(c)!=Serie.TypeNull) {
                    d3.select("#sortX1").append("option").text(c)
                        .call(function(s) { if(Serie.SortCriteria[serieNameX] && Serie.SortCriteria[serieNameX].includes(c)) s.attr("selected","true"); });
                    d3.select("#sortY1").append("option").text(c)
                        .call(function(s) { if(Serie.SortCriteria[serieNameY] && Serie.SortCriteria[serieNameY].includes(c)) s.attr("selected","true"); });
                }
            });
            d3.select("#maxStopsX")
                .property("value", maxStopsX);
            d3.select("#maxStopsY")
                .property("value", maxStopsY);

            d3.select("#sortX1").on("change", onChangeSortX);
            d3.select("#sortY1").on("change", onChangeSortY);
            d3.select("#selectorX").on("change", onChangeSerieX);
            d3.select("#selectorY").on("change", onChangeSerieY);
            d3.select("#maxStopsX").on("change", onChangeMaxAxisStopsX);
            d3.select("#maxStopsY").on("change", onChangeMaxAxisStopsY);

            graphCtrl.seriesChanged();
        });
};
