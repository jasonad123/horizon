'use strict';

var path = require('path');

if (process.env.NODE_ENV === 'production' && !process.env.TRANSIT_API_KEY) {
	console.warn('WARNING: TRANSIT_API_KEY is not set. API requests will fail with authentication errors.');
}

function parseBoolean(value) {
	if (!value) return false;
	if (typeof value !== 'string') return false;
	if (value.length > 10) return false;
	var normalized = value.toLowerCase().trim();
	return normalized === 'true' || normalized === '1' || normalized === 'yes' || normalized === 'on';
}

function validateMaxDistance(distance) {
	var allowed = [250, 500, 750, 1000, 1250, 1500];
	if (allowed.includes(distance)) return distance;
	return 500;
}

function validateTimeFormat(format) {
	var allowed = ['HH:mm', 'hh:mm A', 'hh:mm'];
	if (allowed.includes(format)) return format;
	return 'HH:mm';
}

function validateLocation(location) {
	if (!location) return '';
	var parts = location.split(',');
	if (parts.length !== 2) return '';
	var lat = parseFloat(parts[0]);
	var lng = parseFloat(parts[1]);
	if (isNaN(lat) || isNaN(lng)) return '';
	if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return '';
	return location;
}

function validateSelectedStops(stops) {
	if (!stops) return [];
	return stops
		.split(',')
		.map((s) => s.trim())
		.filter((s) => s.length > 0);
}

var all = {
	root: path.normalize(__dirname + '/../../..'),
	port: process.env.PORT || 8080,
	ip: process.env.IP || '::',
	secrets: {
		session: process.env.SESSION_SECRET || 'horizon-secret'
	},
	transitApiKey: process.env.TRANSIT_API_KEY || '',
	requestTimeout: parseInt(process.env.REQUEST_TIMEOUT) || 10000,
	logLevel: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
	cache: {
		realtimeTTL: parseInt(process.env.REALTIME_CACHE_TTL) || 5000,
		staticTTL: parseInt(process.env.STATIC_CACHE_TTL) || 120000
	},
	unattendedSetup: {
		enabled: parseBoolean(process.env.UNATTENDED_SETUP),
		location: validateLocation(process.env.UNATTENDED_LOCATION || ''),
		title: process.env.UNATTENDED_TITLE || 'Horizon',
		timeFormat: validateTimeFormat(process.env.UNATTENDED_TIME_FORMAT || 'HH:mm'),
		maxDistance: validateMaxDistance(parseInt(process.env.UNATTENDED_MAX_DISTANCE) || 500),
		selectedStops: validateSelectedStops(process.env.UNATTENDED_SELECTED_STOPS || ''),
		maxDepartures: Math.min(Math.max(parseInt(process.env.UNATTENDED_MAX_DEPARTURES) || 12, 1), 30)
	},
	security: {
		cors: {
			allowedOrigins: process.env.ALLOWED_ORIGINS
				? process.env.ALLOWED_ORIGINS.split(',')
				: ['http://localhost:5173', 'http://localhost:8080']
		}
	}
};

if (!process.env.NODE_ENV) {
	process.env.NODE_ENV = 'development';
}

module.exports = all;
module.exports.parseBoolean = parseBoolean;
