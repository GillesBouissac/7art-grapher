// @ts-check
import { compareAlphanumeric, logDate, AutoMap, absoluteUrl, buildEval, maxDecimal, convertUnit } from "./util.js";
import parameters from "../parameters.js";

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
        this._summary = {};
    }
    getOrCreate(key, name) {
        return super.computeIfAbsent(key, () => new Film(name));
    }

    /**
     * Film serie summary accessor
     * - For number values this is the average
     * - For string values this is a concatenation with "," as separator
     * 
     * @param {string} serie Name of the serie
     * @returns {string} The computed average
     */
    summary(serie) {
        if (!Object.prototype.hasOwnProperty.call(this._summary,serie)) {
            if (serie==Serie.SortCriterionKey) {
                this._summary[serie] = this.name();
            }
            else if (serie==Serie.SortCriterionCount) {
                this._summary[serie] = ""+this.size;
            }
            else {
                const vals=[];
                this.forEach(film => {
                    if (film.get(serie)==undefined) {
                        console.error(`Error, serie '${serie}' is missing in data for '${film.name()}' `);
                    }
                    else {
                        [...film.get(serie).values()].forEach( v =>
                            vals.push(v.name())
                        );
                    }
                });
                if (vals.length==0) {
                    this._summary[serie] = "-";
                }
                else {
                    if ( parameters.series[serie] && parameters.series[serie].type==Serie.TypeString) {
                        const unique = vals.filter(function(item, pos) {
                            return vals.indexOf(item) == pos;
                        });
                        this._summary[serie] = unique.join(", ");
                    }
                    else if ( parameters.series[serie] && parameters.series[serie].type==Serie.TypeTimeStamp) {
                        const unique = vals.filter(function(item, pos) {
                            return vals.indexOf(item) == pos;
                        }).map(t => new Date(t*1000).toDateString());
                        this._summary[serie] = unique.join(", ");
                    }
                    else {
                        this._summary[serie] = 0;
                        const sum = vals.reduce(function (p,c){
                            let v = parseFloat(c);
                            v = isNaN(v) ? 0 : v;
                            return p+v;
                        },0);
                        this._summary[serie] = ""+maxDecimal(sum/vals.length,3);
                    }
                }
            }
        }
        return this._summary[serie];
    }

    /**
     * Return the list of keys in summarized series
     * 
     * @returns {string[]} list of keys
     */
    getSummarizedSeries() {
        return Object.getOwnPropertyNames(this._summary);
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
        return compareAlphanumeric(this.summary(serie), b.summary(serie));
    }
}

/**
 * Map of data for one serie.
 */
class Serie extends AutoMap {
    static SerieNull = "---";
    static TypeNumber = "number";
    static TypeString = "string";
    static TypeTimeStamp = "timestamp";
    static TypeNull = "null";
    static SortCriterionKey = "Nom";
    static SortCriterionCount = "Nombre de films";
    static SortCriterionNone = Serie.SerieNull;

    static Names = {
        title: "Title",
        imdbId: "IMDb ID",
        tmdbId: "TMDb ID",
        imdbRating: "IMDb rating",
        tmdbRating: "TMDb vote average",
        tomatoeRating: "Rotten Tomatoes rating",
        year: "Year",
        runtime: "Runtime",
    };

    /**
     * List of main sort criteria by serie
     * Default to SortCriterionCount if not in this list
     */
    static SortCriteria = {
        "Year": [Serie.SortCriterionKey],
        "Runtime": [Serie.SortCriterionKey],
        "IMDb rating": [Serie.SortCriterionKey],
        "Rotten Tomatoes rating": [Serie.SortCriterionKey],
        "IMDb ID": [Serie.SortCriterionKey],
        "TMDb ID": [Serie.SortCriterionKey],
        "TMDb vote average": [Serie.SortCriterionKey],
        "TMDb vote count": [Serie.SortCriterionKey],
        "TMDb popularity": [Serie.SortCriterionKey],
        "Budget": [Serie.SortCriterionKey],
        "Revenue": [Serie.SortCriterionKey],
        "Timestamp": [Serie.SortCriterionKey],
    };

    static getType(serie) {
        if (serie=="---") return Serie.TypeNull;
        if (!Object.hasOwnProperty(serie)) return Serie.TypeString;
        return parameters.series[serie].type;
    };
    static getSeriesWithPicture() {
        return Object.getOwnPropertyNames(parameters.series).filter(k => {
            return parameters.series[k].imageUrl != undefined;
        });
    }
    static getPictureUrl(serie) {
        if (!parameters.series.hasOwnProperty(serie)) return undefined;
        return parameters[parameters.series[serie].imageUrl];
    };
    static getDetailInformationUrl(serie) {
        if (!parameters.series.hasOwnProperty(serie)) return undefined;
        return parameters[parameters.series[serie].detailUrl];
    };
    /**
     * @typedef {Object} LayoutList
     * @property {any[][]} outline [key, values, unit] pairs that are to be displayed in title part
     * @property {any[][]} detail [key, values, unit] pairs that are to be displayed in detail part
     */
    /**
     * Returns the list layout items for the given serie with titles from configuration
     *   and values fetched from dataset
     * 
     * @param {SerieElement} serieElement The serie to check
     * @returns {LayoutList} The completed layout or null
     */
    getSerielistLayout(serieElement) {
        const serieParams = parameters.series[this._name];
        if (!serieParams || !serieParams.listLayout) return null;
        const layoutParams = parameters[serieParams.listLayout];
        if (!layoutParams) {
            console.error(`Layout '${serieParams.listLayout}' used in serie '${this._name}' parameters is not defined`);
            return null;
        }
        const result = {outline:[], detail:[]};
        if (layoutParams.outline) layoutParams.outline.forEach( sr => {
            const su = sr.split("|");
            const v = convertUnit(serieElement.summary(su[0]), "", su[1]);
            result.outline.push([ su[0], v ]);
        });
        if (layoutParams.detail) layoutParams.detail.forEach( sr => {
            const su = sr.split("|");
            const v = convertUnit(serieElement.summary(su[0]), "", su[1]);
            result.detail.push([ su[0], v ]);
        });
        return result;
    }
    /**
     * Return true if 2 identical values in a serie relates to 2 differents objects
     * false if 2 identical values are in fact the same object and can be merged
     * 
     * @param {string} serie The serie to check
     * @returns {boolean} The check result
     */
    static canHaveDuplicates(serie) {
        if (!parameters.series.hasOwnProperty(serie)) return false;
        if (!parameters.series[serie].allowDuplicates) return false;
        return parameters.series[serie].allowDuplicates;
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
                        const seKey = Serie.canHaveDuplicates(c) ? filmKey : se;
                        serie.getOrCreate(seKey, se).set(filmKey, film);
                        film.getOrCreate(c, c).set(seKey, serie.get(seKey));
                    }
                });
            });
        });
        console.log(`${logDate()} Data parsed`);
        // Forces summaries computation on displayable lists
/*
        const pseries = Object.getOwnPropertyNames(parameters.series)
            .filter(k => parameters.series[k].listLayout!=undefined);
        this._series.forEach ( s1 => {
            if (pseries.includes(s1.name())) {
                s1.forEach ( se => {
                    se.summary(Serie.SortCriterionKey);
                    se.summary(Serie.SortCriterionCount);
                    this._columns.forEach ( s2 => {
                        se.summary(s2);
                    });
                });
            }
        });
        console.log(`${logDate()} Data summerised`);
*/
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
    const imgUrlPattern = Serie.getPictureUrl(serieName);
    if (imgUrlPattern) {
        const evalFun = buildEval(imgUrlPattern, variables);
        return absoluteUrl(evalFun.call(variables));
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
    const detailUrlPattern = Serie.getDetailInformationUrl(serieName);
    if (detailUrlPattern) {
        const evalFun = buildEval(detailUrlPattern, variables);
        return absoluteUrl(evalFun.call(variables));
    }
    return null;
}
