const express                   = require('express')
const router                    = express.Router()
const user                      = require('../controllers/user')

/*
    MIDDLEWARE
*/
const { allowCors }             = require('../middleware/auth')

// POST REQUEST
router.post('/login', allowCors(user.login));

module.exports = router