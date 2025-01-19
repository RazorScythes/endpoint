const express                   = require('express')
const router                    = express.Router()
const documentation             = require('../controllers/documentation')

/*
    MIDDLEWARE
*/
const auth                      = require('../middleware/auth')

// GET REQUEST
router.get('/getDocs', auth.allowCors(documentation.getDocs));

// POST REQUEST
router.post('/newDocs', auth.allowCors(documentation.newDocs));

// PATCH REQUEST
router.patch('/updateDocs', auth.allowCors(documentation.updateDocs));
router.patch('/updateDocsSettings', auth.allowCors(documentation.updateDocsSettings));
router.patch('/deleteMultipleDocs', auth.allowCors(documentation.deleteMultipleDocs));

// DELETE REQUEST
router.delete('/deleteDocs/:id', auth.allowCors(documentation.deleteDocs));

module.exports = router
