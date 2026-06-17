'use strict';

var path = require('path');
var config = require('./config/environment');
var logger = require('./config/logger');
var packageJson = require('../package.json');

module.exports = function (app) {
	app.use('/api/images', require('./api/images'));
	app.use('/api/stops', require('./api/stops'));
	app.use('/api/routes', require('./api/routes'));
	app.use('/api/config', require('./api/config'));

	app.get('/health', function (req, res) {
		res.setHeader('Access-Control-Allow-Origin', '*');
		res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
		res.status(200).json({
			status: 'healthy',
			timestamp: new Date().toISOString(),
			version: packageJson.version,
			uptime: process.uptime(),
			environment: process.env.NODE_ENV || 'development'
		});
	});

	app.get('/api/*splat', function (req, res) {
		res.status(404).json({ error: 'Not found' });
	});

	var buildPath = path.join(config.root, 'svelte-app/build');
	var handlerPath = buildPath + '/handler.js';

	logger.info({ path: buildPath }, 'Loading SvelteKit handler');

	var handlerCache = null;
	var handlerLoadError = null;

	app.use(function (req, res, next) {
		if (handlerCache) return handlerCache(req, res, next);

		if (handlerLoadError) {
			logger.error({ err: handlerLoadError }, 'SvelteKit handler not available');
			return res.status(500).json({
				error: 'Application not available',
				message: 'SvelteKit build not found. Run: cd svelte-app && pnpm build'
			});
		}

		import(handlerPath)
			.then(function (module) {
				logger.info('SvelteKit handler loaded successfully');
				handlerCache = module.handler;
				handlerCache(req, res, next);
			})
			.catch(function (err) {
				logger.error({ err: err }, 'Failed to load SvelteKit handler');
				handlerLoadError = err;
				res.status(500).json({
					error: 'Application not available',
					message: 'SvelteKit build not found. Run: cd svelte-app && pnpm build'
				});
			});
	});
};
