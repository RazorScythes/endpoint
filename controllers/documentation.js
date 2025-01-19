const Docs               = require('../models/docs.model')
const DocsCategory       = require('../models/docsCategory.model')
const DocsSubCategory    = require('../models/docsSubCategory.model')
const mongoose           = require('mongoose');
const { ObjectId }       = require('mongoose').Types;

const documentSettings = (type, value) => {
    if(type === 'strict') return { label: 'Strict mode', data: { strict: value } };
    else if(type === 'private') return { label: 'Private', data: { private: value } };
    else if(type === 'downloadable') return { label: 'Downloadable', data: { downloadable: value } };
    else return {};
}

exports.getDocs = async (req, res) => {
    try {
        const docs = await Docs.aggregate([
            {
                $lookup: {
                    from: "docsCategory", 
                    localField: "_id",      
                    foreignField: "docId",
                    as: "categories"
                }
            },
            {
                $addFields: {
                    categoryCount: { $size: "$categories" } 
                }
            },
            {
                $project: {
                    categories: 0 
                }
            }
        ]);

        return res.status(200).json({ 
            result: docs
        });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ 
            alert: {
                variant: 'danger', 
                message: 'internal server error' 
            }
        });
    }
};

exports.newDocs = async (req, res) => {
    const { data } = req.body

    try {
        const existing = await Docs.findOne({ doc_name: data.doc_name });      
 
        if(existing) {
            return res.status(500).json({ 
                alert: {
                    variant: 'danger', 
                    message: 'Docs already exists' 
                }
            }) 
        }

        const newDocs = new Docs(data)

        await newDocs.save()

        const docs = await Docs.aggregate([
            {
                $lookup: {
                    from: "docsCategory", 
                    localField: "_id",      
                    foreignField: "docId",
                    as: "categories"
                }
            },
            {
                $addFields: {
                    categoryCount: { $size: "$categories" } 
                }
            },
            {
                $project: {
                    categories: 0 
                }
            }
        ]);

        return res.status(200).json({ 
            result: docs,
            alert: {
                variant: "success",
                heading: "",
                message: "Docs added"
            }
        })
    } catch(err) {
        console.log(err)
        return res.status(500).json({ 
            alert: {
                variant: 'danger', 
                message: 'internal server error' 
            }
        })
    }
}

exports.updateDocs = async (req, res) => {
    const { data } = req.body

    try {
        await Docs.findByIdAndUpdate(data.id, data, { new: true })

        const docs = await Docs.aggregate([
            {
                $lookup: {
                    from: "docsCategory", 
                    localField: "_id",      
                    foreignField: "docId",
                    as: "categories"
                }
            },
            {
                $addFields: {
                    categoryCount: { $size: "$categories" } 
                }
            },
            {
                $project: {
                    categories: 0 
                }
            }
        ]);

        return res.status(200).json({ 
            result: docs,
            alert: {
                variant: "info",
                heading: "",
                message: "Docs updated"
            }
        })
    } catch(err) {
        console.log(err)
        return res.status(500).json({ 
            alert: {
                variant: 'danger', 
                message: 'internal server error' 
            }
        })
    }
}

exports.updateDocsSettings = async (req, res) => {
    const { id, type, value } = req.body

    try {    
        const settings = documentSettings(type, value)

        if(!settings) {
            return res.status(403).json({ alert: {
                variant: 'danger', 
                message: 'invalid parameter' 
            } });
        }
  
        const result = await Docs.findByIdAndUpdate(id, settings.data, { new: true });

        const docs = await Docs.aggregate([
            {
                $match: { _id: new ObjectId(id) } 
            },
            {
                $lookup: {
                    from: "docscategories", 
                    localField: "_id",     
                    foreignField: "docId", 
                    as: "categories"
                }
            },
            {
                $addFields: {
                    categoryCount: { $size: "$categories" }
                }
            },
            {
                $project: {
                    categories: 0 
                }
            }
        ]);

        res.status(200).json({ 
            result: docs[0],
            alert: {
                variant: 'success', 
                message: `${settings.label} updated`
            }
        });
    } catch (err) {
        console.log(err)
        return res.status(500).json({ 
            alert: {
                variant: 'danger', 
                message: 'internal server error' 
            }
        })
    }
}

exports.deleteDocs = async (req, res) => {
    const { id } = req.params

    try {
        await Docs.findByIdAndDelete(id)

        const docs = await Docs.aggregate([
            {
                $lookup: {
                    from: "docscategories", 
                    localField: "_id",     
                    foreignField: "docId", 
                    as: "categories"
                }
            },
            {
                $addFields: {
                    categoryCount: { $size: "$categories" }
                }
            },
            {
                $project: {
                    categories: 0 
                }
            }
        ]);

        return res.status(200).json({ 
            result: docs,
            alert: {
                variant: "warning",
                heading: "",
                message: "Docs deleted"
            }
        })
    } catch(err) {
        console.log(err)
        return res.status(500).json({ 
            alert: {
                variant: 'danger', 
                message: 'internal server error' 
            }
        })
    }
}

exports.deleteMultipleDocs = async (req, res) => {
    const { ids } = req.body

    try {
        if (ids.length === 0) {
            return res.status(403).json({ alert: {
                variant: 'danger', 
                message: 'invalid parameter' 
            } });
        }

        const objectIdsToDelete = ids.map(id => new mongoose.Types.ObjectId(id));

        await Docs.deleteMany({ _id: { $in: objectIdsToDelete } })

        const docs = await Docs.aggregate([
            {
                $lookup: {
                    from: "docscategories", 
                    localField: "_id",     
                    foreignField: "docId", 
                    as: "categories"
                }
            },
            {
                $addFields: {
                    categoryCount: { $size: "$categories" }
                }
            },
            {
                $project: {
                    categories: 0 
                }
            }
        ]);

        return res.status(200).json({ 
            result: docs,
            alert: {
                variant: "warning",
                heading: "",
                message: "Docs deleted"
            }
        })
    } catch(err) {
        console.log(err)
        return res.status(500).json({ 
            alert: {
                variant: 'danger', 
                message: 'internal server error' 
            }
        })
    }
}