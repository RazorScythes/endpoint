const express                   = require('express')
const router                    = express.Router()
const groups                    = require('../controllers/groups')

/*
    MIDDLEWARE
*/
const auth                      = require('../middleware/auth')

// GET REQUEST
router.get('/getGroups/:id/:type', auth.allowCors(groups.getGroups));

// POST REQUEST
router.post('/newGroups', auth.allowCors(groups.newGroups));

// PATCH REQUEST
router.patch('/updateGroups', auth.allowCors(groups.updateGroups));
router.patch('/deleteMultipleGroups', auth.allowCors(groups.deleteMultipleGroups));

// DELETE REQUEST
router.delete('/deleteGroups/:id/:user/:type', auth.allowCors(groups.deleteGroups));

module.exports = router