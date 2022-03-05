import * as d3 from "https://cdn.skypack.dev/d3@7";
import { Listened } from "./lib/util.js";

export { UiFastSearch };

/**
 * Class to handle the left tray of the page
 * 
 * Fired events:
 *   - "change": function(text)
 * 
 */
class UiFastSearch extends Listened {

    /**
     * Construtor to set the handlers
     */
    constructor() {
        super();
        // Needed to guess drag direction
        this.input = d3.select("#fast-search-input")
            .on("input", () => this.fire("change", this.input.property("value")))
            ;
    }
}
