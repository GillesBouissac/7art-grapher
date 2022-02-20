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
     * @See https://www.baeldung.com/java-map-computeifabsent.
     * @param {*} key 
     * @param {*} mappingFunction 
     * @returns 
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
    static SortCriteriaKey = "Etiquette";
    static SortCriteriaCount = "Nombre de films";
    static SortCriteriaNone = "---";

    constructor(name) {
        super();
        this._name = name;
        this._averages = {};
    }
    getOrCreate(key) {
        return super.computeIfAbsent(key, () => new Film());
    }
    /** Name accessor. */
    name() {return this._name; }
    /** Film serie average accessor. */
    average(serie) {
        if (!this._averages.hasOwnProperty(serie)) {
            this._averages[serie] = 0;
            if (this.size>0) {
                let sum=0;
                this.forEach(film => {
                    const filmElems = Array.from(film.get(serie).keys());
                    const vals = filmElems.map(e=>{
                        const val = parseFloat(e);
                        if (isNaN(val)) return 0;
                        return val;
                    });
                    sum += vals.reduce((p,c)=>p+c,0);
                });
                this._averages[serie] = sum/this.size;
            }
        }
        return this._averages[serie];
    }
    /** Compares 2 elements of by name. */
    compareByName(b) {
        return compareAlphanumeric(this._name,b._name);
    }
    /** Compares 2 elements of by film count. */
    compareByCount(b) {
        return this.size - b.size;
    }
    /** Compares 2 elements of by film serie value. */
    compareBySerie(serie,b) {
        if ( serie==SerieElement.SortCriteriaNone ) return 0;
        if ( serie==SerieElement.SortCriteriaKey ) return this.compareByName(b);
        if ( serie==SerieElement.SortCriteriaCount ) return this.compareByCount(b);
        return this.average(serie) - b.average(serie);
    }
}

/**
 * Map of data for one serie.
 */
class Serie extends AutoMap {
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

    parse ( content ) {
        this._columns = content.columns;
        // Index series to film
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
    }

    columns() { return this._columns; }
    films(name) { return name ? this._series.get(TitleColName).get(name) : this._series.get(TitleColName); }
    series(name) { return name ? this._series.get(name) : this._series; }
}

