import * as d3 from "https://cdn.skypack.dev/d3@7";
import { logDate, absoluteUrl } from "./util.js";
import { TitleData, Serie, SerieElement } from "./title.js";
import params from "./parameters.js";

export { localSearch };

/**
 * Returns a search manager for data in the client data model.
 * 
 * @returns {SearchManager} The new search manager
 */
const localSearch = function() {
    return new SearchManager();
};

/**
 * Note: regex<xxx> fields must have "regex" in their name
 * this is used to filter them out when serialising.
 * 
 * @typedef {object} FilterParameters
 * @property {string} type Filter type, one of Serie.Type<xxx>
 * @property {string} criterion Filter criterion
 * @property {string} value User input value for a text filter
 * @property {number} min Filter min value for a numeric filter
 * @property {number} max Filter max value for a numeric filter
 * @property {RegExp} regex Pattern for a text filter
 * @property {number} regexStartIdx Index of the first (unmatching) group in pattern
 * @property {number} regexMatchIdx Index of the first (matching) group in pattern
 * @property {number} regexEndIdx Index of the third (unmatching) group in pattern
 */

/**
 * Class for HTML filter elements management.
 */
class SearchManager {
    static DATA_DEFAULT = "Film";
    static MAX_SEARCH_RESULT = 100;
    static CARDS_PER_PAGE = 50;

    constructor() {
        /** @type {TitleData} */
        this.data = new TitleData();
        /** @type {Map<string,FilterParameters>} */
        this.activeFilters = new Map();
        /** @type {string} */
        this.dataType = SearchManager.DATA_DEFAULT;
        /** @type {d3.selection} */
        this.activeFilterContainer = d3.select("#activeFilterContainer");
        this.activeFilterTemplate = d3.select("#Templates").select(".activeFilterTemplate");
        this.cardContainer = d3.select("#cardContainer");
        this.cardTemplate = d3.select("#Templates").select(".cardTemplate");
        this.resultCache = null;
        this.restore();
    }

    dataReceived(content) {
        this.data.parse(content);
    }

    start() {
        // Graph initialisation from data
        const _this = this;
        const dataPath = params.databaseLocation;
        console.log(`${logDate()} Request ${dataPath}`);
        d3.json(dataPath)
            .then(function (content) {
                _this.dataReceived(content);
                _this.activateDisplay();
            });
    }

    /**
     * Reset display
     */
    reset() {
        for ( let key of this.activeFilters.keys() ) {
            this.deleteHtmlActiveFilter(key);
        }
        this.activeFilters = new Map();
        this.dataType = SearchManager.DATA_DEFAULT;
    }

    /**
     * Save filters context to localStorage
     */
    save() {
        let persistentData = {
            dataType: this.dataType,
            activeFilters: {}
        };
        for ( let key of this.activeFilters.keys() ) {
            persistentData.activeFilters[key] = this.activeFilters.get(key);
        }
        const persistentDataStr = JSON.stringify(persistentData, (k,v) => k.includes("regex")?undefined:v);
        localStorage.setItem("filmSearchContext",persistentDataStr);
    }

    /**
     * Restore filters from localStorage
     */
    restore() {
        this.reset();
        const persistentDataStr = localStorage.getItem("filmSearchContext");
        if (persistentDataStr) {
            try {
                const persistentData = JSON.parse(persistentDataStr);
                this.dataType = persistentData.dataType;
                for ( let key of Object.keys(persistentData.activeFilters) ) {
                    const f = persistentData.activeFilters[key];
                    if (f.type==Serie.TypeString) {
                        this.activeFilters.set(key, this.createStringFilter(f.criterion,f.value));
                    }
                    else if (f.type==Serie.TypeNumber) {
                        this.activeFilters.set(key, this.createIntRangeFilter(f.criterion,f.min,f.max));
                    }
                }
                for ( let key of this.activeFilters.keys() ) {
                    this.addHtmlActiveFilter(key);
                }
                this.updateHtmlResults();
            } catch (error) {
                // Ignore filter restore
            }
        }
    }

    /**
     * Build a copyLink button handler bound to this object
     * 
     * @returns {Function} Callback for "click" event
     */
    onCopyLinks() {
        const _this = this;
        /** The copyLink button handler */
        return function() {
            if (_this.resultCache) {
                const urls = [];
                _this.resultCache.forEach(se => {
                    const vars = _this.buildPatternVariables(se);
                    const imgUrl = _this.buildDetailUrl(_this.dataType, vars);
                    if (imgUrl) urls.push(imgUrl);
                });
                navigator.clipboard
                    .writeText(urls.join("\n"))
                    .then(function() {
                        console.log("Links copied to clipboad");
                    }, function() {
                        console.log("Error copying links");
                    });
            }
            else {
                console.log("No result to copy to clipboard");
            }
        };
    }

    /**
     * Build a data selection change handler bound to this object
     * 
     * @returns {Function} Callback for "click" event on DOM Element
     */
    onDataTypeChanged() {
        const _this = this;
        /** The data selection change handler */
        return function() {
            _this.dataType = this.value;
            _this.save();
            _this.updateHtmlResults();
        };
    }

    /**
     * Build a new filter type selection change handler bound to this object
     * 
     * @returns {Function} Callback for "click" event on DOM Element
     */
    onFilterTypeChanged() {
        const _this = this;
        /** The filter type selector change handler */
        return function() {
            _this.updateHtmlFilterAdd();
        };
    }

    /**
     * Build a filter add button handler bound to this object
     * 
     * @returns {Function} Callback for "click" event on DOM Element
     */
     onFilterAdd() {
        const _this = this;
        /** The filter add button handler */
        return function() {
            const filterData = _this.getNewFilterHtml();
            if ( filterData ) {
                const newFilterKey = _this.activeFilters.size;
                _this.activeFilters.set(newFilterKey, filterData);
                _this.addHtmlActiveFilter(newFilterKey);
                _this.save();
                _this.updateHtmlResults();
                _this.clearHtmlFilterAdd();
            }
        };
    }

    /**
     * Build a delete button handler bound to this object
     * 
     * @returns {Function} Callback for "click" event on DOM Button
     */
    onFilterDelete() {
        const _this = this;
        /** The filter delete button handler */
        return function() {
            this._filterData.parentSelection.remove();
            _this.activeFilters.delete(this._filterData.newFilterKey);
            _this.save();
            _this.updateHtmlResults();
        };
    }

    /**
     * Build a enter search text field handler bound to this object.
     * 
     * @returns {Function} Callback for "click" event on DOM Element
     */
    onEnterFilterSearch() {
        const _this = this;
        /**
         * The enter focus handler in search text field.
         * Opens the dropdown and initialize it with data matching the search text
         */
        return function() {
            const dropdown = d3.select("#newFilterSearchList");
            dropdown.classed("show", true);
            _this.refreshHtmlSearchList();
        };
    }

    /**
     * Build a leave search text field handler bound to this object.
     * 
     * @returns {Function} Callback for "click" event on DOM Element
     */
    onLeaveFilterSearch() {
        /**
         * The leave focus handler from search text field.
         * Closes the dropdown
         */
        return function() {
            const dropdown = d3.select("#newFilterSearchList");
            dropdown.classed("show", false);
        };
    }

    /**
     * Build a search text changed handler bound to this object.
     * 
     * @returns {Function} Callback for "click" event on DOM Element
     */
    onSearchTextChanged() {
        const _this = this;
        /**
         * The enter focus handler in search text field.
         * Opens the dropdown and initialize it with data matching the search text
         */
        return function() {
            _this.refreshHtmlSearchList();
        };
    }

    /**
     * Build a choosen filter handler bound to this object.
     * 
     * @returns {Function} Callback for "click" event on DOM Element
     */
     onSearchListElementChoosen() {
        /**
         * Copy the choosen element to the main text field.
         * 
         * @param {d3.event} e Event
         * @param {string} d Selected text
         */
        return function(e,d) {
            d3.select("#newFilterSearchText").property("value",d);
        };
    }

    /**
     * Retrieves the films that matches every filters (AND)
     * 
     * @returns {SerieElement} Matching data
     */
    getFilteredData() {
        const filters = [...this.activeFilters.values()];
        let serieElements = [...this.data.series(this.dataType).values()];
        return serieElements.filter(se => {
            const films = [...se.values()];
            return filters.every(flt =>{
                return films.filter(film => {
                    const values = [...film.get(flt.criterion).keys()];
                    return values.filter(v=>{
                        let match = false;
                        if (flt.type==Serie.TypeString) {
                            match = flt.regex.test(v);
                        }
                        else if (flt.type==Serie.TypeNumber) {
                            const fv = parseFloat(v);
                            match = isNaN(fv) ? false : (flt.min<=fv && fv<=flt.max);
                        }
                        return match;
                    }).length>0;
                }).length>0;
            });
        });
    }

    /**
     * Builds a list of variables to be used in patterns on data
     * 
     * @param {SerieElement} serieElement The source of data
     * @returns {object} The dictionary of extracted parameters
     */
    buildPatternVariables(serieElement) {
        let imdb = "";
        let tmdb = "";
        let year = "";
        const films = [...serieElement.values()];
        if (films.length==1) {
            imdb = films[0].get(Serie.Names.imdbId)?.values().next().value?.name();
            tmdb = films[0].get(Serie.Names.tmdbId)?.values().next().value?.name();
            year = films[0].get(Serie.Names.year)?.values().next().value?.name();
        }
        return {name:serieElement.name(),imdb:imdb?imdb:tmdb,tmdb:tmdb?tmdb:imdb,year:year};
    }

    /**
     * Builds the Image Url from the pattern for a given serie type
     * 
     * @param {string} serieName Serie name
     * @param {object} variables List of variables
     * @returns {string} The URL
     */
     buildImageUrl(serieName, variables) {
        const imgUrlPattern = Serie.PictureUrls[serieName];
        if (imgUrlPattern) {
            const resolver = new Function("return `"+imgUrlPattern.replaceAll("${","${this.") +"`;");
            return absoluteUrl(resolver.call(variables));
        }
        return null;
    }

    /**
     * Builds the Details Url from the pattern for a given serie type
     * 
     * @param {string} serieName Serie name
     * @param {object} variables List of variables
     * @returns {string} The URL
     */
    buildDetailUrl(serieName, variables) {
        const detailUrlPattern = Serie.DetailInformationUrls[serieName];
        if (detailUrlPattern) {
            const resolver = new Function("return `"+detailUrlPattern.replaceAll("${","${this.") +"`;");
            return absoluteUrl(resolver.call(variables));
        }
        return null;
    }

    /**
     * Creates a new Card to display the given SerieElement
     * 
     * @param {SerieElement} se The element do display on the card
     * @returns {d3.selection} The created card element
     */
    newHtmlCard(se) {
        const newCard = this.cardTemplate.clone(true).remove();
        const vars = this.buildPatternVariables(se);
        const imgUrl = this.buildImageUrl(this.dataType, vars);
        const detailUrl = this.buildDetailUrl(this.dataType, vars);
        newCard.selectAll(".cardTemplateTitle").text(se.name());
        if (imgUrl) {
            newCard.selectAll(".cardTemplateImage").attr("src", imgUrl);
        }
        if (detailUrl) {
            newCard.selectAll(".cardTemplateUrl").attr("href", detailUrl);
        }
        return newCard;
    }

    /**
     * Refreshes the result list.
     */
    updateHtmlResults() {
        this.resultCache = this.getFilteredData();
        const _this = this;
        this.cardContainer.selectAll(".cardTemplate")
            .data(_this.resultCache.slice(0,SearchManager.CARDS_PER_PAGE), se => se.name())
            .join(
                enter => enter
                    .append((se) => _this.newHtmlCard(se).node())
                    .style("display", "block")
            );
    }

    /**
     * Refreshes the search result list for a new filter.
     */
    refreshHtmlSearchList() {
        const flt = this.getNewFilterHtml();
        const listParent = d3.select("#newFilterSearchList");
        if (flt && flt.type==Serie.TypeString) {
            if (flt.regex) {
                const serie = this.data.series(flt.criterion);
                const serieVals = [...serie.keys()]
                    .filter(e => flt.regex.test(e))
                    .slice(0,SearchManager.MAX_SEARCH_RESULT);
                listParent.selectAll("li")
                    .data(serieVals)
                    .join("li")
                    .classed("dropdown-item", true)
                    .classed("text-truncate", true)
                    .on("mousedown.search-page", this.onSearchListElementChoosen())
                    .html(d => d.replace(flt.regex,
                        `$${flt.regexStartIdx}<strong class="text-danger">$${flt.regexMatchIdx}</strong>$${flt.regexEndIdx}`));
            }
        }
    }

    /**
     * Builds a new active filter given by its key in the GUI.
     * 
     * @param {number} filterKey Key of the filter to create
     */
    addHtmlActiveFilter(filterKey) {
        const htmlFilter = this.activeFilterTemplate
            .clone(true)
            .attr("filter-key", filterKey)
            .remove();

        htmlFilter.style("display", "flex");
        const deleteButton = htmlFilter.select(".activeFilterDeleteButton")
            .on("click", this.onFilterDelete());
        deleteButton.node()._filterData = {
            parentSelection: htmlFilter,
            newFilterKey: filterKey
        };
        const filterData = this.activeFilters.get(filterKey);
        if ( filterData.value ) {
            htmlFilter.select(".activeFilterCriterion")
                .html(`<strong>${filterData.criterion}</strong> matches`);
            htmlFilter.select(".activeFilterValue")
                .text(filterData.value);
        }
        else if ( filterData.min ) {
            htmlFilter.select(".activeFilterCriterion")
                .html(`<strong>${filterData.criterion}</strong> in range`);
            htmlFilter.select(".activeFilterValue")
                .text(`[${filterData.min} - ${filterData.max}]`);
        }

        this.activeFilterContainer
            .append(() => htmlFilter.node());
    }

    /**
     * Delete the active filter given by its key from the GUI.
     * 
     * @param {number} filterKey Key of the filter to create
     */
    deleteHtmlActiveFilter(filterKey) {
        d3.selectAll(`.activeFilterTemplate[filter-key=${filterKey}]`).remove();
    }

    /**
     * String filter builder.
     * 
     * @param {string} criterion The data on which this filter must be applied
     * @param {string} value The user pattern to match
     * @returns {FilterParameters} The new filter
     */
    createStringFilter(criterion, value) {
        const findUserGroup = /\(/g;
        const nbUserGroup = [...value.matchAll(findUserGroup)].length;
        try {
            const pattern = new RegExp(`^(.*)(${value})(.*)$`,"i");
            return {
                criterion:      criterion,
                type:           Serie.TypeString,
                value:          value,
                regex:          pattern,
                regexStartIdx:  1,
                regexMatchIdx:  2,
                regexEndIdx:    3+nbUserGroup
            };
        } catch (error) {return null;}
    }

    /**
     * Integer range filter builder.
     * 
     * @param {string} criterion The data on which this filter must be applied
     * @param {string} min The user min value
     * @param {string} max The user max value
     * @returns {FilterParameters} The new filter
     */
     createIntRangeFilter(criterion, min, max) {
        const minv = parseFloat(min);
        const maxv = parseFloat(max);
        if ( isNaN(minv) || isNaN(maxv) || maxv<minv) {
            return null;
        }
        return {
            criterion: criterion,
            type: Serie.TypeNumber,
            min: minv,
            max: maxv
        };
    }

    /**
     * Resets the filer add section to show that there is no filter in progress.
     */
    clearHtmlFilterAdd() {
        d3.select("#newFilterTypeSelector").property("value", Serie.SerieNull);
        this.updateHtmlFilterAdd();
    }

    /**
     * Updates filter add fields according to the value of #newFilterTypeSelector
     */
    updateHtmlFilterAdd() {
        d3.select("#newFilterSearchContainer").style("display", "none");
        d3.select("#newFilterNumberContainer").style("display", "none");
        d3.select("#newFilterNumberMinContainer").style("display", "none");
        d3.select("#newFilterNumberMaxContainer").style("display", "none");
        d3.select("#newFilterAddContainer").style("display", "none");
        const type = Serie.getType(d3.select("#newFilterTypeSelector").property("value"));
        switch ( type ) {
            case Serie.TypeNumber:
                d3.select("#newFilterNumberMinContainer").style("display", "block");
                d3.select("#newFilterNumberMaxContainer").style("display", "block");
                d3.select("#newFilterAddContainer").style("display", "block");
                break;
            case Serie.TypeString:
                d3.select("#newFilterSearchContainer").style("display", "block");
                d3.select("#newFilterAddContainer").style("display", "block");
                break;
            case Serie.TypeNull:
            default:
                break;
        }
    }

    /**
     * Returns the parameters of the filter parameters ready to activate.
     * 
     * @returns {FilterParameters|null} Filter data
     */
    getNewFilterHtml() {
        const filteredData = d3.select("#newFilterTypeSelector").property("value");
        const type = Serie.getType(filteredData);
        switch ( type ) {
            case Serie.TypeNumber:
                return this.createIntRangeFilter(filteredData,
                    d3.select("#newFilterNumberMin").property("value"),
                    d3.select("#newFilterNumberMax").property("value"));
            case Serie.TypeString:
                return this.createStringFilter(filteredData,
                    d3.select("#newFilterSearchText").property("value"));
            case Serie.TypeNull:
            default:
                break;
        }
        return null;
    }

    /**
     * Initializes the GUI to match the received data from server.
     */
    activateDisplay() {
        const _this = this;
        d3.select("#displayedSerieSelector")
            .on("change", this.onDataTypeChanged());
        d3.select("#newFilterSearchText")
            .on("focus", this.onEnterFilterSearch())
            .on("focusout", this.onLeaveFilterSearch())
            .on("keyup", this.onSearchTextChanged());
        d3.select("#newFilterTypeSelector")
            .on("change", this.onFilterTypeChanged())
            .append("option").text(Serie.SerieNull).attr("selected","true");
        d3.select("#newFilterAddContainer")
            .on("click", this.onFilterAdd());
        d3.select("#copyLinks")
            .on("click", this.onCopyLinks());
        this.data.columns()
            .forEach(c => {
                d3.select("#newFilterTypeSelector")
                    .append("option").text(c);
            });
        this.data.columns()
            .filter(c => Object.keys(Serie.PictureUrls).includes(c))
            .forEach(c => {
                d3.select("#displayedSerieSelector")
                    .append("option").text(c)
                    .call(function(s) { if(c==_this.dataType) s.attr("selected","true"); });
            });
        this.onDataTypeChanged().call(d3.select("#displayedSerieSelector").node());
        this.onFilterTypeChanged().call(d3.select("#newFilterTypeSelector").node());
        this.updateHtmlResults();
    }

}
