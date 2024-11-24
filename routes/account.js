const express                   = require('express')
const router                    = express.Router()
const account                   = require('../controllers/account')

/*
    MIDDLEWARE
*/
const auth                      = require('../middleware/auth')

// GET REQUEST
router.get('/getGroups/:id/:type', auth.allowCors(account.getGroups));

// POST REQUEST
router.post('/newGroups', auth.allowCors(account.newGroups));

// PATCH REQUEST
router.patch('/updateGroups', auth.allowCors(account.updateGroups));

module.exports = router