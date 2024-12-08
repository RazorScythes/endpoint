const express                   = require('express')
const router                    = express.Router()
const user                      = require('../controllers/user')

/*
    MIDDLEWARE
*/
const auth                      = require('../middleware/auth')

// GET REQUEST
router.get('/getProfile', auth.authenticateToken, auth.userRequired, auth.allowCors(user.getProfile));

// POST REQUEST
router.post('/login', auth.allowCors(user.login));
router.post('/updateProfile', auth.authenticateToken, auth.userRequired, auth.allowCors(user.updateProfile));

module.exports = router