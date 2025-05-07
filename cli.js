#!/bin/env node
import Spider8831 from "./index.js";
import { parseArgs } from "util";
import { readFileSync, appendFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { join } from "path";

const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
        help: { type: "boolean", "short": "h" },
        input: { type: "string", "short": "i", multiple: true },
        output: { type: "string", "short": "o" },
        silent: { type: "boolean", "short": "s" },
        width: { type: "string", "short": "W" },
        height: { type: "string", "short": "H" },
        follow: { type: "string", "short": "F" },
        depth: { type: "string", "short": "D" },
    }
});

if(values.help) {
    console.log(`
Spider8831 usage:

spider8831 [-hs] [-i INPUT_FILE] [-o OUTPUT_DIR] [-W WIDTH] [-H HEIGHT] [-F FOLLOW] [-D DEPTH] [...websites]
TODO for devs
`);
    process.exit(0);
}

/** @type {import("./index.js").Spider8831Link[]} */
const urls = positionals
    .concat(values.input ? values.input.map(x => readFileSync(x, "utf-8").split("\n").filter(Boolean)).flat() : [])
    .map(x => ({ url: x, depth: 0 }));
if(urls.length === 0) {
    console.log("No URLs provided.");
    process.exit(1);
}

/** @type {import("./index.js").Spider8831Options} */
const opts = {};
if(values.depth) opts.depth = parseInt(values.depth);
if(values.follow) opts.follow = new RegExp(values.follow);
if(values.width) opts.width = parseInt(values.width);
if(values.height) opts.height = parseInt(values.height);
const spider = new Spider8831(opts);

/** @param {import("./index.js").Spider8831CallbackOpts} data */
const cb = (data) => {
    if(values.silent) return;
    console.log({
        image: "\x1b[32m\x1b[1mIMAGE\x1b[0m",
        link: "\x1b[34m\x1b[1mLINK\x1b[0m",
        error: "\x1b[31m\x1b[1mERROR\x1b[0m"
    }[data.type] + ": " + data.url);
};

if(values.output && !existsSync(values.output)) {
    mkdirSync(values.output);
}
if(values.output) {
    writeFileSync(join(values.output, "index.txt"), "");
}
let out = [], n = 0;

(async () => {
    while(urls.length > 0) {
        const url = urls[0];
        const res = await spider.scan(url.url, url.depth, cb);
        if(res.imgs.length !== 0 || res.next.length !== 0) console.log(`Scanned ${url.url} (depth ${url.depth})`);
        for(const img of res.imgs) {
            out.push(img.url);
            if(values.output) {
                const ind = img.url.lastIndexOf(".");
                const ext = ind === -1 ? img.url : img.url.slice(ind);
                if(!Spider8831.imgURL(img.url)) continue;
                writeFileSync(join(values.output, n + ext), img.img);
                appendFileSync(join(values.output, "index.txt"), `${n}: ${img.url}\n`);
                n++;
            }
        }
        for(const url of res.next) {
            urls.push(url);
        }
        urls.splice(0, 1);
    }

    for(const outURL of out) {
        console.log(outURL);
    }
})();