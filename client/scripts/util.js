import * as d3 from 'https://cdn.skypack.dev/d3@7';
export { logDate };
export { compareAlphanumeric };
export { colorScale };


const logDate = () => (new Date()).toISOString();

/**
 * Compares 2 strings using alphanumeric algorithm (debian version comparator).
 * ex: "2" < "20"
 *     "2aaa3yy" < "2aaa30b"
 *     "2aaa3yy" < "2zzz3yy"
 * 
 * @param {string} a 
 * @param {string} b 
 * @returns -1/0/+1
 */
const compareAlphanumeric = (a,b) => (""+a).localeCompare((""+b),undefined,{numeric:true,sensitivity:'base'});

const colorScale = () => new ColorScale();
class ColorScale extends Function {

    constructor() {
        super();
        this._scale = d3.scaleOrdinal();
        this.interpolator(d3.piecewise(d3.interpolateHsl, ["blue","Aqua","LawnGreen","yellow","orange","red"]));
        this.count(100);
        return new Proxy(this, {
            apply: (target, _, args) => target._call(...args)
        })
    }

    domain(val) {
        if(val != null) {
            this._domain=val;
            this._count=this._domain.length;
            this.update();
            return this;
        };
        return this._domain; 
    }

    count(val) {
        if(val != null) {
            this._count=val+1;
            this._domain = d3.range(this._count);
            this.update();
            return this;
        };
        return this._count; 
    }

    interpolator(val) {
        if(val != null) {
            this._interpolator=val;
            this.update();
            return this;
        };
        return this._interpolator; 
    }

    update() {
        if (this._domain && this._interpolator)
            this._scale
                .range(d3.range(this._count).map((_,i) => this._interpolator(i/(this._count-1))))
                .domain(this._domain)
    }

    _call(args) {
        return this._scale(args);
    }

}
