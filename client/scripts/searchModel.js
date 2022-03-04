import { withoutDiacritics, Listeners } from "./util.js";
import { TitleData, Serie, SerieElement } from "./title.js";

export { createStringFilter };
export { createIntRangeFilter };
export { newSearchModel };
export { SearchModel };
/** @exports FilterParameters */

/**
 * Returns a filter manager.
 * 
 * @returns {SearchModel} The new filter manager
 */
function newSearchModel() {
    return new SearchModel();
}

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
 * String filter builder.
 * 
 * @param {string} criterion The data on which this filter must be applied
 * @param {string} value The user pattern to match
 * @returns {FilterParameters} The new filter
 */
function createStringFilter(criterion, value) {
    const findUserGroup = /\(/g;
    const nbUserGroup = [...value.matchAll(findUserGroup)].length;
    try {
        const pattern = new RegExp(`^(.*)(${withoutDiacritics(value)})(.*)$`,"i");
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
function createIntRangeFilter(criterion, min, max) {
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
 * Class for filter management.
 */
class SearchModel {

    constructor() {
        /** @type {TitleData} */
        this._data = new TitleData();
        /** @type {Map<string,FilterParameters>} */
        this.activeFilters = new Map();
        /** @type {Listeners} list of listeners */
        this.listeners = new Listeners(this);
    }

    /**
     * Add a listener to an event
     *   - "created": function(filterKey, data), this: FilterManager
     *   - "deleted": function(filterKey), this: FilterManager
     *   - "restore-start": function(), this: FilterManager
     *   - "restore-end": function(), this: FilterManager
     * 
     * @param {string} event Event name
     * @param {Function} callback Function to call on event
     * @returns {SearchModel} this
     */
    on(event, callback) {
        this.listeners.getOrCreate(event).add(callback);
        return this;
    }

    /**
     * Getter/Setter for indexed data
     * 
     * @param {TitleData|null} dataIn Indexed data
     * @returns {SearchModel|TitleData} This (setter) or indexed data (getter)
     */
    data(dataIn) {
        if (dataIn) {
            this._data = dataIn;
            return this;
        }
        return this._data;
    }

    /**
     * Reset context
     * 
     * @returns {SearchModel} this
     */
    reset() {
        for ( let key of this.activeFilters.keys() ) {
            this.listeners.fire("deleted", key);
        }
        this.activeFilters = new Map();
        return this;
    }

    /**
     * Save filters context to localStorage
     * 
     * @returns {SearchModel} this
     */
    save() {
        let persistentData = {
            activeFilters: {}
        };
        for ( let key of this.activeFilters.keys() ) {
            persistentData.activeFilters[key] = this.activeFilters.get(key);
        }
        const persistentDataStr = JSON.stringify(persistentData, (k,v) => k.includes("regex")?undefined:v);
        localStorage.setItem("filmSearchContext",persistentDataStr);
        return this;
    }

    /**
     * Restore filters from localStorage
     * 
     * @returns {SearchModel} this
     */
    restore() {
        this.reset();
        const persistentDataStr = localStorage.getItem("filmSearchContext");
        this.listeners.fire("restore-start");
        if (persistentDataStr) {
            try {
                const persistentData = JSON.parse(persistentDataStr);
                for ( let key of Object.keys(persistentData.activeFilters) ) {
                    const f = persistentData.activeFilters[key];
                    if (f.type==Serie.TypeString) {
                        this.activeFilters.set(key, createStringFilter(f.criterion,f.value));
                    }
                    else if (f.type==Serie.TypeNumber) {
                        this.activeFilters.set(key, createIntRangeFilter(f.criterion,f.min,f.max));
                    }
                }
                for ( let key of this.activeFilters.keys() ) {
                    this.listeners.fire();
                    this.listeners.fire("created", key, this.activeFilters.get(key));
                }
            } catch (error) {
                // Ignore filter restore
                console.error(error);
            }
        }
        this.listeners.fire("restore-end");
        return this;
    }

    /**
     * Records a new filter
     * 
     * @param {FilterParameters} params Filter parameters
     * @returns {string} New filter key
     */
    create(params) {
        const newFilterKey = this.activeFilters.size;
        this.activeFilters.set(newFilterKey, params);
        return newFilterKey;
    }

    /**
     * Removes a filter
     * 
     * @param {key} key Filter key to delete
     * @returns {SearchModel} this
     */
    delete(key) {
        this.activeFilters.delete(key);
        return this;
    }

    /**
     * Retrieves the films that matches every filters (AND)
     * 
     * @param {string} serie The serie to return
     * @returns {SerieElement} Matching data
     */
    getFilteredData(serie) {
        const filters = [...this.activeFilters.values()];
        let serieElements = [...this._data.series(serie).values()];
        return serieElements.filter(se => {
            const films = [...se.values()];
            return filters.every(flt =>{
                return films.filter(film => {
                    const values = [...film.get(flt.criterion).keys()];
                    return values.filter(v=>{
                        let match = false;
                        if (flt.type==Serie.TypeString) {
                            match = flt.regex.test(withoutDiacritics(v));
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
}
