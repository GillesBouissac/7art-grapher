// @ts-check

import * as d3 from "https://cdn.skypack.dev/d3@7";
import { logDate, withoutDiacritics } from "./lib/util.js";
import { TitleData, Serie, SerieElement, Film, detailUrl, imageUrl } from "./lib/title.js";
import { UiLeftTray } from "./ui-left-tray.js";
import { UiFastSearch } from "./ui-fast-search.js";
import { UICheckMenu } from "./ui-check-menu.js";

import { UiSwitchView } from "./ui-switch-view.js";
import { Filter, FilterPattern, FilterIntRange } from "./lib/filter.js";
import { SearchModel } from "./searchModel.js";
import parameters from "./parameters.js";

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
        /** @type {d3.Selection} */
        this.activeFilterTemplate = d3.select("#Templates").select(".activeFilterTemplate");
        
        /** @type {d3.Selection} */
        this.cardGridContainer = d3.select("#card-grid-container");
        /** @type {d3.Selection} */
        this.cardListContainer = d3.select("#card-list-container");
        /** @type {d3.Selection} */
        this.cardListTitleTemplate = d3.select("#Templates").select(".card-detail-list-titles-template");
        /** @type {d3.Selection} */
        this.cardListItemTemplate = d3.select("#Templates").select(".card-detail-list-items-template");

        /** @type {d3.Selection} */
        this.cardGridTemplate = d3.select("#Templates").select(".card-grid-template");
        this.cardListTemplate = d3.select("#Templates").select(".card-list-template");
        this._dataFilteredCache = null;
        this._serieFilteredCache = null;
        this.leftTray = new UiLeftTray();
        this.fastSearch = new UiFastSearch()
            .setEventThis(this)
            .on("change", this.onFastSearchChanged)
            ;
        this.switchView = new UiSwitchView()
            .setEventThis(this)
            .on("to-grid", this.onSwitchToGrid)
            .on("to-list", this.onSwitchToList)
            ;

        this.serieSelector = new UICheckMenu(d3.select("#menu-item-select-data"), Serie.Names.title)
            .setEventThis(this)
            .on("selected", this.onDataTypeChanged)
            ;

        this.fastSearchSelector = new UICheckMenu(d3.select("#menu-item-fast-search-scope"), Serie.SortCriterionKey)
            .setEventThis(this)
            .on("selected", this.onFastSearchScopeChanged)
            ;

        this.model = new SearchModel();
        this.model.setEventThis(this)
            .on("deleted", (key) => this.deleteHtmlActiveFilter(key))
            .on("created", (key, data) => this.addHtmlActiveFilter(key, data))
            .on("restore-end", () => this.updateHtmlResults)
            ;
        this.model.restore();
    }

    start() {
        // Graph initialisation from data
        const _this = this;
        const dataPath = parameters.databaseLocation;
        console.log(`${logDate()} Request ${dataPath}`);
        d3.json(dataPath)
            .then(function (content) {
                console.log(`${logDate()} Data received`);
                const data = new TitleData();
                data.parse(content);
                _this.model.setData(data);
                _this.serieSelector.items(
                    data.columns().filter(c => Serie.getSeriesWithPicture().includes(c)));
                _this.fastSearchSelector.items(
                    [Serie.SortCriterionKey].concat(data.columns()));
                _this.activateDisplay();
            });
    }

    /**
     * Display the popup showing copy result
     * 
     * @param {string} text Popup message
     * @param {boolean=} error True if this is an error
     */
    showCopyResult(text, error) {
        const err = error==undefined ? false : error;
        d3.select("#toast-end-copy")
            .select(".toast-header")
            .classed("bg-primary", err ? false : true)
            .classed("bg-danger", err ? true : false)
            ;
        d3.select("#toast-end-copy").classed("show", true)
            .select(".toast-body").text(text);

        const bodyRect = document.body.getBoundingClientRect();
        const commandRect = d3.select("#menu-item-copy").node().getBoundingClientRect();
        const popup = d3.select("#toast-end-copy-position");
        const popupRect = popup.node().getBoundingClientRect();
        const x = commandRect.right-popupRect.width-bodyRect.left;
        const y = commandRect.bottom-bodyRect.top;
        popup.style("top", `${y}px`).style("left", `${x}px`);
    }

    /**
     * Build a menu-item-copy handler bound to this object
     * 
     * @returns {Function} Callback for event
     */
    buildOnCopyLinksButton() {
        const _this = this;
        /**
         * The menu-item-copy button handler
         */
        return function () {
            if (_this._serieFilteredCache) {
                const urls = [];
                _this._serieFilteredCache.forEach(se => {
                    const vars = _this.model.buildPatternVariables(se);
                    const imgUrl = detailUrl(_this.serieSelector.selected(), vars);
                    if (imgUrl) urls.push(imgUrl);
                });
                try {
                    navigator.clipboard
                        .writeText(urls.join("\n"))
                        .then(function () {
                            _this.showCopyResult(`${urls.length} links have been copied in the clipboard`);
                        }, function (err) {
                            _this.showCopyResult(`Error while copying ${urls.length} links to the clipboard: ${err}`, true);
                        });
                }
                catch (err) {
                    _this.showCopyResult(`Error while accessing to the clipboard: ${err}`, true);
                }
            }
            else {
                _this.showCopyResult("No result to copy to clipboard");
            }
        };
    }

    /**
     * Data selection change handler
     */
     onDataTypeChanged() {
        this.model.save();
        this.updateHtmlResults();
    }

    /**
     * Fast search scope change handler
     */
    onFastSearchScopeChanged() {
        this.onFastSearchChanged(this.fastSearch.value());
    }

    /**
     * Fast search text change handler
     * 
     * @param {string} text Current fast search pattern
     */
     onFastSearchChanged(text) {
        this.model.cleanSerieFilters();
        if (text && text.length>0) {
            const filter = new FilterPattern(this.fastSearchSelector.selected(), text);
            this.model.addSerieFilter(filter);
        }
        this.updateHtmlResults(false);
    }

    /**
     * User switched in grid mode
     */
    onSwitchToGrid() {
        this.updateHtmlResults();
    }

    /**
     * User switched in list mode
     */
    onSwitchToList() {
        this.updateHtmlResults();
    }

    /**
     * Build a filter add button handler bound to this object
     * 
     * @returns {Function} Callback for "click" event on DOM Element
     */
    buildOnFilterAdd() {
        const _this = this;
        /** The filter add button handler */
        return function () {
            const filterData = _this.getNewFilterHtml();
            if (filterData) {
                const newFilterKey = _this.model.addFilmFilter(filterData);
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
            _this.model.delFilmFilter(this._filterData.newFilterKey);
            _this.model.save();
            _this.updateHtmlResults();
        };
    }

    /**
     * Build a enter search text field handler bound to this object.
     * 
     * @returns {Function} Callback for "click" event on DOM Element
     */
    buildOnEnterFilterSearch() {
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
    buildOnLeaveFilterSearch() {
        /**
         * The leave focus handler from search text field.
         * Closes the dropdown
         */
        return function () {
            d3.select("#newFilterSearchList").classed("show", false);
        };
    }

    /**
     * Build a search text changed handler bound to this object.
     * 
     * @returns {Function} Callback for "click" event on DOM Element
     */
    buildOnSearchTextChanged() {
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
    buildOnSearchListElementChoosen() {
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
     * @param {boolean} modeGrid True if we need a grid card, false for a list card
     * @returns {d3.selection} The created card element
     */
    newHtmlCard(serie, se, modeGrid) {
        const template = modeGrid ? this.cardGridTemplate : this.cardListTemplate;
        const newCard = template.clone(true).remove();
        const vars = this.model.buildPatternVariables(se);
        const imgUrl = imageUrl(this.serieSelector.selected(), vars);
        const detUrl = detailUrl(this.serieSelector.selected(), vars);
        if (imgUrl) {
            newCard.selectAll(".card-template-image").attr("src", imgUrl);
        }
        if (detUrl) {
            newCard.selectAll(".card-template-url").attr("href", detUrl);
        }
        newCard
            .selectAll(".card-title")
            .attr("title", se.name())
            .attr("href", detUrl)
            .text(se.name())
            ;
        const films = [...se.values()];
        if (films.length == 1 && (films[0] instanceof Film)) {
            const imdbr = films[0].get(Serie.Names.imdbRating)?.values().next().value?.name();
            const tmdbr = films[0].get(Serie.Names.tmdbRating)?.values().next().value?.name();
            const tomatoe = films[0].get(Serie.Names.tomatoeRating)?.values().next().value?.name();
            const year = films[0].get(Serie.Names.year)?.values().next().value?.name();
            newCard.selectAll(".card-title-year")
                .text(`${year}`)
                .classed("show", year!=undefined);
            newCard.selectAll(".card-title-imdbr")
                .text(`${imdbr}`)
                .classed("rating-low", imdbr<4)
                .classed("rating-medium", 4<=imdbr && imdbr<7)
                .classed("rating-high", 7<=imdbr)
                .classed("show", imdbr!=undefined);
            newCard.selectAll(".card-title-tmdbr")
                .text(`${tmdbr}`)
                .classed("rating-low", tmdbr<4)
                .classed("rating-medium", 4<=tmdbr && tmdbr<7)
                .classed("rating-high", 7<=tmdbr)
                .classed("show", tmdbr!=undefined);
            newCard.selectAll(".card-title-tomatoer")
                .text(`${tomatoe}`)
                .classed("rating-low", tomatoe<60)
                .classed("rating-high", tomatoe>=60)
                .classed("show", tomatoe!=undefined);
        }
        else {
            newCard.selectAll(".card-title2")
                .html(`<div class="bi bi-film mt-1 me-1">&nbsp;</div><div>${films.length}</div>`);
        }
        if ( !modeGrid ) {
            const layout = this.model._data.series(serie).getSerielistLayout(se);
            if (layout) {
                newCard.select(".card-detail-list-titles")
                    .selectAll(".card-detail-list-titles-template")
                    .data(layout.outline, d => d[0])
                    .join(enter => enter
                        .append((d) => this.newCardListItem(this.cardListTitleTemplate, d[0], d[1]).node())
                    );
                newCard.select(".card-detail-list-items")
                    .selectAll(".card-detail-list-items-template")
                    .data(layout.detail, d => d[0])
                    .join(enter => enter
                        .append((d) => this.newCardListItem(this.cardListItemTemplate, d[0], d[1]).node())
                    );
                newCard.select(".card-detail-list-overlay")
                    .on("click", function(e) {
                        e.preventDefault();
                        const p = d3.select(this.parentNode);
                        const a = p.select(".down-arrow-container");
                        a.classed("show", a.classed("show") ? false : true)
                        p.style("max-height", a.classed("show") ? null : "max-content" )
                    })
            }
        }
        return newCard;
    }

    newCardListItem(template, name, text) {
        const newItem = template.clone(true).remove();
        newItem.select("dt").text(name)
        newItem.select("dd").text(text)
        return newItem;
    }

    /**
     * Apply filter on data
     * 
     * @returns {SearchManager} This
     */
    updateCache() {
        this._dataFilteredCache = this.model.getFilteredData(this.serieSelector.selected());
        return this;
    }

    /**
     * Refreshes the result list.
     * 
     * @param {boolean=} withCache True to reset the cache from film filters
     * @returns {SearchManager} This
     */
    updateHtmlResults(withCache) {
        const _this = this;
        if (withCache==undefined || withCache) {
            this.updateCache();
        }
        const filters = this.model.getSerieFilters();
        this._serieFilteredCache = this._dataFilteredCache
            .filter(se =>
                filters.every(flt =>
                    flt.match(se.summary(flt.criterion))
                )
            )
            .slice(0, SearchManager.CARDS_PER_PAGE)
            ;

        const modeGrid = this.switchView.isModeGrid();
        const dataGrid = modeGrid ? this._serieFilteredCache : [];
        const dataList = modeGrid ? [] : this._serieFilteredCache;
        const serie = this.serieSelector.selected();
        this.cardGridContainer
            .classed("show", modeGrid)
            .selectAll(".card-grid-template")
            .data(dataGrid, se => se.name())
            .join( enter => enter
                    .append((se) => _this.newHtmlCard(serie, se, modeGrid).node())
            );
        this.cardListContainer
            .classed("show", !modeGrid)
            .selectAll(".card-list-template")
            .data(dataList, se => se.name())
            .join( enter => enter
                    .append((se) => _this.newHtmlCard(serie, se, modeGrid).node())
            );
        return this;
    }

    /**
     * Refreshes the search result list for a new filter.
     */
    refreshHtmlSearchList() {
        const flt = this.getNewFilterHtml();
        const listParent = d3.select("#newFilterSearchList");
        if (flt && flt.type == Serie.TypeString) {
            if (flt.regex) {
                const serie = this.model.getData().series(flt.criterion);
                const serieVals = [...serie.values()]
                    .map(se => se.name())
                    .filter(e => flt.regex.test(withoutDiacritics(e)))
                    .slice(0, SearchManager.MAX_SEARCH_RESULT);
                listParent.selectAll("li")
                    .data(serieVals)
                    .join("li")
                    .classed("dropdown-item", true)
                    .classed("text-truncate", true)
                    .on("mousedown.search-page", this.buildOnSearchListElementChoosen())
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
     * @param {string} filterKey Key of the filter to create
     * @param {Filter} filter Data of the filter to create
     */
    addHtmlActiveFilter(filterKey, filter) {
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
        if (filter instanceof FilterPattern) {
            htmlFilter.select(".activeFilterCriterion")
                .html(`<strong>${filter.criterion}</strong> matches`);
            htmlFilter.select(".activeFilterValue")
                .text(filter.value);
        }
        else if (filter instanceof FilterIntRange) {
            htmlFilter.select(".activeFilterCriterion")
                .html(`<strong>${filter.criterion}</strong> in range`);
            htmlFilter.select(".activeFilterValue")
                .text(`[${filter.min} - ${filter.max}]`);
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
     * @returns {Filter} Filter data
     */
    getNewFilterHtml() {
        const filteredData = d3.select("#newFilterTypeSelector").property("value");
        const type = Serie.getType(filteredData);
        switch (type) {
            case Serie.TypeNumber:
                return new FilterIntRange(filteredData,
                    d3.select("#newFilterNumberMin").property("value"),
                    d3.select("#newFilterNumberMax").property("value"));
            case Serie.TypeString:
                return new FilterPattern(filteredData,
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
        d3.select("#newFilterSearchText")
            .on("focus", this.buildOnEnterFilterSearch())
            .on("focusout", this.buildOnLeaveFilterSearch())
            .on("keyup", this.buildOnSearchTextChanged());
        d3.select("#newFilterTypeSelector")
            .on("change", () => _this.updateHtmlFilterAdd())
            .append("option").text(Serie.SerieNull).attr("selected", "true");
        d3.select("#newFilterAddContainer")
            .on("click", this.buildOnFilterAdd());
        d3.select("#menu-item-copy")
            .on("click", this.buildOnCopyLinksButton());
        this.model.getData().columns()
            .forEach(c => {
                d3.select("#newFilterTypeSelector")
                    .append("option").text(c);
            });
        d3.select("html").on('click.card-close', function(e) {
            //var isClickInsideElement = ignoreClickOnMeElement.contains(e.target);
            const parent = e.target.parentNode;
            d3.selectAll(".card-detail-list-overlay")
                .each(function() {
                    if ( parent!=this.parentNode ) {
                        d3.select(this.parentNode)
                            .style("max-height", null )
                            .select(".down-arrow-container")
                            .classed("show", true)
                    }
                })
                ;
        })

        this.onDataTypeChanged();
        this.updateHtmlFilterAdd();
        this.updateHtmlResults();
    }

}
