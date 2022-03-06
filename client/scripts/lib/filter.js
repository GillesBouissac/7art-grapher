import { withoutDiacritics } from "./util.js";
import { Serie } from "./title.js";

export { Filter };
export { FilterPattern };
export { FilterIntRange };

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
            // The user pattern can start with '^' or end with '$'
            const globstart = value.startsWith("^") ? "()" : "^(.*)";
            const globend = value.endsWith("$") ? "()" : "(.*)$";
            // We don't want withoutDiacritics to remove any '^' which are part of regex patterns
            const userPattern = withoutDiacritics(value.replace(/[\^]/g, "\uFFFF")).replace(/\uFFFF/g, "^");
            this.regex = new RegExp(`${globstart}(${userPattern})${globend}`,"i");
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

