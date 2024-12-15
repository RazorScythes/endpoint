const express                   = require('express')
const router                    = express.Router()
const category                  = require('../controllers/category')

/*
    MIDDLEWARE
*/
const auth                      = require('../middleware/auth')

// GET REQUEST
router.get('/getCategory/:type/:options?', auth.authenticateToken, auth.userRequired, auth.allowCors(category.getCategory));

// POST REQUEST
router.post('/newCategory', auth.authenticateToken, auth.userRequired, auth.allowCors(category.newCategory));

// PATCH REQUEST
router.patch('/updateCategory', auth.authenticateToken, auth.userRequired, auth.adminAccess, auth.allowCors(category.updateCategory));
router.patch('/deleteMultipleCategory', auth.authenticateToken, auth.userRequired, auth.adminAccess, auth.allowCors(category.deleteMultipleCategory));
router.patch('/updateCategorySettings', auth.authenticateToken, auth.userRequired, auth.allowCors(category.updateCategorySettings));

// DELETE REQUEST
router.delete('/deleteCategory/:id/:type', auth.authenticateToken, auth.userRequired, auth.adminAccess, auth.allowCors(category.deleteCategory));

module.exports = router