const express                   = require('express')
const router                    = express.Router()
const account                   = require('../controllers/account')

/*
    MIDDLEWARE
*/
const auth                      = require('../middleware/auth')

module.exports = router