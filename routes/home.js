const express = require('express')
const router = express.Router()
const home = require('../controllers/home')
const auth = require('../middleware/auth')

router.get('/getHomeData', auth.allowCors(home.getHomeData))

module.exports = router
