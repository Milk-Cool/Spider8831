import { JSDOM } from "jsdom";
import { imageSize } from "image-size";

/**
 * @typedef {object} Spider8831Options
 * @property {number} [width]
 * @property {number} [height]
 * @property {RegExp | (url: string) => boolean | false} [follow]
 * @property {number} [depth]
 */
/**
 * @typedef {object} Spider8831CallbackOpts
 * @property {"image" | "link" | "error"} type
 * @property {string} url
 */
/**
 * @typedef {object} Spider8831Link
 * @property {string} url
 * @property {number} depth
 */
/**
 * @typedef {object} Spider8831Image
 * @property {string} url
 * @property {Buffer} img
 */
/**
 * @typedef {object} Spider8831Return
 * @property {Spider8831Link[]} next
 * @property {Spider8831Image[]} imgs
 */

export default class Spider8831 {
    static defaultFollow = /^https?:\/\/.+\.neocities\.org/;

    /**
     * @param {string} url
     * @returns {boolean}
     */
    static imgURL(url) {
        const urlObj = new URL(url);
        return urlObj.pathname.match(/\.(png|jpe?g|gif|webp|bmp)$/);
    }

    /**
     * @param {Spider8831Options} options 
     */
    constructor(options) {
        this.width = options.width ?? 88;
        this.height = options.height ?? 31;
        this.follow = options.follow ?? (() => Spider8831.defaultFollow);
        this.depth = options.depth ?? 5;

        /** @type {string[]} */
        this.visited = [];
    }

    /**
     * @param {string | URL} url
     * @returns {Promise<JSDOM>}
     */
    static async fetchJSDOM(url) {
        const f = await fetch(url);
        const t = await f.text();
        const dom = new JSDOM(t, { contentType: "text/html" });
        return dom;
    }

    /**
     * @param {string | URL} url 
     * @returns {Promise<Buffer>}
     */
    static async fetchImage(url) {
        const f = await fetch(url);
        const b = Buffer.from(await f.arrayBuffer());
        return b;
    }

    /**
     * @param {Buffer} buf 
     * @returns {[number,  number]}
     */
    static getImageSize(buf) {
        const dim = imageSize(buf);
        return [dim.width, dim.height];
    }

    /**
     * @param {string | URL}
     * @returns {string}
     */
    static getURL(url) {
        if(url instanceof URL) url = url.href;
        return url;
    }

    /**
     * @param {string}
     * @returns {boolean}
     */
    checkURL(url) {
        return !this.visited.includes(url)
            && (this.follow instanceof RegExp ? !!url.match(this.follow) : this.follow(url));
    }

    /**
     * Scans a single page recursively.
     * @param {string | URL} url
     * @param {number} [depth]
     * @param {(opts: Spider8831CallbackOpts) => void} [cb]
     * @returns {Promise<Spider8831Return>}
     */
    async scan(url, depth = 0, cb = (_opts) => {}) {
        if(depth >= this.depth) return { next: [], imgs: [] };
        url = Spider8831.getURL(url);
        this.visited.push(url);
        /** @type {JSDOM} */
        let dom;
        try {
            dom = await Spider8831.fetchJSDOM(url);
        } catch(_) {
            cb?.({ type: "error", url: url });
            return { next: [], imgs: [] };
        }
        const { document } = dom.window;
        const links = Array.from(document.querySelectorAll("a"));
        const images = Array.from(document.querySelectorAll("img"));
        
        /** @type {Spider8831Link[]} */
        const next = [];
        /** @type {Spider8831Image[]} */
        const imgs = [];

        for(const link of links) {
            let href = link.href;
            if(!href) continue;
            href = new URL(href, new URL(url).origin).href;
            if(!this.checkURL(href)) continue;
            cb?.({ type: "link", url: href });
            next.push({ depth: depth + 1, url: href });
        }
        for(const img of images) {
            let src = img.src;
            if(!src) continue;
            src = new URL(src, new URL(url).origin).href;
            this.visited.push(src);
            try {
                const img = await Spider8831.fetchImage(src);
                const size = Spider8831.getImageSize(img);
                if(size[0] !== this.width || size[1] !== this.height) continue;
                cb?.({ type: "image", url: src });
                imgs.push({ img, url: src });
            } catch(_) {
                cb?.({ type: "error", url: src });
            }
        }
        return { imgs, next };
    }
}