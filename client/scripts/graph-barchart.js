

const plotBarchart = function ( datatype, width, height, sortColumn, displayColumn, start, end ) {

    width = width==null ? window.innerWidth : width;
    height = height==null ? window.innerHeight : height;
    sortColumn = sortColumn==null ? null : sortColumn;
    displayColumn = displayColumn==null || displayColumn<1 ? null : displayColumn;

    // set the dimensions and margins of the graph
    const margin = { top: 10, right: 10, bottom: 110, left: 80 },
        plotw = width - margin.left - margin.right,
        ploth = height - margin.top - margin.bottom;

    // Create X axis scale
    const xscale = d3.scaleBand().padding(0.5);
    const xAxis = d3.axisBottom(xscale);

    // Create sub X to shift bars on the same X value
    const sx = d3.scaleBand().range([-1, 1]);

    // Create Y axis scale
    const yscale = d3.scaleLinear();
    const yAxis = d3.axisLeft(yscale);

    // Colors for series
    const serieColor = colorScale();

    // The list of columns will not change
    let columns = [];
    let data = [];
    let dataSorted = [];
    let subset = [];
    let xkeys = [];
    let graphCtrl = {};

    // Tooltip
    const tooltip = new Tooltip();
    tooltip.body ( d =>
        `<div class="row row-md-2 text-nowrap">
            <div class="col-4">Serie</div><div class="col-6">${d[2]}</div>
            <div class="col-4">Vertical</div><div class="col-6">${d[1]}</div>
            <div class="col-4">Horizontal</div><div class="col-6">${d[0]}</div>
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

    const legendparent = d3.select("#legend-goes-here");
    const embeddedlegend = legendparent.empty();
    const legendsvg = embeddedlegend ? svg : legendparent.append("svg")
        .style("fill", "currentColor")
        .style("background-color", "#333")

    const legend = interactiveLegend(legendsvg,embeddedlegend?200:0,0)
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
    const selectorsvg = selectorparent.append("svg")
        .attr("visible",embeddedselector)
        .style("fill", "currentColor")
        .style("background-color", "#333")

    const rangeSel = rangeSelectorX (selectorsvg, selectorsvg.node() ? selectorsvg.node().parentNode.getClientRects()[0].width : 0, 40)
        .onMoved( d => {
            const start = dataSorted.findIndex(e => e[0]==d[0]);
            const end = dataSorted.findIndex(e => e[0]==d[1]);
            subset = dataSorted.slice(start,end)
            xkeys = subset.map(e => e[0]);
            graphCtrl.update(subset);
        });

    graphCtrl.update = function ( subset ) {
        console.log(`${logDate()} Subset changed`);
        let columnsIndexes = [];
        if ( displayColumn==null || displayColumn<1 || displayColumn>columns.length-1 ) {
            columnsIndexes = d3.range(1,columns.length);
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
        xscale.range([0, plotw])
              .domain(xkeys);
            gx.attr("transform", "translate(0," + ploth + ")")
              .transition(transition)
              .call(xAxis)
              .selectAll("text")
              .attr("transform", "translate(-10,0)rotate(-45)")
              .style("text-anchor", "end");

        // Updates sub X scale
            sx.domain(visibleColumns);

        // Updates Y scale according to new data
        yscale.domain([0, maxy])
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
                .attr("x", function (d) { return xscale(d[0])+xscale.bandwidth()*sx(d[2]); })
                .attr("y", function (d) { return ploth; })
                .attr("width", 0)
                .attr("height", 0)
                .on("mouseover", tooltip.show())
            )
            .classed("bars", true)
            .transition(transition)
            .attr("x", function (d) { return xscale(d[0])+xscale.bandwidth()*sx(d[2]); })
            .attr("y", function (d) { return yscale(d[1]); })
            .attr("width", xscale.bandwidth()*1.8/columnsIndexes.length)
            .attr("height", function (d) { return ploth - yscale(d[1]); })
            .attr("fill", function(d){return serieColor(d[2]) })
            .attr("fill-opacity", "100%");

        legend.update(visibleColumns, serieColor);
        console.log(`${logDate()} Updated`);
    }

    // Graph initialisation from data
    const dataPath = `/stats/${datatype}.json`;
    console.log(`${logDate()} Request ${dataPath}`);
    d3.json(dataPath)
        .then(function (content) {
            console.log(`${logDate()} Received data set ${dataPath} with ${content.data.length} elements`);

            columns = content.columns;
            data = content.data;
            dataSorted = (sortColumn!=null && sortColumn>0) ? data.sort( (a,b) => b[sortColumn]-a[sortColumn]) : data;
            serieColor.domain(columns);
            legend.allseries(columns.slice(1));
            legend.allcolors(serieColor);
            rangeSel.scale().domain(dataSorted.map(e => e[0]));

            // Rescaling IMDb ratings
            const imdbpattern = "(Average|Minimum|Maximum).*IMDb.*rating"
            const imdbratingCols = columns.map((c,i) => [c,i]).filter(e => e[0].match(imdbpattern) );
            data.forEach( e => imdbratingCols.forEach(i => e[i[1]]*=10) );

            end = (end==null||end>data.length) ? data.length : end;
            start = start==null ? 0 : parseInt(start,10);
            start = start<0 ? (data.length + start) : start;

            subset = dataSorted.slice(start,end)
            xkeys = subset.map(e => e[0]);

            rangeSel.move([ dataSorted[start][0], dataSorted[end-1][0] ]);
            graphCtrl.update(subset);
        });

}
