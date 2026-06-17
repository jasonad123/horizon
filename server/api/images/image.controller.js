'use strict';

// Proxies icon SVGs from transitapp-data.com and performs color substitution.
// SVGs use #010101 as primary placeholder and #FEFEFE as secondary.
// Ported from Headsign with minor adjustments for Horizon's server structure.

const IMAGE_BASE_URL = 'https://transitapp-data.com/images/svgx/';
const IMAGE_NAME_REGEX = /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,63}(\.svg)?$/;
const HEX_COLOR_REGEX = /^[0-9A-Fa-f]{6}$/;

exports.show = async function (req, res) {
	if (!req.params.id) {
		return res.status(400).json({ error: 'Image ID is required' });
	}

	const imageName = req.params.id;
	const primaryColor = req.query.primaryColor || '010101';
	const secondaryColor = req.query.secondaryColor || 'FEFEFE';

	if (!IMAGE_NAME_REGEX.test(imageName)) {
		return res.status(400).json({ error: 'Invalid image name' });
	}

	if (!HEX_COLOR_REGEX.test(primaryColor) || !HEX_COLOR_REGEX.test(secondaryColor)) {
		return res.status(400).json({ error: 'Colors must be 6-character hex values without #' });
	}

	const suffix = primaryColor === '000000' ? '-mono' : '-color-light';
	const filename = imageName.replace('.svg', '') + suffix + '.svg';
	const url = IMAGE_BASE_URL + filename;

	try {
		const response = await fetch(url, { signal: AbortSignal.timeout(10000) });

		if (!response.ok) {
			return res.status(response.status === 404 ? 404 : 502).json({ error: 'Icon not found' });
		}

		let svg = await response.text();
		if (!svg) return res.status(502).json({ error: 'Empty response from icon server' });

		svg = svg
			.replace(/#010101/gi, `#${primaryColor}`)
			.replace(/#FEFEFE/gi, `#${secondaryColor}`);

		res
			.status(200)
			.set('Content-Type', 'image/svg+xml')
			.set('Cache-Control', 'public, max-age=86400')
			.send(svg);
	} catch (err) {
		req.log.error({ err, url }, 'Error fetching route icon');
		if (err.name === 'TimeoutError' || err.name === 'AbortError') {
			return res.status(504).json({ error: 'Icon request timed out' });
		}
		return res.status(500).json({ error: 'Failed to fetch icon' });
	}
};
