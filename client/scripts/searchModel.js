import { withoutDiacritics, Listened } from "./util.js";
import { TitleData, Serie, SerieElement } from "./title.js";

export { newSearchModel };
export { SearchModel };
export { Filter };
export { FilterPattern };
export { FilterIntRange };

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
 * @property {string} type Filter type, one of Serie.Type<xxx>
 * @property {string} fingerprint Unique identifier of this filter
 * @property {string} criterion Filter criterion
 * @property {string} value User input value for a text filter
 * @property {number} min Filter min value for a numeric filter
 * @property {number} max Filter max value for a numeric filter
 * @property {RegExp} regex Pattern for a text filter
 * @property {number} regexStartIdx Index of the first (unmatching) group in pattern
 * @property {number} regexMatchIdx Index of the first (matching) group in pattern
 * @property {number} regexEndIdx Index of the third (unmatching) group in pattern
 */
class Filter {
    constructor(type) {
        this.type = type;
    }
    /**
     * Check if the filter matches the given value
     * 
     * @param {string} value The value to check
     * @returns {boolean} True if the filter matches
     */
    // eslint-disable-next-line no-unused-vars
    match(value) {
        return false;
    }
}

/**
 * Filter for regex pattern
 */
class FilterPattern extends Filter {
    /**
     * Constructor
     * 
     * @param {string} criterion The data on which this filter must be applied
     * @param {string} value The user pattern to match
     */
    constructor(criterion, value) {
        super(Serie.TypeString);
        let nbUserGroup;
        try {
            const findUserGroup = /\(/g;
            nbUserGroup = [...value.matchAll(findUserGroup)].length;
            this.regex = new RegExp(`^(.*)(${withoutDiacritics(value)})(.*)$`,"i");
        } catch (error) {
            nbUserGroup = 0;
            this.regex = new RegExp("");
        }
        this.criterion = criterion;
        this.fingerprint = `${Serie.TypeString}|${criterion}|${value}`;
        this.value = value;
        this.regexStartIdx = 1;
        this.regexMatchIdx = 2;
        this.regexEndIdx = 3+nbUserGroup;
    }
    /** @inheritdoc */
    match(value) {
        return this.regex.test(withoutDiacritics(value));
    }
}

/**
 * Filter for numbers range
 */
 class FilterIntRange extends Filter {
    /**
     * Constructor
     * 
     * @param {string} criterion The data on which this filter must be applied
     * @param {string} min The user min value
     * @param {string} max The user max value
     */
    constructor(criterion, min, max) {
        super(Serie.TypeNumber);
        let minv = parseFloat(min);
        let maxv = parseFloat(max);
        minv = isNaN(minv) ? -1000000000.0 : minv;
        maxv = isNaN(maxv) ? +1000000000.0 : maxv;
        if (maxv<minv) {
            maxv = minv;
        }
        this.criterion = criterion;
        this.fingerprint = `${Serie.TypeNumber}|${criterion}|${minv}|${maxv}`;
        this.min = minv;
        this.max = maxv;
    }
    /** @inheritdoc */
    match(value) {
        const fv = parseFloat(value);
        return isNaN(fv) ? false : (this.min<=fv && fv<=this.max);
    }
}

/**
 * Class for filter management.
 * 
 * Fired events:
 *   - "created": function(filterKey, data)
 *   - "deleted": function(filterKey)
 *   - "restore-start": function()
 *   - "restore-end": function()
 */
class SearchModel extends Listened {

    constructor() {
        super();

        /** @type {TitleData} */
        this._data = new TitleData();
        /** @type {Map<string,Filter>} Filters films based by film series */
        this.filmFilters = new Map();
        /** @type {Map<string,Filter>} Filters result series */
        this.serieFilters = new Map();
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
        for ( let k of this.filmFilters.keys() ) {
            this.fire("deleted", k);
        }
        this.filmFilters = new Map();
        return this;
    }

    /**
     * Save filters context to localStorage
     * 
     * @returns {SearchModel} this
     */
    save() {
        let persistentData = {
            filmFilters: {}
        };
        for ( let k of this.filmFilters.keys() ) {
            persistentData.filmFilters[k] = this.filmFilters.get(k);
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
        this.fire("restore-start");
        if (persistentDataStr) {
            try {
                const persistentData = JSON.parse(persistentDataStr);
                for ( let k of Object.keys(persistentData.filmFilters) ) {
                    const f = persistentData.filmFilters[k];
                    if (f.type==Serie.TypeString) {
                        this.addFilmFilter(new FilterPattern(f.criterion, f.value));
                    }
                    else if (f.type==Serie.TypeNumber) {
                        this.addFilmFilter(new FilterIntRange(f.criterion, f.min, f.max));
                    }
                }
                for ( let k of this.filmFilters.keys() ) {
                    this.fire("created", k, this.filmFilters.get(k));
                }
            } catch (error) {
                // Ignore filter restore
                console.error(error);
            }
        }
        this.fire("restore-end");
        return this;
    }

    /**
     * Records a new filter
     * 
     * @param {Filter} filter Filter parameters
     * @returns {string} New filter key
     */
    addFilmFilter(filter) {
        const k = filter.fingerprint;
        this.filmFilters.set(k, filter);
        return k;
    }

    /**
     * Removes the specified filter
     * 
     * @param {string} k Filter key to delete
     * @returns {SearchModel} this
     */
    delFilmFilter(k) {
        this.filmFilters.delete(k);
        return this;
    }

    /**
     * Records a new filter
     * 
     * @param {Filter} filter Filter parameters
     * @returns {string} New filter key
     */
    addSerieFilter(filter) {
        const k = filter.fingerprint;
        this.serieFilters.set(k, filter);
        return k;
    }

    /**
     * Removes the specified filter
     * 
     * @param {string} k Filter key to delete
     * @returns {SearchModel} this
     */
    delSerieFilter(k) {
        this.serieFilters.delete(k);
        return this;
    }

    /**
     * Removes all serie filters
     * 
     * @returns {SearchModel} this
     */
    cleanSerieFilters() {
        for ( let k of this.serieFilters.keys()) {
            this.delSerieFilter(k);
        }
        return this;
    }

    /**
     * Retrieves the films that matches every filters (AND)
     * 
     * @param {string} serie The serie to return
     * @returns {SerieElement} Matching data
     */
    getFilteredData(serie) {
        const filmFilters = [...this.filmFilters.values()];
        const serieFilters = [...this.serieFilters.values()];
        let serieElements = [...this._data.series(serie).values()];
        return serieElements.filter(se => {
            const films = [...se.values()];
            return filmFilters.every(flt =>{
                return films.filter(film => {
                    const values = [...film.get(flt.criterion).values()].map(e => e.name());
                    return values.filter(v=> flt.match(v)).length>0;
                }).length>0;
            });
        }).filter(se => {
            return serieFilters.every(flt => flt.match(se.name()));
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
