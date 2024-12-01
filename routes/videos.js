const express                   = require('express')
const router                    = express.Router()
const videos                    = require('../controllers/videos')

/*
    MIDDLEWARE
*/
const auth                      = require('../middleware/auth')

// GET REQUEST
router.get('/getUserVideos', auth.authenticateToken, auth.userRequired, auth.allowCors(videos.getUserVideos));

// POST REQUEST
router.post('/newVideo', auth.authenticateToken, auth.userRequired, auth.allowCors(videos.newVideo));

// PATCH REQUEST
router.patch('/updateVideo', auth.authenticateToken, auth.userRequired, auth.allowCors(videos.updateVideo));
router.patch('/updateVideoSettings', auth.authenticateToken, auth.userRequired, auth.allowCors(videos.updateVideoSettings));
router.patch('/deleteMultipleVideos', auth.authenticateToken, auth.userRequired, auth.allowCors(videos.deleteMultipleVideos));

// DELETE REQUEST
router.delete('/deleteVideo/:id', auth.authenticateToken, auth.userRequired, auth.allowCors(videos.deleteVideo));

module.exports = router