'use strict';

var config = {
    id: 'filmizlech',
    name: '!FilmizleCH',
    enabled: true,
    fallback: 'https://filmizlech.org',
    supportedTypes: ['movie', 'tv'],
    searchOrder: ['imdb', 'title']
};

var catalogs = [
    { id: 'movies', name: 'Son Filmler', type: 'movie', path: '/filmler', query: '' },
    { id: 'popular', name: 'En Çok İzlenen Filmler', type: 'movie', path: '/filmler', query: 'sort=popular' },
    { id: 'top-rated', name: 'En Yüksek Puanlı Filmler', type: 'movie', path: '/filmler', query: 'sort=top_rated' },
    { id: 'yerli', name: 'Yerli Filmler', type: 'movie', path: '/filmler', query: 'cats=yerli-film' },
    { id: 'aksiyon', name: 'Aksiyon', type: 'movie', path: '/filmler', query: 'cats=aksiyon' },
    { id: 'korku', name: 'Korku', type: 'movie', path: '/filmler', query: 'cats=korku' },
    { id: 'komedi', name: 'Komedi', type: 'movie', path: '/filmler', query: 'cats=komedi' },
    { id: 'dram', name: 'Dram', type: 'movie', path: '/filmler', query: 'cats=drama' },
    { id: 'bilim-kurgu', name: 'Bilim Kurgu', type: 'movie', path: '/filmler', query: 'cats=bilim-kurgu' },
    { id: 'gerilim', name: 'Gerilim', type: 'movie', path: '/filmler', query: 'cats=gerilim' },
    { id: 'macera', name: 'Macera', type: 'movie', path: '/filmler', query: 'cats=macera' },
    { id: 'romantik', name: 'Romantik', type: 'movie', path: '/filmler', query: 'cats=romantik' },
    { id: 'animasyon', name: 'Animasyon', type: 'movie', path: '/filmler', query: 'cats=animasyon' },
    { id: 'fantastik', name: 'Fantastik', type: 'movie', path: '/filmler', query: 'cats=fantastik' },
    { id: 'gizem', name: 'Gizem', type: 'movie', path: '/filmler', query: 'cats=gizem' },
    { id: 'suc', name: 'Suç', type: 'movie', path: '/filmler', query: 'cats=suc' },
    { id: 'belgesel', name: 'Belgesel', type: 'movie', path: '/filmler', query: 'cats=belgesel' },
    { id: 'aile', name: 'Aile', type: 'movie', path: '/filmler', query: 'cats=aile' },
    { id: 'series', name: 'Son Diziler', type: 'series', path: '/diziler', query: '' },
    { id: 'anime', name: 'Son Animeler', type: 'series', path: '/animeler', query: '' }
];

var UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

function logError(context, error) {
    console.warn('[' + config.id + '] ' + context + ':', String(error));
}

function headers(referer) {
    return {
        'User-Agent': UA,
        'Accept': '*/*',
        'Accept-Language': 'tr-TR,tr;q=0.9',
        'Referer': referer || config.fallback + '/'
    };
}

async function request(url, referer, extraHeaders) {
    var merged = headers(referer);
    if (extraHeaders) {
        for (var key in extraHeaders) merged[key] = extraHeaders[key];
    }
    var response = await fetch(url, { headers: merged });
    if (!response.ok) throw new Error('HTTP ' + response.status + ': ' + url);
    return { body: await response.text(), url: response.url || url };
}

function entities(value) {
    return String(value).replace(/&(#x[0-9a-f]+|#\d+|amp|quot|apos|lt|gt|nbsp);/gi, function (match, entity) {
        if (entity[0] === '#') {
            var code = entity[1].toLowerCase() === 'x' ? parseInt(entity.slice(2), 16) : Number(entity.slice(1));
            return code >= 0 && code <= 0x10ffff ? String.fromCodePoint(code) : match;
        }
        var map = { amp: '&', quot: '"', apos: "'", lt: '<', gt: '>', nbsp: ' ' };
        return map[entity.toLowerCase()] || match;
    });
}

function text(html) {
    return entities(String(html).replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();
}

function attrs(tag) {
    var result = {};
    var re = /([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g;
    var match;
    while ((match = re.exec(tag))) {
        result[match[1].toLowerCase()] = entities(match[2] ?? match[3] ?? match[4] ?? '');
    }
    return result;
}

function absolute(href, baseUrl) {
    try {
        var value = entities(String(href || '').trim());
        if (!value || /^(?:javascript|data|about):/i.test(value)) return undefined;
        if (value.startsWith('//')) value = new URL(baseUrl).protocol + value;
        var resolved = new URL(value, baseUrl);
        if (!/^https?:$/.test(resolved.protocol)) return undefined;
        return resolved.href;
    } catch {
        return undefined;
    }
}

function listingUrl(catalog, page) {
    var url = config.fallback + catalog.path;
    if (page > 1) url += '/sayfa/' + page;
    if (catalog.query) url += '?' + catalog.query;
    return url;
}

function catalogPage(pageToken) {
    if (pageToken == null || pageToken === '') return 1;
    if (!/^\d+$/.test(String(pageToken))) return undefined;
    var page = Number(pageToken);
    return page >= 1 && page <= 250 ? page : undefined;
}

function cardItems(html, baseUrl) {
    var items = [];
    var seen = {};
    var cardRe = /<a\b([^>]*class="[^"]*content-card[^"]*"[^>]*)>([\s\S]*?)<\/a>/gi;
    var cardMatch;
    while ((cardMatch = cardRe.exec(html))) {
        var cardAttrs = attrs(cardMatch[1]);
        var body = cardMatch[2];
        var url = absolute(cardAttrs.href || '', baseUrl);
        if (!url || seen[url]) continue;
        var host = new URL(url).host;
        if (host !== new URL(baseUrl).host) continue;
        var type = /\/dizi\//i.test(url) ? 'series' : /\/anime\//i.test(url) ? 'series' : /\/film\//i.test(url) ? 'movie' : undefined;
        if (!type) continue;
        var strong = /<strong\b[^>]*>([\s\S]*?)<\/strong>/i.exec(body);
        var title = strong ? text(strong[1]) : '';
        if (!title) continue;
        seen[url] = true;
        var img = /<img\b[^>]*class="[^"]*cc-bg[^"]*"[^>]*>/i.exec(body) || /<img\b[^>]*>/i.exec(body);
        var imgAttrs = img ? attrs(img[0]) : {};
        var poster = absolute(imgAttrs.src || imgAttrs['data-src'] || '', baseUrl);
        var rating = /cc-rating-inline[^>]*>\s*[★☆]\s*([\d.,]+)/i.exec(body);
        var yearMatch = /<div class="cc-meta">[\s\S]*?<span>\s*((?:19|20)\d{2})\s*<\/span>/i.exec(body) ||
            /<span>\s*((?:19|20)\d{2})\s*<\/span>/i.exec(body);
        var item = {
            id: 'fch:' + encodeURIComponent(url),
            name: title,
            type: type,
            url: url
        };
        if (poster) item.poster = poster;
        if (rating) {
            var score = parseFloat(rating[1].replace(',', '.'));
            if (score > 0) item.score = score;
        }
        if (yearMatch) item.releaseInfo = yearMatch[1];
        items.push(item);
    }
    return items;
}

function searchItems(html, baseUrl) {
    return cardItems(html, baseUrl);
}

function catalogUrl(id) {
    id = String(id || '');
    if (!id.startsWith('fch:')) return undefined;
    try {
        var url = decodeURIComponent(id.slice(4));
        if (!/^https:\/\/filmizlech\.org\/(?:film|dizi|anime)\/[^/]+\/?$/i.test(url)) return undefined;
        return url.replace(/\/$/, '');
    } catch {
        return undefined;
    }
}

async function metadata(id, type) {
    if (/^tt\d+$/.test(id)) {
        try {
            var data = JSON.parse((await request('https://v3-cinemeta.strem.io/meta/' + (type === 'tv' ? 'series' : 'movie') + '/' + id + '.json')).body);
            var meta = data.meta;
            return {
                imdbId: id,
                titles: [meta.name].filter(function (value) { return typeof value === 'string'; }),
                year: parseInt(meta.releaseInfo)
            };
        } catch {
            return { imdbId: id, titles: [] };
        }
    }
    if (!/^\d+$/.test(id)) throw new Error('Gecersiz IMDb/TMDB kimligi');
    if (typeof TMDB_API_KEY !== 'string' || !TMDB_API_KEY) throw new Error('Nuvio TMDB_API_KEY saglamadi');
    var tmdb = JSON.parse((await request('https://api.themoviedb.org/3/' + (type === 'tv' ? 'tv' : 'movie') + '/' + id + '?api_key=' + encodeURIComponent(TMDB_API_KEY) + '&language=tr-TR&append_to_response=external_ids')).body);
    return {
        imdbId: tmdb.imdb_id || (tmdb.external_ids && tmdb.external_ids.imdb_id) || '',
        titles: Array.from(new Set([tmdb.title, tmdb.name, tmdb.original_title, tmdb.original_name].filter(function (value) { return typeof value === 'string' && value; }))),
        year: parseInt(tmdb.release_date || tmdb.first_air_date)
    };
}

function searchQueries(meta) {
    var titles = meta.searchOrder.indexOf('imdb') >= 0 && meta.imdbId ? [meta.imdbId].concat(meta.titles) : meta.titles;
    return Array.from(new Set(titles.filter(Boolean))).slice(0, 4);
}

function requestType(type, season, episode) {
    var mapped = type === 'series' ? 'tv' : type;
    if (!config.enabled) return undefined;
    if (mapped !== 'movie' && mapped !== 'tv') return undefined;
    if (!config.supportedTypes.includes(mapped)) return undefined;
    if (mapped === 'tv') {
        if (!Number.isInteger(Number(season)) || Number(season) < 1) return undefined;
        if (!Number.isInteger(Number(episode)) || Number(episode) < 1) return undefined;
    }
    return mapped;
}

function playerButtons(html) {
    var results = [];
    var seen = {};
    var re = /data-pid="(\d+)"\s+data-ts="(\d+)"\s+data-sig="([a-f0-9]+)"/gi;
    var match;
    while ((match = re.exec(html))) {
        var key = match[1] + '|' + match[2] + '|' + match[3];
        if (seen[key]) continue;
        seen[key] = true;
        results.push({ pid: match[1], ts: match[2], sig: match[3] });
    }
    return results;
}

function parseSubtitles(source, pageUrl) {
    var found = {};
    var list = [];
    var block = /["']subtitle["']\s*:\s*"([^"]*)"/i.exec(source);
    if (!block) return list;
    var pairs = block[1].split(',');
    for (var i = 0; i < pairs.length; i++) {
        var langMatch = /^\[([^\]]+)\]/.exec(pairs[i]);
        var urlMatch = /(https?:\/\/[^\s,\]]+\.vtt[^\s,\]]*)/i.exec(pairs[i]);
        if (!urlMatch) continue;
        var url = urlMatch[1];
        if (found[url]) continue;
        found[url] = true;
        list.push({
            id: url,
            url: url,
            lang: langMatch ? langMatch[1].trim() : 'Unknown',
            headers: headers(pageUrl)
        });
    }
    return list;
}

function createStream(source) {
    var url = source.url;
    var pathname = url.split('?')[0];
    var format = /\.m3u8$/i.test(pathname) || /\/master\.m3u8$/i.test(url) ? 'hls' : /\.mp4$/i.test(pathname) ? 'mp4' : 'hls';
    var quality = source.quality || 'HD';
    return {
        name: config.name + ' - ' + (source.lang || 'TR'),
        title: source.title || 'Player',
        description: [quality, format === 'hls' ? 'HLS' : format.toUpperCase()].join(' • '),
        quality: quality,
        format: format,
        type: format,
        url: url,
        headers: source.headers,
        subtitles: source.subtitles || []
    };
}

async function resolveEmbed(embedUrl) {
    var outer = await request(embedUrl, config.fallback + '/');
    var iframeMatch = /<iframe\b[^>]*\bsrc="([^"]+)"/i.exec(outer.body);
    var innerUrl = iframeMatch ? absolute(iframeMatch[1], outer.url) : undefined;
    if (!innerUrl) throw new Error('Icerik iframe bulunamadi');

    var inner = await request(innerUrl, outer.url);
    var fetchMatch = /fetch\('([^']*op=get_stream[^']*)'\)/i.exec(inner.body);
    if (!fetchMatch) throw new Error('get_stream yolu bulunamadi');
    var apiUrl = absolute(fetchMatch[1], inner.url);
    if (!apiUrl) throw new Error('get_stream url gecersiz');

    var fileMatch = /cookie\('file_id',\s*'(\d+)'/i.exec(inner.body);
    var innerOrigin = new URL(inner.url).origin;
    var apiHeaders = {
        'Referer': innerOrigin + '/',
        'Origin': innerOrigin
    };
    var cookies = 'file_id=' + (fileMatch ? fileMatch[1] : '') + '; aff=1; ref_url=' + new URL(embedUrl).host;
    apiHeaders.Cookie = cookies;

    var result = JSON.parse((await request(apiUrl, innerOrigin + '/', apiHeaders)).body);
    if (!result.url) throw new Error('get_stream yanitinda url yok');

    var playerTitle = /title\s*:\s*"([^"]+)"/i.exec(inner.body);
    var numericQuality = playerTitle ? /(\d{3,4})p/i.exec(playerTitle[1]) : null;

    return {
        url: result.url,
        quality: numericQuality ? numericQuality[1] + 'p' : 'HD',
        title: playerTitle ? playerTitle[1] : 'Player',
        lang: 'TR',
        headers: { 'Referer': innerOrigin + '/' },
        subtitles: parseSubtitles(inner.body, inner.url)
    };
}

async function resolvePage(pageUrl) {
    var streams = [];
    var seen = {};
    var bustUrl = pageUrl + (pageUrl.indexOf('?') >= 0 ? '&' : '?') + '_cb=' + Date.now();
    var page = await request(bustUrl, config.fallback + '/');
    var buttons = playerButtons(page.body);
    if (!buttons.length) return streams;

    for (var i = 0; i < buttons.length && streams.length < 6; i++) {
        var button = buttons[i];
        try {
            var tokenUrl = config.fallback + '/api/player-token.php?pid=' + button.pid + '&_t=' + button.ts + '&_s=' + encodeURIComponent(button.sig);
            var token = JSON.parse((await request(tokenUrl, pageUrl)).body);
            if (!token.url) continue;
            var resolved = await resolveEmbed(token.url);
            if (seen[resolved.url]) continue;
            seen[resolved.url] = true;
            var stream = createStream({
                url: resolved.url,
                quality: resolved.quality,
                title: (token.name || 'Player') + ' • ' + resolved.title.slice(0, 60),
                lang: token.lang || resolved.lang,
                headers: resolved.headers,
                subtitles: resolved.subtitles
            });
            streams.push(stream);
        } catch (error) {
            logError('Player ' + button.pid, error);
        }
    }
    return streams;
}

function siteSearchUrl(base, query) {
    return base + '/pages/arama.php?q=' + encodeURIComponent(query);
}

function candidatesFromSearch(html, pageUrl, meta) {
    var items = searchItems(html, pageUrl);
    var matched = [];
    for (var i = 0; i < items.length; i++) {
        if (meta.imdbId && items[i].imdbId === meta.imdbId) matched.push(items[i].url);
    }
    if (!matched.length && meta.titles.length && meta.year) {
        for (var j = 0; j < items.length; j++) {
            if (items[j].releaseInfo && Number(items[j].releaseInfo) === meta.year) matched.push(items[j].url);
        }
    }
    if (!matched.length) {
        for (var k = 0; k < items.length; k++) matched.push(items[k].url);
    }
    return matched.slice(0, 8);
}

async function getCatalog(req) {
    var catalogId = req.catalogId;
    var type = req.type;
    var page = catalogPage(req.pageToken);
    var catalog = catalogs.find(function (entry) { return entry.id === catalogId && entry.type === type; });
    if (!catalog || !page) return { items: [] };
    try {
        var response = await request(listingUrl(catalog, page), config.fallback + '/');
        var items = cardItems(response.body, response.url);
        var result = { items: items };
        if (items.length) result.nextPageToken = String(page + 1);
        return result;
    } catch (error) {
        logError('Katalog ' + catalogId, error);
        return { items: [] };
    }
}

async function search(req) {
    var query = String(req.query || '').trim();
    if (!query) return { items: [] };
    try {
        var response = await request(siteSearchUrl(config.fallback, query), config.fallback + '/');
        return { items: searchItems(response.body, response.url) };
    } catch (error) {
        logError('Arama', error);
        return { items: [] };
    }
}

async function getStreams(id, type, season, episode) {
    var mapped = requestType(type, season, episode);
    if (!mapped) return [];
    var streams = [];
    var seen = {};
    try {
        var directUrl = catalogUrl(id);
        var meta = directUrl ? undefined : await metadata(String(id), mapped);
        var queries = meta ? searchQueries({ searchOrder: config.searchOrder, imdbId: meta.imdbId, titles: meta.titles }) : [];
        var directPages = [];
        if (directUrl) {
            directPages.push(mapped === 'tv' ? directUrl + '/sezon-' + Number(season) + '/bolum-' + Number(episode) : directUrl);
        }
        for (var q = 0; q < (directPages.length ? 1 : queries.length); q++) {
            var candidates = [];
            if (directPages.length) {
                candidates = directPages;
            } else {
                var searchResponse = await request(siteSearchUrl(config.fallback, queries[q]), config.fallback + '/');
                candidates = candidatesFromSearch(searchResponse.body, searchResponse.url, meta).map(function (url) {
                    return mapped === 'tv' ? url + '/sezon-' + Number(season) + '/bolum-' + Number(episode) : url;
                });
            }
            for (var c = 0; c < candidates.length && streams.length < 8; c++) {
                if (seen[candidates[c]]) continue;
                seen[candidates[c]] = true;
                try {
                    var found = await resolvePage(candidates[c]);
                    for (var s = 0; s < found.length; s++) {
                        if (seen[found[s].url]) continue;
                        seen[found[s].url] = true;
                        streams.push(found[s]);
                    }
                } catch (error) {
                    logError('Sayfa', error);
                }
            }
            if (streams.length) break;
        }
    } catch (error) {
        logError('Akis', error);
    }
    return streams;
}

module.exports = { getCatalog: getCatalog, search: search, getStreams: getStreams };
