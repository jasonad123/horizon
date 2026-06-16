'use strict';

var config = require('../../config/environment');
var logger = require('../../config/logger');

var DEFAULT_COORDINATES = { latitude: 40.75426683398718, longitude: -73.98672703719805 };

function validateCoordinates(locationStr) {
	if (!locationStr || typeof locationStr !== 'string') return false;
	var coords = locationStr.split(',');
	if (coords.length !== 2) return false;
	var lat = parseFloat(coords[0].trim());
	var lng = parseFloat(coords[1].trim());
	if (isNaN(lat) || isNaN(lng)) return false;
	if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return false;
	return { latitude: lat, longitude: lng };
}

exports.getUnattendedConfig = function (req, res) {
	if (!config.unattendedSetup.enabled) {
		return res.status(404).json({ error: 'Unattended setup is not enabled' });
	}

	var coordinates = validateCoordinates(config.unattendedSetup.location);
	if (!coordinates) {
		logger.warn(
			{ defaultLatitude: DEFAULT_COORDINATES.latitude, defaultLongitude: DEFAULT_COORDINATES.longitude },
			'UNATTENDED_LOCATION not set or invalid. Using default (New York City).'
		);
		coordinates = DEFAULT_COORDINATES;
	}

	res.json({
		enabled: true,
		latLng: coordinates,
		title: config.unattendedSetup.title,
		timeFormat: config.unattendedSetup.timeFormat,
		maxDistance: config.unattendedSetup.maxDistance,
		selectedStops: config.unattendedSetup.selectedStops,
		maxDepartures: config.unattendedSetup.maxDepartures
	});
};
