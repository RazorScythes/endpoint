const express                   = require('express')
const router                    = express.Router()
const groups                    = require('../controllers/groups')

/*
    MIDDLEWARE
*/
const auth                      = require('../middleware/auth')

// GET REQUEST
router.get('/getGroups/:type', auth.authenticateToken, auth.userRequired, auth.allowCors(groups.getGroups));

// POST REQUEST
router.post('/newGroups', auth.authenticateToken, auth.userRequired, auth.allowCors(groups.newGroups));

// PATCH REQUEST
router.patch('/updateGroups', auth.authenticateToken, auth.userRequired, auth.allowCors(groups.updateGroups));
router.patch('/deleteMultipleGroups', auth.authenticateToken, auth.userRequired, auth.allowCors(groups.deleteMultipleGroups));

// DELETE REQUEST
router.delete('/deleteGroups/:id/:type', auth.authenticateToken, auth.userRequired, auth.allowCors(groups.deleteGroups));

module.exports = router