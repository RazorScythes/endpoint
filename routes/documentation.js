const express                   = require('express')
const router                    = express.Router()
const documentation             = require('../controllers/documentation')

/*
    MIDDLEWARE
*/
const auth                      = require('../middleware/auth')

// GET REQUEST
router.get('/getDocsById/:category?', auth.allowCors(documentation.getDocsById));
router.get('/getDocs', auth.allowCors(documentation.getDocs));

// POST REQUEST
router.post('/newDocs', auth.allowCors(documentation.newDocs));
router.post('/newDocCategory', auth.allowCors(documentation.newDocCategory));
router.post('/addDocSubCategory', auth.allowCors(documentation.addDocSubCategory));

// PATCH REQUEST
router.patch('/updateDocs', auth.allowCors(documentation.updateDocs));
router.patch('/updateDocsSettings', auth.allowCors(documentation.updateDocsSettings));
router.patch('/deleteMultipleDocs', auth.allowCors(documentation.deleteMultipleDocs));
router.patch('/updateDocCategory', auth.allowCors(documentation.updateDocCategory));
router.patch('/renameDocCategory', auth.allowCors(documentation.renameDocCategory));
router.patch('/renameDocSubCategory', auth.allowCors(documentation.renameDocSubCategory));

// DELETE REQUEST
router.delete('/deleteDocs/:id', auth.allowCors(documentation.deleteDocs));
router.delete('/deleteDocCategory/:id/:category', auth.allowCors(documentation.deleteDocCategory));
router.delete('/deleteEntireDocCategory/:categoryId/:category', auth.allowCors(documentation.deleteEntireDocCategory));

module.exports = router
