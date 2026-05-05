/*! 
 * @name 全豆要[聚合音源] v13.1 极智无损版
 * @description 全面重构：智能健康调度、极致防错歌、无损底线守护、LRU缓存
 * @version v13.1
 * @author 全豆要 & 深度优化重构 
 */

// ==================== 【全局开关配置】====================
const GLOBAL_CONFIG = {
    enableHealthSchedule: true,  // 智能健康调度（自动避障挂掉的源）
    enableStrictMatch: true,     // 严格防错歌（基于ID正则硬校验）
    enableQualityFallback: true, // 降级兜底（仅限有损之间降级，无损绝不降有损）
    enableLRUCache: true,        // LRU内存缓存优化
    timeout: {
        template: 3000,          // 模板类源超时
        api: 8000                // API类源超时
    },
    sources: {                   // 独立音源开关
        changqingVip: true,
        nianxinVip: true,
        ikun: true,
        aggregate: true
    }
};

// ==================== 【常量与正则定义】====================
const CACHE_TTL_MS = 21600000; // 6小时
const CACHE_MAX_SIZE = 500;
const HTTP_URL_REGEX = /^https?:\/\//i;

// API 端点
const IKUN_API_URL = "https://c.wwwweb.top";
const AGGREGATE_API_URL = "https://api.music.lerd.dpdns.org";

// 长青/念心 URL模板
const CHANGQING_URL_TEMPLATES = {
    tx: "http://175.27.166.236/kgqq/qq.php?type=mp3&id={id}&level={level}",
    wy: "http://175.27.166.236/wy/wy.php?type=mp3&id={id}&level={level}",
    kw: "https://musicapi.haitangw.net/music/kw.php?type=mp3&id={id}&level={level}",
    kg: "https://music.haitangw.cc/kgqq/kg.php?type=mp3&id={id}&level={level}",
    mg: "https://music.haitangw.cc/musicapi/mg.php?type=mp3&id={id}&level={level}"
};
const NIANXIN_URL_TEMPLATES = {
    tx: "https://music.nxinxz.com/kgqq/tx.php?id={id}&level={level}&type=mp3",
    wy: "http://music.nxinxz.com/wy.php?id={id}&level={level}&type=mp3",
    kw: "http://music.nxinxz.com/kw.php?id={id}&level={level}&type=mp3",
    kg: "http://music.nxinxz.com/kgqq/kg.php?id={id}&level={level}&type=mp3",
    mg: "http://music.nxinxz.com/mg.php?id={id}&level={level}&type=mp3"
};

// 音质配置
const PLATFORM_QUALITIES = {
    wy: ["24bit", "flac", "320k", "192k", "128k"],
    tx: ["24bit", "flac", "320k", "192k", "128k"],
    kw: ["24bit", "flac", "320k", "192k", "128k"],
    kg: ["24bit", "flac", "320k", "192k", "128k"],
    mg: ["24bit", "flac", "320k", "192k", "128k"]
};
const FALLBACK_QUALITIES = ["24bit", "flac", "320k", "128k"]; // 降级兜底顺序
const HIRES_QUALITY_SET = new Set(["24bit", "flac", "flac24bit", "hires"]);

// ==================== 【严格防错歌：ID正则白名单】====================
const STRICT_ID_REGEX = {
    tx: {
        mid: /^[a-zA-Z0-9]{10,20}$/,
        songid: /^\d{5,12}$/
    },
    wy: /^\d{5,12}$/,
    kw: /^\d{5,12}$/,
    kg: /^[a-fA-F0-9]{32}$/,
    mg: /^\d{5,15}$/
};

const { EVENT_NAMES, request, on, send } = globalThis.lx;

// ==================== 【LRU缓存优化】====================
const urlCache = new Map();
const cacheKeys = [];

function getCachedUrl(cacheKey) {
    if (!GLOBAL_CONFIG.enableLRUCache) return null;
    const entry = urlCache.get(cacheKey);
    if (!entry) return null;
    if (Date.now() - entry.timestamp >= CACHE_TTL_MS) {
        removeCacheKey(cacheKey);
        return null;
    }
    const idx = cacheKeys.indexOf(cacheKey);
    if (idx > -1) cacheKeys.splice(idx, 1);
    cacheKeys.push(cacheKey);
    return entry.url;
}

function setCachedUrl(cacheKey, url) {
    if (!GLOBAL_CONFIG.enableLRUCache) return;
    if (urlCache.has(cacheKey)) removeCacheKey(cacheKey);
    urlCache.set(cacheKey, { url, timestamp: Date.now() });
    cacheKeys.push(cacheKey);
    while (cacheKeys.length > CACHE_MAX_SIZE) {
        removeCacheKey(cacheKeys.shift());
    }
}

function removeCacheKey(key) {
    urlCache.delete(key);
    const idx = cacheKeys.indexOf(key);
    if (idx > -1) cacheKeys.splice(idx, 1);
}

// ==================== 【智能健康调度系统】====================
class HealthScheduler {
    constructor() {
        this.stats = new Map();
        this.COOLDOWN_BASE = 30000;
    }
    _get(name) {
        if (!this.stats.has(name)) this.stats.set(name, { score: 100, fails: 0, cooldownUntil: 0 });
        return this.stats.get(name);
    }
    recordSuccess(name) {
        if (!GLOBAL_CONFIG.enableHealthSchedule) return;
        const s = this._get(name);
        s.score = Math.min(100, s.score + 5);
        s.fails = 0;
    }
    recordFail(name, err) {
        if (!GLOBAL_CONFIG.enableHealthSchedule) return;
        const s = this._get(name);
        s.fails += 1;
        s.score = Math.max(0, s.score - (10 * s.fails));
        if (s.fails >= 2) {
            s.cooldownUntil = Date.now() + (this.COOLDOWN_BASE * Math.pow(1.5, s.fails - 2));
        }
    }
    isAvailable(name) {
        if (!GLOBAL_CONFIG.enableHealthSchedule) return true;
        const s = this._get(name);
        return Date.now() > s.cooldownUntil;
    }
    sortHandlers(handlers) {
        if (!GLOBAL_CONFIG.enableHealthSchedule) return handlers;
        return handlers.filter(h => this.isAvailable(h.name))
                       .sort((a, b) => this._get(b.name).score - this._get(a.name).score);
    }
}
const healthScheduler = new HealthScheduler();

// ==================== 【底层网络与工具函数】====================
// Promise.any 兼容性补丁
function promiseAny(promises) {
    return new Promise((resolve, reject) => {
        let pending = promises.length;
        const errors = [];
        if (pending === 0) return reject(new Error('No promises'));
        promises.forEach((p, idx) => {
            Promise.resolve(p).then(resolve).catch(err => {
                errors[idx] = err;
                if (--pending === 0) reject(new Error(errors.map(e => e?.message || String(e)).join('; ')));
            });
        });
    });
}

function httpRequest(url, options = {}) {
    return new Promise((resolve, reject) => {
        const timeout = options.timeout || 5000;
        request(url, { timeout, ...options }, (err, res) => {
            if (err) return reject(new Error(`网络异常: ${err.message}`));
            let body = res?.body;
            if (typeof body === "string") {
                try { body = JSON.parse(body); } catch (e) {}
            }
            resolve({ statusCode: res?.statusCode ?? 0, headers: res?.headers || {}, body });
        });
    });
}

async function httpGet(url, params = {}, timeout = 5000) {
    const queryStr = Object.keys(params).filter(k => params[k] != null).map(k => `${encodeURIComponent(k)}=${encodeURIComponent(params[k])}`).join("&");
    const fullUrl = url + (queryStr ? (url.includes("?") ? "&" : "?") + queryStr : "");
    const res = await httpRequest(fullUrl, { method: "GET", timeout });
    if (res.statusCode >= 400) throw new Error(`HTTP ${res.statusCode}`);
    return res.body;
}

async function httpPost(url, body = {}, timeout = 5000) {
    const res = await httpRequest(url, { method: "POST", headers: { "Content-Type": "application/json" }, body, timeout });
    if (res.statusCode >= 400) throw new Error(`HTTP ${res.statusCode}`);
    return res.body;
}

function selectQuality(requested, supported) {
    const req = String(requested || "128k").toLowerCase();
    if (supported.includes(req)) return req;
    const order = ["24bit", "flac", "flac24bit", "320k", "192k", "128k"];
    let idx = order.indexOf(req);
    if (idx < 0) idx = order.length - 1;
    for (let i = idx; i < order.length; i++) if (supported.includes(order[i])) return order[i];
    return supported[supported.length - 1] || "128k";
}

// 【修复点1】：统一无损映射为 lossless，提升老接口的无损识别率
function qualityToLevel(quality) {
    const q = String(quality || "128k").toLowerCase();
    if (q.includes("flac") || q.includes("24bit") || q.includes("lossless") || q.includes("hires")) return "lossless";
    if (q.includes("320")) return "320k";
    return "128k";
}

function validateUrl(url, sourceName) {
    if (!url || typeof url !== "string") throw new Error(`${sourceName}空URL`);
    if (!HTTP_URL_REGEX.test(url.trim())) throw new Error(`${sourceName}非法URL`);
    return url.trim();
}

function buildCacheKey(prefix, songInfo, quality) {
    return `${prefix}_${songInfo?.id || songInfo?.songmid || ''}_${quality}`;
}

// ==================== 【严格防错歌：ID提取器】====================
function getStrictPlatformId(platform, songInfo) {
    if (!songInfo || !GLOBAL_CONFIG.enableStrictMatch) return songInfo?.songmid || songInfo?.id;
    let id = null;
    const meta = songInfo.meta || {};
    if (platform === "tx") {
        const mid = meta.qq?.mid || meta.mid || songInfo.songmid || (typeof songInfo.id === 'string' && !/^\d+$/.test(songInfo.id) ? songInfo.id : null);
        const songid = meta.qq?.songid || meta.songid || (typeof songInfo.id === 'number' ? songInfo.id : (typeof songInfo.id === 'string' && /^\d+$/.test(songInfo.id) ? Number(songInfo.id) : null));
        if (mid && STRICT_ID_REGEX.tx.mid.test(mid)) return mid;
        if (songid && STRICT_ID_REGEX.tx.songid.test(String(songid))) return songid;
        throw new Error(`防错拦截: TX-ID格式异常(${mid || songid})`);
    }
    id = songInfo.songmid || songInfo.id || songInfo.hash || songInfo.rid;
    if (id === null || id === undefined) throw new Error("防错拦截: 缺少核心ID");
    const strId = String(id);
    const regex = STRICT_ID_REGEX[platform];
    if (regex && !regex.test(strId)) {
        throw new Error(`防错拦截: ${platform.toUpperCase()}-ID格式疑似异常(${strId.substring(0,8)}...)`);
    }
    return id;
}

// ==================== 【音源实现层】====================
async function changqingGetUrl(platform, songId, quality, songInfo) {
    const cacheKey = buildCacheKey("changqing", songInfo, quality);
    const cached = getCachedUrl(cacheKey);
    if (cached) return cached;
    const template = CHANGQING_URL_TEMPLATES[platform];
    if (!template) throw new Error("长青不支持该平台");
    const id = songId || getStrictPlatformId(platform, songInfo);
    const level = qualityToLevel(quality);
    const url = template.replace("{id}", encodeURIComponent(String(id))).replace("{level}", level);
    const result = validateUrl(url, "长青");
    setCachedUrl(cacheKey, result);
    healthScheduler.recordSuccess("长青SVIP");
    return result;
}

async function nianxinGetUrl(platform, songId, quality, songInfo) {
    const cacheKey = buildCacheKey("nianxin", songInfo, quality);
    const cached = getCachedUrl(cacheKey);
    if (cached) return cached;
    const template = NIANXIN_URL_TEMPLATES[platform];
    if (!template) throw new Error("念心不支持该平台");
    const id = songId || getStrictPlatformId(platform, songInfo);
    const level = qualityToLevel(quality);
    const url = template.replace("{id}", encodeURIComponent(String(id))).replace("{level}", level);
    const result = validateUrl(url, "念心");
    setCachedUrl(cacheKey, result);
    healthScheduler.recordSuccess("念心SVIP");
    return result;
}

async function ikunGetUrl(platform, songId, quality, songInfo) {
    const id = songId || songInfo?.hash || songInfo?.songmid;
    if (!id) throw new Error("ikun缺ID");
    try {
        const res = await httpPost(`${IKUN_API_URL}/music/url`, 
            { source: platform, musicId: id, quality: quality }, 
            GLOBAL_CONFIG.timeout.api
        );
        if (res?.code === 200 && res.url) {
            healthScheduler.recordSuccess("ikun音源");
            return res.url;
        }
        throw new Error(res?.message || `状态码${res?.code}`);
    } catch (err) {
        healthScheduler.recordFail("ikun音源", err);
        throw err;
    }
}

async function aggregateApiGetUrl(platform, songId, quality, songInfo) {
    try {
        const res = await httpPost(`${AGGREGATE_API_URL}/${platform}`, 
            { musicInfo: songInfo, type: quality }, 
            GLOBAL_CONFIG.timeout.api
        );
        if (res.code === 200 && res.data?.url) {
            healthScheduler.recordSuccess("聚合API");
            return res.data.url;
        }
        if (res.code === 303 && res.data) {
            const reqConf = res.data.request;
            const resConf = res.data.response;
            const followRes = await httpRequest(encodeURI(reqConf.url), { ...reqConf.options, timeout: GLOBAL_CONFIG.timeout.api });
            const val = resConf.check.key.reduce((a, c) => a && a[c], followRes);
            if (val === resConf.check.value) {
                const url = resConf.url.reduce((a, c) => a && a[c], followRes);
                if (url && HTTP_URL_REGEX.test(url)) {
                    healthScheduler.recordSuccess("聚合API");
                    return url;
                }
            }
            throw new Error("重定向解析失败");
        }
        throw new Error(res.msg || "请求异常");
    } catch (err) {
        healthScheduler.recordFail("聚合API", err);
        throw err;
    }
}

// ==================== 【动态调度与降级兜底引擎】====================
const SOURCE_REGISTRY = [
    { key: 'changqingVip', name: '长青SVIP', fn: changqingGetUrl, type: 'template' },
    { key: 'nianxinVip', name: '念心SVIP', fn: nianxinGetUrl, type: 'template' },
    { key: 'ikun', name: 'ikun音源', fn: ikunGetUrl, type: 'api' },
    { key: 'aggregate', name: '聚合API', fn: aggregateApiGetUrl, type: 'api' }
];

function getActiveChain(platform) {
    let chain = SOURCE_REGISTRY.filter(s => GLOBAL_CONFIG.sources[s.key]);
    return healthScheduler.sortHandlers(chain);
}

async function executeChain(platform, songInfo, quality) {
    const chain = getActiveChain(platform);
    if (!chain.length) throw new Error("所有音源已被禁用或处于冷却");
    const errors = [];
    
    const firstBatch = chain.slice(0, 2);
    try {
        return await promiseAny(firstBatch.map(h => 
            h.fn(platform, null, quality, songInfo).then(url => validateUrl(url, h.name))
        ));
    } catch (e) {
        errors.push(...(e.message?.split('; ') || [e.message]));
    }

    for (let i = 2; i < chain.length; i++) {
        const h = chain[i];
        try {
            return validateUrl(await h.fn(platform, null, quality, songInfo), h.name);
        } catch (err) {
            errors.push(`${h.name}: ${err.message}`);
        }
    }
    throw new Error(`链路耗尽: ${errors.join(' | ')}`);
}

async function getUrlWithFallback(platform, songInfo, quality) {
    if (!PLATFORM_QUALITIES[platform]) throw new Error("无效平台");
    const selectedQuality = selectQuality(quality, PLATFORM_QUALITIES[platform]);
    
    try {
        return await executeChain(platform, songInfo, selectedQuality);
    } catch (primaryErr) {
        // 【修复点2】：无损底线守护逻辑
        if (GLOBAL_CONFIG.enableQualityFallback && selectedQuality !== "128k") {
            // 拿到刚才实际发给接口的底层参数（例如 lossless 或 320k）
            const actualLevel = qualityToLevel(selectedQuality);
            
            for (const fallbackQ of FALLBACK_QUALITIES) {
                const actualFallbackLevel = qualityToLevel(fallbackQ);
                
                // 1. 跳过无意义的同级别重试（比如24bit转lossless失败，降级列表里的flac还是转lossless，直接跳过）
                if (actualFallbackLevel === actualLevel) continue;
                
                // 2. 无损底线守卫：如果刚才请求的是无损，绝不允许降级到有损（320k/128k）
                if (actualLevel === "lossless" && actualFallbackLevel !== "lossless") {
                    break; // 直接跳出降级循环，报错给用户
                }
                
                if (PLATFORM_QUALITIES[platform].includes(fallbackQ)) {
                    try {
                        console.log(`[兜底] ${selectedQuality}失败，尝试降级 ${fallbackQ}`);
                        return await executeChain(platform, songInfo, fallbackQ);
                    } catch (fallbackErr) {
                        continue; 
                    }
                }
            }
        }
        throw primaryErr; 
    }
}

// ==================== 【注册与启动】====================
const sourceConfig = {};
const PLATFORM_NAMES = { wy: "网易云(聚合)", tx: "QQ(聚合)", kw: "酷我(聚合)", kg: "酷狗(聚合)", mg: "咪咕(聚合)" };

Object.keys(PLATFORM_QUALITIES).forEach(p => {
    sourceConfig[p] = {
        name: PLATFORM_NAMES[p],
        type: "music",
        actions: ["musicUrl"],
        qualitys: PLATFORM_QUALITIES[p]
    };
});

on(EVENT_NAMES.request, ({ action, source, info }) => {
    if (action !== "musicUrl") return Promise.reject(new Error("不支持的操作"));
    if (!info?.musicInfo) return Promise.reject(new Error("参数不完整"));
    return getUrlWithFallback(source, info.musicInfo, info.type || "128k");
});

send(EVENT_NAMES.inited, { openDevTools: false, sources: sourceConfig });
console.log("%c[全豆要 v13.1 极智无损版] 已就绪：无损守护+健康调度+严格防错", "color:#4caf50;font-weight:bold;");
