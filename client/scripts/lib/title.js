import { compareAlphanumeric, logDate, AutoMap, absoluteUrl } from "./util.js";
import params from "../parameters.js";

export { TitleData, Serie, SerieElement, Film };
export { imageUrl, detailUrl };

/**
 * File dedicated to title.json parsing and indexing
 */

/**
 * Map of data for one serie element.
 */
class SerieElement extends AutoMap {

    constructor(name) {
        super(name);
        this._averages = {};
    }
    getOrCreate(key, name) {
        return super.computeIfAbsent(key, () => new Film(name));
    }

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

    static Names = {
        title: "Title",
        imdbId: "IMDb ID",
        tmdbId: "TMDB ID",
        imdbRating: "IMDb rating",
        tmdbRating: "Rotten Tomatoes rating",
        year: "Year",
        runtime: "Runtime",
    };

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

    static PictureUrls = {
        "Title": params.filmImageLocation,
        "Original title": params.filmImageLocation,
        "Directors": params.directorsImageLocation,
        "Writers": params.writersImageLocation,
        "Actors": params.actorsImageLocation,
        "Producers": params.producersImageLocation
    };

    static DetailInformationUrls = {
        "Title": params.filmDetailLocation,
        "Original title": params.filmDetailLocation,
        "Directors": params.directorsDetailLocation,
        "Writers": params.writersDetailLocation,
        "Actors": params.actorsDetailLocation,
        "Producers": params.producersDetailLocation
    };

    static getType(serie) {
        return Serie.Types[serie] ? Serie.Types[serie] : Serie.TypeString;
    }

    constructor(name) {
        super(name);
    }

    getOrCreate(key, name) {
        return super.computeIfAbsent(key, () => new SerieElement(name));
    }
}

/**
 * Map of data for all series.
 */
 class AllSeries extends AutoMap {

    constructor(name) {
        super(name);
    }

    getOrCreate(key, name) {
        return super.computeIfAbsent(key, () => new Serie(name));
    }
}

/**
 * Map of data for one film.
 */
 class Film extends AutoMap {

    constructor(name) {
        super(name);
    }

    getOrCreate(key, name) {
        return super.computeIfAbsent(key, () => new Serie(name));
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
 */
class TitleData {

    /**
     * List of serie for which the elements are indexed with film key
     * They are unique by film and year, never merged between films
     */
    static IndexedByFilm = [
        "Title", "Original title", "Outline", "Plot",
    ];

    constructor() {
        this._series = new AllSeries();
        this._films = new SerieElement();
        this._columns = [];
    }

    parse (content) {
        /** @returns {string[]} Series names */
        this._columns = content.columns;

        /** @returns {AllSeries} Indexed series data */
        this._series = new AllSeries("Root");

        const titleIdx = this._columns.findIndex(e => e==Serie.Names.title);
        const yearIdx = this._columns.findIndex(e => e==Serie.Names.year);
        content.data.forEach( row => {

            // Register the film
            const film = new Film(row[titleIdx]);
            const filmKey = `${row[titleIdx]}/${row[yearIdx]}`;
            this._films.set(filmKey, film);

            // Index columns
            this._columns.forEach( (c,i) => {
                film.getOrCreate(c, c);
                const serie = this._series.getOrCreate(c, c);
                let vals = Array.isArray(row[i]) ? row[i] : [ row[i] ];
                vals.forEach(e => {
                    const se = ""+e;
                    const te = parseInt(se, 10);
                    if (isNaN(te) || te>=0) {
                        const seKey = TitleData.IndexedByFilm.includes(c) ? filmKey : se;
                        serie.getOrCreate(seKey, se).set(filmKey, film);
                        film.getOrCreate(c, c).set(seKey, serie.get(seKey));
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
     * Accessor to the whole films list
     * 
     * @returns {SerieElement} The whole films list
     */
    films() { return this._films; }

    /**
     * Accessor to a specific serie.
     * 
     * @param {string} name Serie name
     * @returns {Serie?} The required Serie or the whole Map if no name given or null if not found
     */
    series(name) { return this._series.getOrCreate(name, name); }
}

/**
 * Builds the Image Url from the pattern for a given serie type
 * 
 * @param {string} serieName Serie name
 * @param {object} variables List of variables
 * @returns {string} The URL
 */
function imageUrl(serieName, variables) {
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
function detailUrl(serieName, variables) {
    const detailUrlPattern = Serie.DetailInformationUrls[serieName];
    if (detailUrlPattern) {
        const resolver = new Function("return `"+detailUrlPattern.replaceAll("${","${this.") +"`;");
        return absoluteUrl(resolver.call(variables));
    }
    return null;
}
