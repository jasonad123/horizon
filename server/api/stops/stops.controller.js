'use strict';

const config = require('../../config/environment');

// Transform stop_departures v4 response to the same { routes } shape as nearby_routes.
// Both endpoints use merged_itineraries; this normalizes them so the frontend
// can use identical types and flattening logic regardless of which API was called.
function transformStopDeparturesFormat(sdResponse) {
	if (!sdResponse || !sdResponse.route_departures) return { routes: [] };

	const routes = sdResponse.route_departures.map((routeDep) => {
		const { merged_itineraries, global_stop_id, ...routeFields } = routeDep;
		const allItineraries = [];
		const scheduleItemsByItineraryId = {};

		if (Array.isArray(merged_itineraries)) {
			for (const merged of merged_itineraries) {
				if (Array.isArray(merged.schedule_items)) {
					for (const item of merged.schedule_items) {
						const id = item.internal_itinerary_id;
						if (!scheduleItemsByItineraryId[id]) scheduleItemsByItineraryId[id] = [];
						const { internal_itinerary_id, ...itemWithoutId } = item;
						scheduleItemsByItineraryId[id].push(itemWithoutId);
					}
				}
			}

			for (const merged of merged_itineraries) {
				if (Array.isArray(merged.itineraries)) {
					const flat = merged.itineraries.map((itin) => ({
						...itin,
						closest_stop: merged.closest_stop,
						schedule_items: scheduleItemsByItineraryId[itin.internal_itinerary_id] || []
					}));
					allItineraries.push(...flat);
				}
			}
		}

		return { ...routeFields, itineraries: allItineraries };
	});

	return { routes };
}

function hasRealTimeData(data) {
	const routes = data?.routes;
	if (!Array.isArray(routes)) return false;
	for (const route of routes) {
		for (const itin of route.itineraries || []) {
			if ((itin.schedule_items || []).some((item) => item.is_real_time === true)) return true;
		}
	}
	return false;
}

function hasActiveAlerts(data) {
	const routes = data?.routes;
	if (!Array.isArray(routes)) return false;
	return routes.some((r) => Array.isArray(r.alerts) && r.alerts.length > 0);
}

const CACHE_ENABLED = config.parseBoolean(process.env.ENABLE_SERVER_CACHE);
const REALTIME_CACHE_TTL = parseInt(process.env.REALTIME_CACHE_TTL) || 5000;
const STATIC_CACHE_TTL = parseInt(process.env.STATIC_CACHE_TTL) || 120000;

function getCacheMaxAge(freshness) {
	return freshness === 'fresh-realtime'
		? Math.floor(REALTIME_CACHE_TTL / 1000)
		: Math.floor(STATIC_CACHE_TTL / 1000);
}

const requestCache = new Map();

if (CACHE_ENABLED) {
	setInterval(() => {
		const now = Date.now();
		for (const [key, entry] of requestCache.entries()) {
			if (now > entry.expiresAt) requestCache.delete(key);
		}
	}, 60000);
}

// GET /api/stops/nearby
// Wraps /v4/public/nearby_stops — returns routable stops near a lat/lon.
// Used during setup to discover specific bays/platforms to configure.
exports.nearby = async function (req, res) {
	const { lat, lon, max_distance } = req.query;

	if (!lat || !lon) {
		return res.status(400).json({ error: 'Missing required parameters: lat and lon' });
	}

	if (isNaN(parseFloat(lat)) || isNaN(parseFloat(lon))) {
		return res.status(400).json({ error: 'lat and lon must be valid numbers' });
	}

	const distance = Math.min(parseInt(max_distance, 10) || 500, 1500);

	try {
		const response = await fetch(
			`https://external.transitapp.com/v4/public/nearby_stops?lat=${lat}&lon=${lon}&max_distance=${distance}&stop_filter=Routable&stop_detailed=true`,
			{
				headers: { Accept: 'application/json', apiKey: process.env.TRANSIT_API_KEY },
				signal: AbortSignal.timeout(10000)
			}
		);

		if (!response.ok) {
			if (response.status === 429) {
				const retryAfter = response.headers.get('Retry-After');
				return res.status(429).json({ error: 'Rate limit exceeded', retryAfter: parseInt(retryAfter) || 60 });
			}
			if (response.status === 401 || response.status === 403) {
				return res.status(response.status).json({ error: 'Authentication error' });
			}
			return res.status(response.status).json({ error: 'Transit API error' });
		}

		const data = await response.json();
		res.status(200).json(data);
	} catch (error) {
		req.log.error({ api: 'transit', endpoint: 'nearby_stops', err: error }, 'Error fetching nearby stops');
		if (error.name === 'TimeoutError' || error.name === 'AbortError') {
			return res.status(504).json({ error: 'Request timeout' });
		}
		return res.status(500).json({ error: 'Failed to fetch nearby stops' });
	}
};

// GET /api/stops/departures?global_stop_ids=...&max_num_departures=...
// Wraps /v4/public/stop_departures — returns upcoming departures for specific stops.
// Response is transformed to match the { routes } shape of /api/routes/nearby.
exports.departures = async function (req, res) {
	const { global_stop_ids, max_num_departures } = req.query;

	if (!global_stop_ids) {
		return res.status(400).json({ error: 'Missing required parameter: global_stop_ids' });
	}

	const stopIds = global_stop_ids
		.split(',')
		.map((s) => s.trim())
		.filter((s) => s.length > 0);

	if (stopIds.length === 0) {
		return res.status(400).json({ error: 'global_stop_ids must contain at least one stop ID' });
	}

	if (stopIds.length > 1000) {
		return res.status(400).json({ error: 'global_stop_ids must contain at most 1000 stop IDs' });
	}

	const maxDepartures = Math.min(Math.max(parseInt(max_num_departures, 10) || 6, 1), 10);

	const cacheKey = `departures:${stopIds.sort().join(',')}:${maxDepartures}`;

	if (CACHE_ENABLED) {
		const cached = requestCache.get(cacheKey);
		if (cached && Date.now() < cached.expiresAt) {
			res.set({ 'Cache-Control': `public, max-age=${getCacheMaxAge(cached.freshness)}`, 'X-Cache': 'HIT' });
			return res.status(200).json(cached.data);
		}
	}

	try {
		const response = await fetch(
			`https://external.transitapp.com/v4/public/stop_departures?global_stop_ids=${stopIds.join(',')}&max_num_departures=${maxDepartures}`,
			{
				headers: { Accept: 'application/json', apiKey: process.env.TRANSIT_API_KEY },
				signal: AbortSignal.timeout(10000)
			}
		);

		if (!response.ok) {
			if (response.status === 429) {
				const retryAfter = response.headers.get('Retry-After');
				return res.status(429).json({ error: 'Rate limit exceeded', retryAfter: parseInt(retryAfter) || 60 });
			}
			if (response.status === 401 || response.status === 403) {
				return res.status(response.status).json({ error: 'Authentication error' });
			}
			return res.status(response.status).json({ error: 'Transit API error' });
		}

		const v4Data = await response.json();
		const data = transformStopDeparturesFormat(v4Data);

		if (CACHE_ENABLED) {
			const isRealTime = hasRealTimeData(data);
			const cacheTTL = isRealTime || hasActiveAlerts(data) ? REALTIME_CACHE_TTL : STATIC_CACHE_TTL;
			requestCache.set(cacheKey, { data, expiresAt: Date.now() + cacheTTL, freshness: isRealTime ? 'fresh-realtime' : 'fresh-schedule' });
		}

		const isRealTime = hasRealTimeData(data);
		const freshness = isRealTime ? 'fresh-realtime' : 'fresh-schedule';
		res.set({
			'Cache-Control': `public, max-age=${getCacheMaxAge(freshness)}`,
			'Vary': 'Accept-Encoding',
			'X-Cache': CACHE_ENABLED ? 'MISS' : 'DISABLED',
			'X-Cache-Freshness': freshness
		});
		res.status(200).json(data);
	} catch (error) {
		req.log.error({ api: 'transit', endpoint: 'stop_departures', err: error }, 'Error fetching stop departures');
		if (error.name === 'TimeoutError' || error.name === 'AbortError') {
			return res.status(504).json({ error: 'Request timeout' });
		}
		return res.status(500).json({ error: 'Failed to fetch stop departures' });
	}
};
