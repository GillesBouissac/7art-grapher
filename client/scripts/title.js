import { compareAlphanumeric, logDate } from "./util.js";

export { TitleData, Serie };

/**
 * File dedicated to title.json parsing and indexing
 */

const TitleColName = "Title";

/**
 * Map that allow entries creation and get in one call.
 */
 class AutoMap extends Map {
    /**
     * Returns the element at key event if absent before the call
     * 
     * @see {@link https://www.baeldung.com/java-map-computeifabsent.}
     * @param {string} key The key element to get or create
     * @param {Function} mappingFunction The function to call to create a missing object
     * @returns {Map<any,any>} The element at "key"
     */
    computeIfAbsent(key, mappingFunction) {
        if ( !this.has(key) ) {
            this.set(key, mappingFunction(key));
        }
        return this.get(key);
     }
}

/**
 * Map of data for one serie element.
 */
class SerieElement extends AutoMap {

    constructor(name) {
        super();
        this._name = name;
        this._averages = {};
    }
    getOrCreate(key) {
        return super.computeIfAbsent(key, () => new Film());
    }

    /**
     * Name accessor.
     * 
     * @returns {string} name of this element
     */
    name() {return this._name; }

    /**
     * Film serie average accessor
     * 
     * @param {string} serie Name of the serie
     * @returns {number} The computed average
     */
    average(serie) {
        if (!Object.prototype.hasOwnProperty.call(this._averages,serie)) {
            this._averages[serie] = 0;
            if (this.size>0) {
                const vals=[];
                this.forEach(film => {
                    vals.push(...Array.from(film.get(serie).keys()));
                });
                if ( vals.length==1 ) {
                    // returns the value (could be a string, no average)
                    let v = parseFloat(vals[0]);
                    this._averages[serie] = isNaN(v) ? vals[0] : v;
                }
                else {
                    const sum = vals.reduce(function (p,c){
                        let v = parseFloat(c);
                        v = isNaN(v) ? 0 : v;
                        return p+v;
                    },0);
                    this._averages[serie] = (sum/vals.length).toFixed(3);
                }
            }
        }
        return this._averages[serie];
    }

    /**
     * Compares 2 elements of by name.
     * 
     * @param {SerieElement} b The element to compare to this
     * @returns {number} -1(a<b)/0(a==b)/+1(a>b)
     */
    compareByName(b) {
        return compareAlphanumeric(this._name,b._name);
    }

    /**
     * Compares 2 elements of by name.
     * 
     * @param {SerieElement} b The element to compare to this
     * @returns {number} -1(a<b)/0(a==b)/+1(a>b)
     */
     compareByCount(b) {
        return this.size - b.size;
    }

    /**
     * Compares 2 elements of by name.
     * 
     * @param {string} serie The serie to compare
     * @param {SerieElement} b The element to compare to this
     * @returns {number} -1(a<b)/0(a==b)/+1(a>b)
     */
     compareBySerie(serie,b) {
        if ( serie==Serie.SortCriterionNone ) return 0;
        if ( serie==Serie.SortCriterionKey ) return this.compareByName(b);
        if ( serie==Serie.SortCriterionCount ) return this.compareByCount(b);
        return compareAlphanumeric(this.average(serie),b.average(serie));
    }
}

/**
 * Map of data for one serie.
 */
class Serie extends AutoMap {
    static SerieNull = "---";
    static TypeNumber = "number";
    static TypeString = "string";
    static TypeNull = "null";
    static SortCriterionKey = "Etiquette";
    static SortCriterionCount = "Nombre de films";
    static SortCriterionNone = Serie.SerieNull;

    /**
     * List of main sort criteria by serie
     * Default to SortCriterionCount if not in this list
     */
    static SortCriteria = {
        "Year": [Serie.SortCriterionKey],
        "IMDb rating": [Serie.SortCriterionKey],
        "Rotten Tomatoes rating": [Serie.SortCriterionKey],
        "IMDb ID": [Serie.SortCriterionKey],
        "TMDB ID": [Serie.SortCriterionKey],
        "Runtime": [Serie.SortCriterionKey]
    };

    static Types = {
        "---": Serie.TypeNull,
        "Year": Serie.TypeNumber,
        "Runtime": Serie.TypeNumber,
        "IMDb rating": Serie.TypeNumber,
        "Rotten Tomatoes rating": Serie.TypeNumber,
    };

    static getType(serie) {
        return Serie.Types[serie] ? Serie.Types[serie] : Serie.TypeString;
    }

    getOrCreate(key) {
        return super.computeIfAbsent(key, () => new SerieElement(key));
    }
}

/**
 * Map of data for all series.
 */
 class AllSeries extends AutoMap {
    getOrCreate(key) {
        return super.computeIfAbsent(key, () => new Serie());
    }
}

/**
 * Map of data for one film.
 */
 class Film extends AutoMap {
    getOrCreate(key) {
        return super.computeIfAbsent(key, () => new Serie());
    }
}

/**
 * Class that is an accessor to indexed data
 * Structure is recursive:
 * - this._columns: Ordered array of series names in data
 * - this._series - **AllSeries** - Indexed data, unordered
 *   - key: serie/column name (ex: "Countries")
 *   - value: **Serie**
 *     - key: serie element value (ex: "France")
 *     - value: **SerieElement**
 *       - key: film title (ex: "Le Voyage dans la Lune")
 *       - value: **Film**
 *         - key: serie/column name (ex: "Countries")
 *         - value: **Serie** ... *This is where infinite loop starts*
 * 
 * Note that this._series.get("Title") gives direct access to films by title
 */
class TitleData {
    constructor() {
        this._series = new AllSeries();
        this._columns = [];
    }

    parse (content) {
        /** @returns {string[]} Series names */
        this._columns = content.columns;

        /** @returns {AllSeries} Indexed series data */
        this._series = new AllSeries();

        const titleIdx = this._columns.findIndex(e => e==TitleColName);
        content.data.forEach( row => {

            // Register the film
            const film = new Film();

            // Index columns
            this._columns.forEach( (c,i) => {
                film.getOrCreate(c);
                const serie = this._series.getOrCreate(c);
                let vals = Array.isArray(row[i]) ? row[i] : [ row[i] ];
                vals.forEach(e => {
                    const se = ""+e;
                    const te = parseInt(se, 10);
                    if (isNaN(te) || te>=0) {
                        serie.getOrCreate(se).set(row[titleIdx], film);
                        film.getOrCreate(c).set(se, serie.get(se));
                    }
                });
            });
        });
        console.log(`${logDate()} Data parsed`);
    }

    /**
     * Accessor to the Array of series names.
     * 
     * @returns {string[]} Series names
     */
    columns() { return this._columns; }

    /**
     * Accessor to a specific serie.
     * 
     * @param {string} name Serie name
     * @returns {Serie?} The required Serie or the whole Map if no name given or null if not found
     */
    series(name) { return name ? this._series.get(name) : null; }
}

