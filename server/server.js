import * as http from "http";
import * as fs from "fs";
import * as path from "path";
import * as url from "url";
import * as util from "util";
import params from "./parameters.js";
import axios from "axios";

const host = "0.0.0.0";
const port = 8000;
const clientDir = "./client";

const onlyExternal = true;

const ext2mime = {
    ".js":      "text/javascript",
    ".json":    "application/json",
    ".csv":     "text/csv",
    ".html":    "text/html",
    ".svg":     "image/svg+xml",
    ".png":     "image/png",
    ".css":     "text/css",
};

const ifLogActive = function ( req, closure ) {
    if ( !onlyExternal || req.connection.remoteAddress!="127.0.0.1" ) {
        closure();
    }
};

const send404 = function (req, res) {
    const filePath = `${clientDir}/404.html`;

    const ext = path.extname(filePath);
    let contentType = ext2mime[ext] ? ext2mime[ext] : "text/html";
    const start = Date.now();

    fs.promises
    .readFile(filePath)
    .then (contents => {
        res.setHeader("Content-Type", contentType);
        res.writeHead(404);
        res.end(contents);
        ifLogActive ( req, () => console.log(`${filePath}: ${Date.now()-start} ms`));
    })
    .catch(() => {
        res.setHeader("Content-Type", contentType);
        res.writeHead(404);
        res.end("404 Not Found\n");
    });
};

const serveFile = function (filePath, req, res) {
    const ext = path.extname(filePath);
    let contentType = ext2mime[ext] ? ext2mime[ext] : "text/html";
    const start = Date.now();

    fs.promises
    .readFile(filePath)
    .then (contents => {
        res.setHeader("Content-Type", contentType);
        res.writeHead(200);
        res.end(contents);
        ifLogActive ( req, () => console.log(`${filePath}: ${Date.now()-start} ms`));
    })
    .catch(() => {
        console.log(`${req.connection.remoteAddress} - Cannot serve ${req.url}`);
        send404(req, res);
    });
};

const proxyData = function (filePath, req, res) {
    const ext = path.extname(filePath);
    let contentType = ext2mime[ext] ? ext2mime[ext] : "text/html";

    const originUrl = `${filePath}`;
    const start = Date.now();

    axios.get(originUrl)
    .then(response => {
        res.setHeader("Content-Type", contentType);
        res.writeHead(200);
        res.end(JSON.stringify(response.data));
        ifLogActive ( req, () => console.log(`${originUrl}: ${Date.now()-start} ms`));
    })
    .catch(() => {
        console.log(`${req.connection.remoteAddress} - Cannot serve ${req.url}`);
        send404(req, res);
    });
};

const requestListener = function (req, res) {
    ifLogActive ( req, () => console.log(`${req.connection.remoteAddress} - Request for ${req.url}`));
    const parsed = url.parse(req.url, true);
    const proxies = params.proxies
        .filter(p => parsed.pathname.startsWith(p.prefix))
        .map(p => p.target + parsed.pathname.substring(p.prefix.length));
    if ( proxies.length ) {
        proxyData(proxies[0], req, res);
    }
    else{
        let filePath = "";
        if (parsed.pathname=="/favicon.ico") {
            filePath = "/favicon.ico";
        }
        else {
            filePath = parsed.pathname.substring(params.rootPrefix.length);
            if (filePath=="/") filePath = "/index.html";
        }
        serveFile(`${clientDir}${filePath}`, req, res);
    }
};

// redirect stdout / stderr to file
const fsaccess = fs.createWriteStream("logs/access.log", { flags: "a" });
// eslint-disable-next-line no-undef
const logStdout = process.stdout;
console.log = function () {
    const msg = `${(new Date).toLocaleString()} | ` + util.format.apply(null, arguments) + "\n";
    fsaccess.write(msg);
    logStdout.write(msg);
};
const fserror = fs.createWriteStream("logs/error.log", { flags: "a" });
console.error = function () {
    const msg = `${(new Date).toLocaleString()} | ` + util.format.apply(null, arguments) + "\n";
    fserror.write(msg);
    logStdout.write(msg);
};

const server = http.createServer(requestListener);
server.listen(port, host, () => {
    console.log(`Server is running on http://${host}:${port}`);
});

