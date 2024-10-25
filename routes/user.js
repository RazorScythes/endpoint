const express                   = require('express')
const router                    = express.Router()
const user                      = require('../controllers/user')

/*
    MIDDLEWARE
*/
const auth                      = require('../middleware/auth')

// GET REQUEST
router.get('/getUser', auth.authenticateToken, auth.userRequired, auth.allowCors(user.getUser));

// POST REQUEST
router.post('/login', auth.allowCors(user.login));

module.exports = router