import * as d3 from "https://cdn.skypack.dev/d3@7";
import { logDate, withoutDiacritics } from "./util.js";
import { TitleData, Serie, SerieElement, Film, detailUrl, imageUrl } from "./title.js";
import { UiLeftTray } from "./ui-left-tray.js";
import { UiFastSearch } from "./ui-fast-search.js";
import { UiSelectData } from "./ui-serie-selector.js";

import { newSearchModel, createStringFilter, createIntRangeFilter } from "./searchModel.js";
import params from "./parameters.js";

/** @typedef {import("./searchModel.js").FilterParameters } FilterParameters */

export { localSearch };

/**
 * Returns a search manager for data in the client data model.
 * 
 * @returns {SearchManager} The new search manager
 */
const localSearch = function () {
    return new SearchManager();
};

/**
 * Class for HTML filter elements management.
 */
class SearchManager {
    static MAX_SEARCH_RESULT = 100;
    static CARDS_PER_PAGE = 170;

    constructor() {
        /** @type {d3.Selection} */
        this.activeFilterContainer = d3.select("#activeFilterContainer");
        this.activeFilterTemplate = d3.select("#Templates").select(".activeFilterTemplate");
        this.cardContainer = d3.select("#cardContainer");
        this.cardTemplate = d3.select("#Templates").select(".cardTemplate");
        this.resultCache = null;
        this.leftTray = new UiLeftTray();
        this.fastSearch = new UiFastSearch();
        this.serieSelector = new UiSelectData()
            .on("selected", this.onDataTypeChanged())
            ;

        this.model = newSearchModel()
            .on("deleted", this.onFilterDeleted())
            .on("created", this.onFilterCreated())
            .on("restore-end", this.onRestoreEnd())
            ;
        this.model.restore();
    }

    start() {
        // Graph initialisation from data
        const _this = this;
        const dataPath = params.databaseLocation;
        console.log(`${logDate()} Request ${dataPath}`);
        d3.json(dataPath)
            .then(function (content) {
                const data = new TitleData();
                data.parse(content);
                _this.model.data(data);
                _this.serieSelector.series(
                    data.columns().filter(c => Object.keys(Serie.PictureUrls).includes(c)));
                _this.activateDisplay();
            });
    }

    /**
     * Build a filter deleted handler
     * 
     * @returns {Function} Handler
     */
    onFilterDeleted() {
        const _this = this;
        return function(key) {
            _this.deleteHtmlActiveFilter(key);
        };
    }

    /**
     * Build a filter created handler
     * 
     * @returns {Function} Handler
     */
    onFilterCreated() {
        const _this = this;
        return function(key, data) {
            _this.addHtmlActiveFilter(key, data);
        };
    }

    /**
     * Build a filter restore handler
     * 
     * @returns {Function} Handler
     */
    onRestoreEnd() {
        const _this = this;
        return function() {
            _this.updateHtmlResults();
        };
    }

    /**
     * Build a menu-item-copy handler bound to this object
     * 
     * @returns {Function} Callback for event
     */
    onCopyLinksButton() {
        const _this = this;
        /**
         * The menu-item-copy button handler
         * 
         * @param {d3.event} e event
         */
        return function (e) {
            d3.select("#toast-end-copy-position").style("top", `${e.clientY}px`).style("left", `${e.clientX}px`);
            if (_this.resultCache) {
                const urls = [];
                _this.resultCache.forEach(se => {
                    const vars = _this.model.buildPatternVariables(se);
                    const imgUrl = detailUrl(_this.serieSelector.selected(), vars);
                    if (imgUrl) urls.push(imgUrl);
                });
                try {
                    navigator.clipboard
                        .writeText(urls.join("\n"))
                        .then(function () {
                            d3.select("#toast-end-copy")
                                .select(".toast-header").classed("bg-primary", true);
                            d3.select("#toast-end-copy").classed("show", true)
                                .select(".toast-body").text(`${urls.length} links have been copyied in the clipboard`);
                        }, function (err) {
                            d3.select("#toast-end-copy")
                                .select(".toast-header").classed("bg-danger", true);
                            d3.select("#toast-end-copy").classed("show", true)
                                .select(".toast-body").text(`Error copying ${urls.length} links to the clipboard: ${err}`);
                        });
                }
                catch (err) {
                    d3.select("#toast-end-copy")
                        .select(".toast-header").classed("bg-danger", true);
                    d3.select("#toast-end-copy").classed("show", true)
                        .select(".toast-body").text(`Error while accessing to the clipboard: ${err}`);
                }
            }
            else {
                d3.select("#toast-end-copy")
                    .select(".toast-header").classed("bg-danger", true);
                d3.select("#toast-end-copy").classed("show", true)
                    .select(".toast-body").text("No result to copy to clipboard");
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
        /**
         * The data selection change handler
         */
        return function () {
            _this.model.save();
            _this.updateHtmlResults();
        };
    }

    /**
     * Build a new filter type selection change handler bound to this object
     * 
     * @returns {Function} Callback for "click" event on DOM Element
     */
    onFilterTypeSelector() {
        const _this = this;
        /** The filter type selector change handler */
        return function () {
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
        return function () {
            const filterData = _this.getNewFilterHtml();
            if (filterData) {
                const newFilterKey = _this.model.create(filterData);
                _this.model.save();
                _this.addHtmlActiveFilter(newFilterKey, filterData);
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
    onFilterDeleteButton() {
        const _this = this;
        /** The filter delete button handler */
        return function () {
            this._filterData.parentSelection.remove();
            _this.model.delete(this._filterData.newFilterKey);
            _this.model.save();
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
        return function () {
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
        return function () {
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
        return function () {
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
        return function (e, d) {
            d3.select("#newFilterSearchText").property("value", d);
        };
    }

    /**
     * Creates a new Card to display the given SerieElement
     * 
     * @param {SerieElement} se The element do display on the card
     * @returns {d3.selection} The created card element
     */
    newHtmlCard(se) {
        const newCard = this.cardTemplate.clone(true).remove();
        const vars = this.model.buildPatternVariables(se);
        const imgUrl = imageUrl(this.serieSelector.selected(), vars);
        const detUrl = detailUrl(this.serieSelector.selected(), vars);
        if (imgUrl) {
            newCard.selectAll(".cardTemplateImage").attr("src", imgUrl);
        }
        if (detUrl) {
            newCard.selectAll(".cardTemplateUrl").attr("href", detUrl);
        }
        newCard.selectAll(".card-template-title").text(se.name());
        const films = [...se.values()];
        if (films.length == 1 && (films[0] instanceof Film)) {
            const imdbr = films[0].get(Serie.Names.imdbRating)?.values().next().value?.name();
            const tmdbr = films[0].get(Serie.Names.tmdbRating)?.values().next().value?.name();
            const year = films[0].get(Serie.Names.year)?.values().next().value?.name();
            newCard.selectAll(".card-template-title2")
                .text(`${year} - ${imdbr} - ${tmdbr}`);
        }
        else {
            newCard.selectAll(".card-template-title2")
                .text(`${films.length} Movies`);
        }
        return newCard;
    }

    /**
     * Refreshes the result list.
     */
    updateHtmlResults() {
        this.resultCache = this.model.getFilteredData(this.serieSelector.selected());
        const _this = this;
        this.cardContainer.selectAll(".cardTemplate")
            .data(_this.resultCache.slice(0, SearchManager.CARDS_PER_PAGE), se => se.name())
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
        if (flt && flt.type == Serie.TypeString) {
            if (flt.regex) {
                const serie = this.model.data().series(flt.criterion);
                const serieVals = [...serie.keys()]
                    .filter(e => flt.regex.test(withoutDiacritics(e)))
                    .slice(0, SearchManager.MAX_SEARCH_RESULT);
                listParent.selectAll("li")
                    .data(serieVals)
                    .join("li")
                    .classed("dropdown-item", true)
                    .classed("text-truncate", true)
                    .on("mousedown.search-page", this.onSearchListElementChoosen())
                    .html(d => {
                        const match = withoutDiacritics(d).match(flt.regex);
                        const s = match[flt.regexStartIdx].length;
                        const e = s + match[flt.regexMatchIdx].length;
                        // We do this like this to preserve diacritics in the diaplayed string
                        return `${d.substring(0, s)}<strong class="text-danger">${d.substring(s, e)}</strong>${d.substring(e)}`;
                    });
            }
        }
    }

    /**
     * Builds a new active filter given by its key in the GUI.
     * 
     * @param {number} filterKey Key of the filter to create
     * @param {FilterParameters} filterData Data of the filter to create
     */
    addHtmlActiveFilter(filterKey, filterData) {
        const htmlFilter = this.activeFilterTemplate
            .clone(true)
            .attr("filter-key", filterKey)
            .remove();

        htmlFilter.style("display", "flex");
        const deleteButton = htmlFilter.select(".activeFilterDeleteButton")
            .on("click", this.onFilterDeleteButton());
        deleteButton.node()._filterData = {
            parentSelection: htmlFilter,
            newFilterKey: filterKey
        };
        if (filterData.value) {
            htmlFilter.select(".activeFilterCriterion")
                .html(`<strong>${filterData.criterion}</strong> matches`);
            htmlFilter.select(".activeFilterValue")
                .text(filterData.value);
        }
        else if (filterData.min) {
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
        switch (type) {
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
        switch (type) {
            case Serie.TypeNumber:
                return createIntRangeFilter(filteredData,
                    d3.select("#newFilterNumberMin").property("value"),
                    d3.select("#newFilterNumberMax").property("value"));
            case Serie.TypeString:
                return createStringFilter(filteredData,
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
        d3.select("#newFilterSearchText")
            .on("focus", this.onEnterFilterSearch())
            .on("focusout", this.onLeaveFilterSearch())
            .on("keyup", this.onSearchTextChanged());
        d3.select("#newFilterTypeSelector")
            .on("change", this.onFilterTypeSelector())
            .append("option").text(Serie.SerieNull).attr("selected", "true");
        d3.select("#newFilterAddContainer")
            .on("click", this.onFilterAdd());
        d3.select("#menu-item-copy")
            .on("click", this.onCopyLinksButton());
        this.model.data().columns()
            .forEach(c => {
                d3.select("#newFilterTypeSelector")
                    .append("option").text(c);
            });

        this.onDataTypeChanged().call(this, this.serieSelector.selected());
        this.onFilterTypeSelector().call(d3.select("#newFilterTypeSelector").node());
        this.updateHtmlResults();
    }

}
