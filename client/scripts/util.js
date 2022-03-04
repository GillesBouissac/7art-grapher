import * as d3 from "https://cdn.skypack.dev/d3@7";

export { logDate };
export { compareAlphanumeric };
export { colorScale };
export { absoluteUrl };
export { withoutDiacritics };
export { AutoMap };
export { Listeners };


const logDate = () => (new Date()).toISOString();
const colorScale = () => (new ColorScale());

/**
 * Removes diacritics from a string
 * 
 * @param {string} str source string
 * @returns {string} The string without diacritics
 */
function withoutDiacritics(str) {
    return str.normalize("NFD").replace(/\p{Diacritic}/gu, "");
}

/**
 * Converts a relative path to an absolute URL, don't change absolute URLs
 * 
 * @param {string} inputPath Any path (relative or absolute)
 * @returns {string} An absolute path
 */
function absoluteUrl (inputPath) {
    if ( /^([^/:]*:\/\/)/.test(inputPath) ) {
        return inputPath; // absolute URL
    }
    else if ( /^\//.test(inputPath) ) {
        return location.origin + inputPath; // absolute path on this server
    }
    let nUpLn = 0;
    let sDir = "";
    const sPath = location.pathname.replace(/[^/]*$/, inputPath.replace(/(\/|^)(?:\.?\/+)+/g, "$1"));
    for (var nEnd, nStart = 0; nEnd = sPath.indexOf("/../", nStart), nEnd>-1; nStart = nEnd + nUpLn) {
        nUpLn = /^\/(?:\.\.\/)*/.exec(sPath.slice(nEnd))[0].length;
        sDir = (sDir + sPath.substring(nStart, nEnd)).replace(new RegExp("(?:\\/+[^\\/]*){0," + ((nUpLn - 1) / 3) + "}$"), "/");
    }
    return location.origin + sDir + sPath.substring(nStart);
}

/**
 * Compares 2 strings using alphanumeric algorithm (debian version comparator).
 * ex: "2" < "20"
 *     "2aaa3yy" < "2aaa30b"
 *     "2aaa3yy" < "2zzz3yy"
 * 
 * @param {string} a The first string to compare
 * @param {string} b The second string to compare
 * @returns {number} -1(a<b)/0(a==b)/+1(a>b)
 */
function compareAlphanumeric(a,b) {
    return (""+a).localeCompare((""+b),undefined,{numeric:true,sensitivity:"base"});
}

/**
 * Map that allow entries creation and get in one call.
 */
class AutoMap extends Map {

    /**
     * Each list of object must have a name
     * 
     * @param {string} name The map name
     */
    constructor(name) {
        super();
        this._name = name;
    }

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
 * Map of listeners.
 */
 class Listeners extends AutoMap {
    constructor(mgr) {
        super("Filter events listeners");
        this.mgr = mgr;
    }
    getOrCreate(event) {
        return super.computeIfAbsent(event, () => new Set());
    }
    fire(event) {
        const args = [...arguments].slice(1);
        this.getOrCreate(event).forEach(cb => cb.call(this.mgr, ...args));
    }
}

class ColorScale extends Function {

    constructor() {
        super();
        this._scale = d3.scaleOrdinal();
        this.interpolator(d3.piecewise(d3.interpolateHsl, ["blue","Aqua","LawnGreen","yellow","orange","red"]));
        this.count(100);
        return new Proxy(this, {
            apply: (target, _, args) => target._call(...args)
        });
    }

    domain(val) {
        if(val != null) {
            this._domain=val;
            this._count=this._domain.length;
            this.update();
            return this;
        }
        return this._domain; 
    }

    count(val) {
        if(val != null) {
            this._count=val+1;
            this._domain = d3.range(this._count);
            this.update();
            return this;
        }
        return this._count; 
    }

    interpolator(val) {
        if(val != null) {
            this._interpolator=val;
            this.update();
            return this;
        }
        return this._interpolator; 
    }

    update() {
        if (this._domain && this._interpolator)
            this._scale
                .range(d3.range(this._count).map((_,i) => this._interpolator(i/(this._count-1))))
                .domain(this._domain);
    }

    _call(args) {
        return this._scale(args);
    }

}
