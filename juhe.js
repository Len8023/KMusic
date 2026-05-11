/*!

- @name 聚合音源 终极版
- @description 聚合 全豆要/星海/Huibq/聆川/溯音/念心/玉宁熙/独家音源，多链路自动回退
- @version v1.0
- @author 聚合自: 全豆要、玥然OvO、竹佀、念心小站、玉宁熙
  */

const { EVENT_NAMES, request, on, send, env, version } = globalThis.lx

// ===================== 全局配置 =====================

// 【玉宁熙音源】Key，可去 http://api-v2.yuafeng.cn 免费注册
const YuNingXi_KEY = ‘’

// 【独家音源】服务端地址和Key
const DUJIA_API_URL = ‘https://88.lxmusic.xn–fiqs8s’
const DUJIA_API_KEY = ‘lxmusic’
const DUJIA_SECRET_KEY = ‘JaJ?a7Nwk_Fgj?2o:znAkst’
const DUJIA_SCRIPT_MD5 = ‘1888f9865338afe6d5534b35171c61a4’

// 【溯音音源】QQ音乐 API Key（oiapi.net）
const SUYIN_QQ_API_KEY = ‘oiapi-ef6133b7-ac2f-dc7d-878c-d3e207a82575’

// ===================== 音质配置 =====================
const MUSIC_QUALITY = {
wy: [‘24bit’, ‘flac’, ‘320k’, ‘192k’, ‘128k’],
tx: [‘24bit’, ‘flac’, ‘320k’, ‘192k’, ‘128k’],
kw: [‘24bit’, ‘flac’, ‘320k’, ‘192k’, ‘128k’],
kg: [‘24bit’, ‘flac’, ‘320k’, ‘192k’, ‘128k’],
mg: [‘24bit’, ‘flac’, ‘320k’, ‘192k’, ‘128k’],
}

const MUSIC_SOURCE = Object.keys(MUSIC_QUALITY)

// ===================== 缓存 =====================
const cache = new Map()
const CACHE_TTL = 1000 * 60 * 20 // 20分钟

function getCache(key) {
const item = cache.get(key)
if (!item) return null
if (Date.now() > item.expire) { cache.delete(key); return null }
return item.data
}
function setCache(key, data) {
cache.set(key, { data, expire: Date.now() + CACHE_TTL })
}

// ===================== HTTP 工具 =====================
function httpFetch(url, options = {}) {
return new Promise((resolve, reject) => {
const timer = setTimeout(() => reject(new Error(‘请求超时’)), options.timeout || 8000)
request(url, { method: ‘GET’, …options }, (err, resp) => {
clearTimeout(timer)
if (err) return reject(err)
let body = resp?.body
if (typeof body === ‘string’) {
const t = body.trim()
if (t.startsWith(’{’) || t.startsWith(’[’) || t.startsWith(’”’)) {
try { body = JSON.parse(t) } catch (_) {}
}
}
resolve({ statusCode: resp?.statusCode ?? resp?.status ?? 200, body, headers: resp?.headers || {} })
})
})
}

async function sendRequest(baseUrl, params = {}) {
const qs = Object.keys(params)
.filter(k => params[k] !== undefined && params[k] !== null)
.map(k => `${encodeURIComponent(k)}=${encodeURIComponent(params[k])}`)
.join(’&’)
const sep = baseUrl.includes(’?’) ? ‘&’ : ‘?’
const url = baseUrl + (qs ? sep + qs : ‘’)
const { statusCode, body } = await httpFetch(url, { method: ‘GET’, timeout: 8000 })
if (statusCode >= 400) throw new Error(`HTTP ${statusCode}`)
return body
}

// ===================== 辅助工具 =====================
function cleanText(text) {
if (!text) return ‘’
return String(text)
.replace(/(\s*Live\s*)/gi, ‘’)
.replace(/([^)]*)/g, ‘’)
.replace(/\s+/g, ‘’)
.replace(/[^\w\u4e00-\u9fa5]/g, ‘’)
.trim()
.toLowerCase()
}

function textLike(a, b) {
const ca = cleanText(a), cb = cleanText(b)
if (!ca || !cb) return true
return ca.includes(cb) || cb.includes(ca)
}

function getSongId(info) {
return info?.hash ?? info?.songmid ?? info?.id ?? null
}

function getSearchPriority(info) {
const priority = []
const name = info?.name || ‘’
const singer = info?.singer || ‘’
const album = info?.albumName || info?.album || ‘’
if (name && album) { const kw = cleanText(name + album); if (kw) priority.push({ keyword: kw, strict: true }) }
if (name && singer) { const kw = cleanText(name + singer); if (kw) priority.push({ keyword: kw, strict: true }) }
if (name) { const kw = cleanText(name); if (kw) priority.push({ keyword: kw, strict: false }) }
return priority
}

function mapQuality(q, allowed) {
if (q === ‘24bit’) return ‘24bit’
const arr = Array.isArray(allowed) ? allowed : [‘128k’]
const qn = String(q || ‘’).toLowerCase()
if (arr.includes(qn)) return qn
const order = [‘24bit’, ‘flac’, ‘320k’, ‘192k’, ‘128k’]
let idx = order.indexOf(qn)
if (idx < 0) idx = order.length - 1
for (let i = idx; i < order.length; i++) { if (arr.includes(order[i])) return order[i] }
for (let i = idx - 1; i >= 0; i–) { if (arr.includes(order[i])) return order[i] }
return arr[0] || ‘128k’
}

function ensureSafeUrl(url, tag) {
if (!url || typeof url !== ‘string’) throw new Error(`${tag}: 无效URL`)
if (!/^https?:///i.test(url.trim())) throw new Error(`${tag}: 非法URL`)
return url
}

// ===================== 独家音源 SHA256 =====================
const sha256 = (function () {
const HEX = ‘0123456789abcdef’.split(’’)
function S256() {
this.blocks = new Array(17).fill(0)
this.h0=0x6a09e667;this.h1=0xbb67ae85;this.h2=0x3c6ef372;this.h3=0xa54ff53a
this.h4=0x510e527f;this.h5=0x9b05688c;this.h6=0x1f83d9ab;this.h7=0x5be0cd19
this.block=this.start=this.bytes=this.hBytes=0
this.finalized=this.hashed=false;this.first=true
}
S256.prototype.update=function(msg){
if(this.finalized)return
const ns=typeof msg!==‘string’,bl=this.blocks
for(let i=0;i<msg.length;i++){
if(this.hashed){this.hashed=false;bl[0]=this.block;for(let j=1;j<=16;j++)bl[j]=0}
const c=ns?msg[i]:msg.charCodeAt(i)
bl[this.start>>2]|=c<<(24-(this.start%4)*8)
this.start++
if(this.start===64){this.block=bl[16];this.start=0;this.hash();this.hashed=true}
}
this.bytes+=msg.length
if(this.bytes>4294967295){this.hBytes+=this.bytes/4294967296<<0;this.bytes=this.bytes%4294967296}
return this
}
S256.prototype.finalize=function(){
if(this.finalized)return;this.finalized=true
const bl=this.blocks,i=this.start
bl[16]=this.block;bl[i>>2]|=0x80<<(24-(i%4)*8);this.block=bl[16]
if(i>=56){if(!this.hashed)this.hash();bl[0]=this.block;for(let j=1;j<=16;j++)bl[j]=0}
bl[14]=this.hBytes<<3|this.bytes>>>29;bl[15]=this.bytes<<3;this.hash()
}
S256.prototype.hash=function(){
const K=[0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2]
let a=this.h0,b=this.h1,c=this.h2,d=this.h3,e=this.h4,f=this.h5,g=this.h6,h=this.h7,bl=this.blocks
for(let j=0;j<64;j++){
if(j>=16){const w0=bl[j-15],w1=bl[j-2];const s0=((w0>>>7)|(w0<<25))^((w0>>>18)|(w0<<14))^(w0>>>3);const s1=((w1>>>17)|(w1<<15))^((w1>>>19)|(w1<<13))^(w1>>>10);bl[j]=bl[j-16]+s0+bl[j-7]+s1}
const S1=((e>>>6)|(e<<26))^((e>>>11)|(e<<21))^((e>>>25)|(e<<7));const ch=(e&f)^((~e)&g);const t1=h+S1+ch+K[j]+(bl[j]>>>0);const S0=((a>>>2)|(a<<30))^((a>>>13)|(a<<19))^((a>>>22)|(a<<10));const maj=(a&b)^(a&c)^(b&c);const t2=S0+maj
h=g;g=f;f=e;e=(d+t1)>>>0;d=c;c=b;b=a;a=(t1+t2)>>>0
}
this.h0=(this.h0+a)>>>0;this.h1=(this.h1+b)>>>0;this.h2=(this.h2+c)>>>0;this.h3=(this.h3+d)>>>0
this.h4=(this.h4+e)>>>0;this.h5=(this.h5+f)>>>0;this.h6=(this.h6+g)>>>0;this.h7=(this.h7+h)>>>0
}
S256.prototype.hex=function(){
this.finalize()
const h=[this.h0,this.h1,this.h2,this.h3,this.h4,this.h5,this.h6,this.h7]
return h.map(v=>HEX[(v>>28)&0xF]+HEX[(v>>24)&0xF]+HEX[(v>>20)&0xF]+HEX[(v>>16)&0xF]+HEX[(v>>12)&0xF]+HEX[(v>>8)&0xF]+HEX[(v>>4)&0xF]+HEX[v&0xF]).join(’’)
}
return msg => new S256().update(msg).hex()
})()

// ===================== 独家音源链路 =====================
function dujiaSign(path) {
return sha256(path + DUJIA_SCRIPT_MD5 + DUJIA_SECRET_KEY)
}

async function resolveDujia(source, songId, quality) {
const path = `/lxmusicv4/url/${source}/${songId}/${quality}`
const sign = dujiaSign(path)
const url = `${DUJIA_API_URL}${path}?sign=${sign}`
const { statusCode, body } = await httpFetch(url, {
method: ‘GET’,
timeout: 8000,
headers: {
accept: ‘application/json’,
‘x-request-key’: DUJIA_API_KEY,
‘user-agent’: `lx-music-${env || 'desktop'}/${version || '2.0.0'}`,
}
})
if (statusCode === 404) throw new Error(‘独家: API端点不存在’)
if (statusCode >= 500) throw new Error(`独家: 服务器错误(${statusCode})`)
if (!body) throw new Error(‘独家: 空响应’)
const data = typeof body === ‘string’ ? JSON.parse(body) : body
if (!data || isNaN(Number(data.code))) throw new Error(‘独家: 无效数据’)
switch (data.code) {
case 0: case 200: {
const u = data.data || data.url
if (u) return u
throw new Error(‘独家: 无URL’)
}
case 1: throw new Error(‘独家: IP被封’)
case 2: throw new Error(data.msg || ‘独家: 获取失败’)
case 4: throw new Error(‘独家: 内部错误’)
case 5: throw new Error(‘独家: 频率限制’)
case 6: throw new Error(‘独家: 参数错误’)
default: throw new Error(data.msg ?? `独家: 未知错误(${data.code})`)
}
}

// ===================== 溯音音源链路 =====================
const OIAPI = ‘https://oiapi.net/api’

// 溯音 QQ
const SUYIN_QQ_BR_MAP = { ‘128k’: 7, ‘320k’: 5, flac: 4, hires: 3, atmos: 2, master: 1, ‘24bit’: 1 }

function getQqSongId(info) {
const mid = info?.meta?.qq?.mid || info?.meta?.mid || info?.songmid ||
(info?.id && typeof info.id === ‘string’ && !/^\d+$/.test(info.id) ? info.id : null)
if (mid) return { type: ‘mid’, value: mid }
const songid = info?.meta?.qq?.songid || info?.meta?.songid ||
(info?.id && /^\d+$/.test(String(info.id)) ? parseInt(info.id) : null)
if (songid) return { type: ‘songid’, value: songid }
return null
}

async function resolveSuyinQQ(info, quality) {
const sid = getQqSongId(info)
if (!sid) throw new Error(‘溯音QQ: 无ID’)
const brMap = { ‘128k’: 7, ‘320k’: 5, flac: 4, ‘24bit’: 1 }
const br = brMap[quality] || 7
const params = { key: SUYIN_QQ_API_KEY, type: ‘json’, br, n: 1 }
if (sid.type === ‘mid’) params.mid = sid.value
else params.songid = sid.value
const data = await sendRequest(`${OIAPI}/QQ_Music`, params)
if (data?.music) return data.music
if (data?.url) return data.url
if (data?.message) {
const m = data.message.match(/音频链接[：:](.+?)(?:\n|$)/)
if (m?.[1]) return m[1].trim()
}
throw new Error(‘溯音QQ: 未找到链接’)
}

// 溯音 网易
async function resolveSuyinWY(info) {
const id = info?.songmid || info?.id
if (!id) throw new Error(‘溯音WY: 无ID’)
const data = await sendRequest(`${OIAPI}/Music_163`, { id })
if (data?.code === 0 && data?.data) {
const song = Array.isArray(data.data) ? data.data[0] : data.data
if (song?.url) return song.url
}
throw new Error(‘溯音WY: 获取失败’)
}

// 溯音 酷我
const SUYIN_KW_BR_MAP = { flac: 1, ‘24bit’: 1, ‘320k’: 5, ‘128k’: 7 }

async function fetchKwAudio(keyword, br, checkInfo = null) {
const data = await sendRequest(`${OIAPI}/Kuwo`, { msg: keyword, n: 1, br })
if (data?.data?.url) {
if (checkInfo && !checkKwMatch(data, checkInfo)) throw new Error(‘酷我: 信息不匹配’)
return data.data.url
}
if (data?.message) {
const m = data.message.match(/音乐链接[：:](\S+)/)
if (m) return m[1]
}
throw new Error(‘溯音KW: 未找到链接’)
}

function checkKwMatch(apiData, info) {
const apiTitle = (apiData?.song || apiData?.data?.song || ‘’).toLowerCase()
const songName = (info?.name || ‘’).toLowerCase()
return apiTitle.includes(songName) || songName.includes(apiTitle)
}

async function resolveSuyinKW(info, quality) {
if (!info?.name) throw new Error(‘溯音KW: 需要歌名’)
const br = SUYIN_KW_BR_MAP[quality] || 7
const priority = getSearchPriority(info)
for (const term of priority) {
try { return await fetchKwAudio(term.keyword, br, term.strict ? info : null) } catch (_) {}
}
throw new Error(‘溯音KW: 所有搜索均失败’)
}

// 溯音 咪咕
async function resolveSuyinMG(info) {
if (!info?.name) throw new Error(‘溯音MG: 需要歌名’)
const priority = getSearchPriority(info)
for (const term of priority) {
try {
const data = await sendRequest(‘https://api.xcvts.cn/api/music/migu’, {
gm: term.keyword, n: 1, num: 1, type: ‘json’
})
if (data?.code === 200 && data?.music_url) return data.music_url
} catch (_) {}
}
throw new Error(‘溯音MG: 获取失败’)
}

// ===================== 玉宁熙音源链路 =====================
const YNX_BASE = ‘https://api-v2.yuafeng.cn’

async function resolveYNX_TX(info, quality) {
const mid = info?.songmid
if (!mid) throw new Error(‘玉宁熙TX: 无songmid’)
const qualityMap = { ‘128k’: ‘1d’, ‘320k’: ‘2’, flac: ‘4’, ‘24bit’: ‘11’, ‘192k’: ‘1d’ }
const q = qualityMap[quality] || ‘1d’
const url = `${YNX_BASE}/lx/tx?songmid=${mid}&quality=${q}${YuNingXi_KEY ? '&key=' + YuNingXi_KEY : ''}`
const { body } = await httpFetch(url, { timeout: 8000 })
const data = typeof body === ‘string’ ? JSON.parse(body) : body
if (data?.code === 200 && data?.data?.url) return data.data.url
throw new Error(’玉宁熙TX: ’ + (data?.msg || ‘获取失败’))
}

async function resolveYNX_WY(info, quality) {
const id = info?.id || info?.songmid
if (!id) throw new Error(‘玉宁熙WY: 无ID’)
const qualityMap = { ‘128k’: ‘1d’, ‘192k’: ‘2’, ‘320k’: ‘3’, flac: ‘4’, ‘24bit’: ‘7’ }
const q = qualityMap[quality] || ‘1d’
const url = `${YNX_BASE}/lx/wy?id=${id}&quality=${q}${YuNingXi_KEY ? '&key=' + YuNingXi_KEY : ''}`
const { body } = await httpFetch(url, { timeout: 8000 })
const data = typeof body === ‘string’ ? JSON.parse(body) : body
if (data?.code === 200 && data?.data?.url) return data.data.url
throw new Error(’玉宁熙WY: ’ + (data?.msg || ‘获取失败’))
}

async function resolveYNX_KW(info, quality) {
const id = info?.id || info?.songmid
if (!id) throw new Error(‘玉宁熙KW: 无ID’)
const qualityMap = { ‘128k’: ‘1d’, ‘320k’: ‘5’, flac: ‘1’, ‘24bit’: ‘1’ }
const q = qualityMap[quality] || ‘1d’
const url = `${YNX_BASE}/lx/kw?id=${id}&quality=${q}${YuNingXi_KEY ? '&key=' + YuNingXi_KEY : ''}`
const { body } = await httpFetch(url, { timeout: 8000 })
const data = typeof body === ‘string’ ? JSON.parse(body) : body
if (data?.code === 200 && data?.data?.url) return data.data.url
throw new Error(’玉宁熙KW: ’ + (data?.msg || ‘获取失败’))
}

async function resolveYNX_KG(info, quality) {
const hash = info?.hash || info?.id || info?.songmid
if (!hash) throw new Error(‘玉宁熙KG: 无hash’)
const qualityMap = { ‘128k’: ‘1d’, ‘320k’: ‘5’, flac: ‘4’, ‘24bit’: ‘11’ }
const q = qualityMap[quality] || ‘1d’
const url = `${YNX_BASE}/lx/kg?hash=${hash}&quality=${q}${YuNingXi_KEY ? '&key=' + YuNingXi_KEY : ''}`
const { body } = await httpFetch(url, { timeout: 8000 })
const data = typeof body === ‘string’ ? JSON.parse(body) : body
if (data?.code === 200 && data?.data?.url) return data.data.url
throw new Error(’玉宁熙KG: ’ + (data?.msg || ‘获取失败’))
}

async function resolveYNX_MG(info, quality) {
const id = info?.id || info?.songmid
if (!id) throw new Error(‘玉宁熙MG: 无ID’)
const qualityMap = { ‘128k’: ‘PQ’, ‘320k’: ‘HQ’, flac: ‘SQ’, ‘24bit’: ‘ZQ’ }
const q = qualityMap[quality] || ‘PQ’
const url = `${YNX_BASE}/lx/mg?id=${id}&quality=${q}${YuNingXi_KEY ? '&key=' + YuNingXi_KEY : ''}`
const { body } = await httpFetch(url, { timeout: 8000 })
const data = typeof body === ‘string’ ? JSON.parse(body) : body
if (data?.code === 200 && data?.data?.url) return data.data.url
throw new Error(’玉宁熙MG: ’ + (data?.msg || ‘获取失败’))
}

// ===================== 链路编排 =====================
/**

- 根据平台返回有序的解析链
- 每个 provider: { name, fn: async (source, info, quality) => url }
  */
  function getChain(source) {
  const dujia = {
  name: ‘独家音源’,
  fn: async (src, info, q) => {
  const id = getSongId(info)
  if (!id) throw new Error(‘无ID’)
  return await resolveDujia(src, id, q)
  }
  }

const ynx = {
tx: { name: ‘玉宁熙TX’, fn: (*, info, q) => resolveYNX_TX(info, q) },
wy: { name: ‘玉宁熙WY’, fn: (*, info, q) => resolveYNX_WY(info, q) },
kw: { name: ‘玉宁熙KW’, fn: (*, info, q) => resolveYNX_KW(info, q) },
kg: { name: ‘玉宁熙KG’, fn: (*, info, q) => resolveYNX_KG(info, q) },
mg: { name: ‘玉宁熙MG’, fn: (_, info, q) => resolveYNX_MG(info, q) },
}

const suyin = {
tx: { name: ‘溯音QQ’, fn: (*, info, q) => resolveSuyinQQ(info, q) },
wy: { name: ‘溯音WY’, fn: (*, info) => resolveSuyinWY(info) },
kw: { name: ‘溯音KW’, fn: (*, info, q) => resolveSuyinKW(info, q) },
mg: { name: ‘溯音MG’, fn: (*, info) => resolveSuyinMG(info) },
}

// 链路顺序：独家音源 → 玉宁熙 → 溯音
const chain = [dujia]
if (ynx[source]) chain.push(ynx[source])
if (suyin[source]) chain.push(suyin[source])
return chain
}

// ===================== 主入口 =====================
async function getMusicUrl(source, musicInfo, quality) {
const q = mapQuality(quality, MUSIC_QUALITY[source])
const cacheKey = `${source}_${getSongId(musicInfo) || musicInfo?.name}_${q}`
const cached = getCache(cacheKey)
if (cached) return cached

const chain = getChain(source)
const errors = []

// 前2条链路并行竞速
try {
const fastChain = chain.slice(0, 2)
const url = await Promise.any(
fastChain.map(p => p.fn(source, musicInfo, q).then(u => ensureSafeUrl(u, p.name)))
)
if (url) { setCache(cacheKey, url); return url }
} catch (e) {
if (e?.errors) e.errors.forEach(err => errors.push(err.message))
else errors.push(e.message)
}

// 后续链路逐一尝试
for (const p of chain.slice(2)) {
try {
const url = ensureSafeUrl(await p.fn(source, musicInfo, q), p.name)
setCache(cacheKey, url)
return url
} catch (e) {
errors.push(`${p.name}: ${e.message}`)
}
}

throw new Error(‘所有链路均失败: ’ + errors.join(’ | ’))
}

// ===================== 注册 & 初始化 =====================
const musicSources = {}
MUSIC_SOURCE.forEach(src => {
musicSources[src] = {
name: src,
type: ‘music’,
actions: [‘musicUrl’],
qualitys: MUSIC_QUALITY[src],
}
})

on(EVENT_NAMES.request, ({ action, source, info }) => {
if (action === ‘musicUrl’) {
return getMusicUrl(source, info.musicInfo, info.type)
.then(url => Promise.resolve(url))
.catch(err => Promise.reject(err))
}
return Promise.reject(`action(${action}) not support`)
})

send(EVENT_NAMES.inited, {
status: true,
openDevTools: false,
sources: musicSources,
})