const express                   = require('express')
const router                    = express.Router()
const tags                      = require('../controllers/tags')

/*
    MIDDLEWARE
*/
const auth                      = require('../middleware/auth')

// CRON
router.get('/updateTagsCount', tags.updateTagsCount);

// GET REQUEST
router.get('/getTags/:type/:options?', auth.authenticateToken, auth.userRequired, auth.allowCors(tags.getTags));

// POST REQUEST
router.post('/newTags', auth.authenticateToken, auth.userRequired, auth.allowCors(tags.newTags));

// PATCH REQUEST
router.patch('/updateTags', auth.authenticateToken, auth.userRequired, auth.adminAccess, auth.allowCors(tags.updateTags));
router.patch('/deleteMultipleTags', auth.authenticateToken, auth.userRequired, auth.adminAccess, auth.allowCors(tags.deleteMultipleTags));

// DELETE REQUEST
router.delete('/deleteTags/:id/:type', auth.authenticateToken, auth.userRequired, auth.adminAccess, auth.allowCors(tags.deleteTags));

module.exports = router