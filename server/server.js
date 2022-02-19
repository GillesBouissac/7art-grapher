const http = require('http');
const fs = require('fs');
const path = require('path')
const url = require('url');
const axios = require('axios');
const util = require('util');

const host = '0.0.0.0';
const port = 8000;
// Ce serveur se comporte en proxy pour les data dans le but d'éviter les pbs CORS côté client
const dataServer = "https://www.serveurperso.com";
const clientDir = "./client";

const onlyExternal = true;

const ext2mime = {
    ".js":      "text/javascript",
    ".json":    "application/json",
    ".csv":     "text/csv",
    ".html":    "text/html",
    ".svg":     "image/svg+xml",
    ".png":     "image/png",
};

const ifLogActive = function ( req, closure ) {
    if ( !onlyExternal || req.connection.remoteAddress!="127.0.0.1" ) {
        closure();
    }
}

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
    .catch(err => {
        res.writeHead(302, {'Location': '/index.html'});
        res.end();
    });
}

const proxyData = function (filePath, req, res) {
    const ext = path.extname(filePath);
    let contentType = ext2mime[ext] ? ext2mime[ext] : "text/html";

    const originUrl = `${dataServer}${filePath}`;
    const start = Date.now();

    axios.get(originUrl)
    .then(response => {
        res.setHeader("Content-Type", contentType);
        res.writeHead(200);
        res.end(JSON.stringify(response.data));
        ifLogActive ( req, () => console.log(`${originUrl}: ${Date.now()-start} ms`));
    })
    .catch(err => {
        res.writeHead(302, {'Location': '/index.html'});
        res.end();
    });
}

const requestListener = function (req, res) {
    ifLogActive ( req, () => console.log(`${req.connection.remoteAddress} - Request for ${req.url}`));
    const parsed = url.parse(req.url, true);
    if ( parsed.pathname.startsWith("/stats") ) {
        proxyData(parsed.pathname, req, res);
    }
    else{
        serveFile(`${clientDir}${parsed.pathname}`, req, res);
    }
};
/*
const options = {
    key: fs.readFileSync('server/key.pem'),
    cert: fs.readFileSync('server/cert.pem')
};
const server = https.createServer(options, requestListener);
*/

// redirect stdout / stderr to file
const fsaccess = fs.createWriteStream('logs/access.log', { flags: 'a' });
const logStdout = process.stdout;
console.log = function () {
    const msg = `${(new Date).toLocaleString()} | ` + util.format.apply(null, arguments) + '\n';
    fsaccess.write(msg);
    logStdout.write(msg);
}
const fserror = fs.createWriteStream('logs/error.log', { flags: 'a' });
console.error = function () {
    const msg = `${(new Date).toLocaleString()} | ` + util.format.apply(null, arguments) + '\n';
    fserror.write(msg);
    logStdout.write(msg);
}

const server = http.createServer(requestListener);
server.listen(port, host, () => {
    console.log(`Server is running on http://${host}:${port}`);
});

