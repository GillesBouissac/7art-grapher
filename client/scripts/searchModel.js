import { Listened } from "./lib/util.js";
import { TitleData, Serie, SerieElement } from "./lib/title.js";
import { Filter, FilterPattern, FilterIntRange } from "./lib/filter.js";

export { newSearchModel };
export { SearchModel };

/**
 * Returns a filter manager.
 * 
 * @returns {SearchModel} The new filter manager
 */
function newSearchModel() {
    return new SearchModel();
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
     * @returns {SerieElement[]} Matching data
     */
    getFilteredData(serie) {
        const filmFilters = [...this.filmFilters.values()];
        let serieElements = [...this._data.series(serie).values()];
        return serieElements.filter(se => {
            const films = [...se.values()];
            return filmFilters.every(flt =>{
                return films.filter(film => {
                    const values = [...film.get(flt.criterion).values()].map(e => e.name());
                    return values.filter(v=> flt.match(v)).length>0;
                }).length>0;
            });
        });
    }

    /**
     * Returns the list of serie filters
     * 
     * @returns {SerieElement[]} Matching data
     */
    getSerieFilters() {
        return [...this.serieFilters.values()];
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
        const name = serieElement.name();
        const names = name.split(/\s+/);
        return {name:name,names:names,imdb:imdb?imdb:tmdb,tmdb:tmdb?tmdb:imdb,year:year};
    }
}
