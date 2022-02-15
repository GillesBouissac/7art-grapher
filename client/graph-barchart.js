const range = (s, e) => e > s ? [s, ...range(s + 1, e)] : [s];

const plotBarchart = function ( datatype, width, height, sortColumn, displayColumn, start, end ) {

    width = width==null ? window.innerWidth : width;
    height = height==null ? window.innerHeight : height;
    sortColumn = sortColumn==null ? null : sortColumn;
    displayColumn = displayColumn==null || displayColumn<1 ? null : displayColumn;

    // set the dimensions and margins of the graph
    const margin = { top: 10, right: 10, bottom: 80, left: 60 },
        plotw = width - margin.left - margin.right,
        ploth = height - margin.top - margin.bottom;

    // Create X axis scale
    const x = d3.scaleBand().padding(0.5);
    const xAxis = d3.axisBottom(x);

    // Create sub X to shift bars on the same X value
    const sx = d3.scaleBand().range([-1, 1]);

    // Create Y axis scale
    const y = d3.scaleLinear();
    const yAxis = d3.axisLeft(y);

    // Colors for series
    const serieColor = d3.scaleOrdinal().range(d3.schemeSpectral[10])

    // The list of columns will not change
    let columns = [];
    let data = [];
    let subset = [];
    let graphCtrl = {};

    // SVG initialisation
    const graphparent = d3.select("#graph-goes-here");
    const svg = graphparent.append("svg")
        .attr("width", width)
        .attr("height", height)
    const graph = svg.append("g")
        .attr("transform", "translate(" + margin.left + "," + margin.top + ")");
    const gx = graph.append("g");
    const gy = graph.append("g");

    const legendparent = d3.select("#legend-goes-here");
    const embeddedlegend = legendparent.empty();
    const legendsvg = embeddedlegend ? svg : legendparent.append("svg");
    const legend = interactiveLegend(legendsvg,embeddedlegend?100:0,0)
        .onSelectionChanged( newSelection => {
            displayColumn=columns.map( (e,i) => newSelection.includes(e) ? i : 0 );
            graphCtrl.update(subset);
        })
        .onEndRendering( bbox => {
            if(!embeddedlegend) { legendsvg
                .attr("width", bbox.x+bbox.width)
                .attr("height", bbox.y+bbox.height)
            }
        });

    const selectorparent = d3.select("#range-selector-goes-here");
    const embeddedselector = selectorparent.empty();
    const selectorsvg = selectorparent.append("svg").attr("visible",embeddedselector);
    const rangeSel = rangeSelector (selectorsvg)
        .onMoved( d => {
            const start = Math.floor(d[0]);
            const end = Math.floor(d[1]);
            if (sortColumn!=null && sortColumn>0) subset = data.sort( (a,b) => b[sortColumn]-a[sortColumn]).slice(start,end)
            else subset = data.slice(start,end)
            graphCtrl.update(subset);
        });

    graphCtrl.update = function ( subset ) {
        const keys = subset.map(e => e[0]);
        let columnsIndexes = [];
        if ( displayColumn==null || displayColumn<1 || displayColumn>columns.length-1 ) {
            columnsIndexes = range(1,columns.length-1);
        }
        else if ( Array.isArray(displayColumn) ) {
            columnsIndexes = displayColumn.filter( e => e>=1 && e<=columns.length-1);
        }
        else {
            columnsIndexes = [ displayColumn ];
        }
        const visibleColumns = columnsIndexes.map( i => columns[i]);
        const series = columnsIndexes.map( i => {
            const values = subset.map( d => d[i]);
            const tuples = subset.map( d => [d[0], d[i], columns[i]]);
            return [i, tuples, Math.max( ...values ) ];
        } );
        const maxy = 1.1 * Math.max( ...series.map(s => s[2]) );

        const transition = d3.transition().duration(500);

        // Updates X scale
           x.range([0, plotw])
            .domain(keys);
          gx.attr("transform", "translate(0," + ploth + ")")
            .transition(transition)
            .call(xAxis)
            .selectAll("text")
            .attr("transform", "translate(-10,0)rotate(-45)")
            .style("text-anchor", "end");

        // Updates sub X scale
            sx.domain(visibleColumns);

        // Updates Y scale according to new data
           y.domain([0, maxy])
            .range([ploth, 0]);
          gy.attr("transform", "translate(0,0)")
            .transition(transition)
            .call(yAxis)

        // Updates Series
        const gs = graph.selectAll(".series")
            .data(series, s=>s[0])
            .join("g")
            .classed("series", true);

        // Updates Bars into series
        gs.selectAll(".bars")
            .data(s=>s[1], d=>d[0])
            .join(enter => enter.append("rect")
                .attr("x", function (d) { return x(d[0])+x.bandwidth()*sx(d[2]); })
                .attr("y", function (d) { return ploth; })
                .attr("width", 0)
                .attr("height", 0)
            )
            .classed("bars", true)
            .transition(transition)
            .attr("x", function (d) { return x(d[0])+x.bandwidth()*sx(d[2]); })
            .attr("y", function (d) { return y(d[1]); })
            .attr("width", x.bandwidth()*1.8/columnsIndexes.length)
            .attr("height", function (d) { return ploth - y(d[1]); })
            .attr("fill", function(d){return serieColor(d[2]) })
            .attr("fill-opacity", "100%");

        legend.update(visibleColumns, serieColor);
    }

    // Graph initialisation from data
    const dataPath = `/stats/${datatype}.json`;
    d3.json(dataPath)
        .then(function (content) {

            console.log(`Received data set ${dataPath} with ${content.data.length} elements`);

            columns = content.columns;
            data = content.data;
            serieColor.domain(columns);
            legend.allseries(columns.slice(1));
            legend.allcolors(serieColor);
            rangeSel.domain([0,data.length-1]);

            // Rescaling IMDb ratings
            const imdbpattern = "(Average|Minimum|Maximum).*IMDb.*rating"
            const imdbratingCols = columns.map((c,i) => [c,i]).filter(e => e[0].match(imdbpattern) );
            data.forEach( e => imdbratingCols.forEach(i => e[i[1]]*=10) );

            end = (end==null||end>data.length) ? data.length : end;
            start = start==null ? 0 : parseInt(start,10);
            start = start<0 ? (data.length + start) : start;
            if (sortColumn!=null && sortColumn>0) subset = data.sort( (a,b) => b[sortColumn]-a[sortColumn]).slice(start,end)
            else subset = data.slice(start,end)
            rangeSel.move([start,end-1]);
            graphCtrl.update(subset);
        });

}
