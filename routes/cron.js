const express                   = require('express')
const router                    = express.Router()
const cron                      = require('../controllers/cron')

// CRON
router.get('/updateListCount', cron.updateListCount);
router.get('/updateVideoProperties', cron.updateVideoProperties);

module.exports = router