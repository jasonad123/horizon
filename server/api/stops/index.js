'use strict';

var express = require('express');
var controller = require('./stops.controller');

var router = express.Router();

router.get('/nearby', controller.nearby);
router.get('/departures', controller.departures);

module.exports = router;
