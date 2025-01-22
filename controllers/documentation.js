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

const toSnakeCase = (str) =>
    str
        .toLowerCase()
        .replace(/\s+/g, "_")
        .replace(/[^\w_]/g, ""); 

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

exports.getDocsById = async (req, res) => {
    const { category } = req.params; 

    if (!category) {
        return res.status(403).json({ alert: {
            variant: 'danger', 
            message: 'invalid parameter' 
        } });
    }

    try {
        const doc = await Docs.findOne({ doc_name: category }).lean()

        if(!doc) {
            return res.status(404).json({ alert: {
                variant: 'danger', 
                message: 'doc not found' 
            } });
        }

        const doc_category = await DocsCategory.find({ docs: doc._id }).lean()

        const data = await Promise.all(
            doc_category.map(async (item) => {
                const sub = await DocsSubCategory.find({ category: item._id });
        
                return {
                    ...item,
                    dropdown: sub,
                    token: doc.token,
                    base_url: doc.base_url,
                };
            })
        );
        
        res.status(200).json({ result: data });
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

exports.newDocCategory = async (req, res) => {
    const { category, formData } = req.body; 

    if (!category) {
        return res.status(403).json({ alert: {
            variant: 'danger', 
            message: 'invalid parameter' 
        } });
    }

    try {
        const doc = await Docs.findOne({ doc_name: category }).lean()

        if(!doc) {
            return res.status(404).json({ alert: {
                variant: 'danger', 
                message: 'doc not found' 
            } });
        }

        const existing = await DocsCategory.findOne({ docs: doc._id, name: formData.category }).lean()
        
        if(existing) {
            return res.status(500).json({ 
                alert: {
                    variant: 'danger', 
                    message: 'category already exists' 
                }
            })
        }

        const newData = await new DocsCategory({
            docs: doc._id,
            name: formData.category,
            path: toSnakeCase(formData.category)
        }).save()

        if(formData.sub) {
            await Promise.all(
                formData.sub.map(sub => 
                    new DocsSubCategory({
                        category: newData._id,
                        name: sub,
                        path: `${toSnakeCase(formData.category)}/${sub}`,
                        method: 'get',
                        description: '',
                        endpoint: '',
                        token_required: false,
                        payload: [],
                        type: 'sub',
                        auto_response: false,
                        response_result: ''
                    }).save()
                )
            );
        }
        else {
            await new DocsSubCategory({
                category: newData._id,
                name: formData.category,
                path: toSnakeCase(formData.category),
                method: 'get',
                description: '',
                endpoint: '',
                token_required: false,
                payload: [],
                type: 'main',
                auto_response: false,
                response_result: ''
            }).save()
        }

        const doc_category = await DocsCategory.find({ docs: doc._id }).lean()

        const data = await Promise.all(
            doc_category.map(async (item) => {
                const sub = await DocsSubCategory.find({ category: item._id });
        
                return {
                    ...item,
                    dropdown: sub,
                    token: doc.token,
                    base_url: doc.base_url,
                };
            })
        );

        return res.status(200).json({ 
            result: data,
            alert: {
                variant: 'success', 
                message: 'category created' 
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

exports.deleteDocCategory = async (req, res) => {
    const { id, category } = req.params;

    if (!category) {
        return res.status(403).json({ alert: {
            variant: 'danger', 
            message: 'invalid parameter' 
        } });
    }

    try {
        const doc = await Docs.findOne({ doc_name: category }).lean()

        if(!doc) {
            return res.status(404).json({ alert: {
                variant: 'danger', 
                message: 'doc not found' 
            } });
        }

        const data = await DocsSubCategory.findById(id).lean();

        if(!data) {
            return res.status(404).json({ alert: {
                variant: 'danger', 
                message: 'documentation not found' 
            } });
        }

        const count = await DocsSubCategory.find({ category: data.category }).lean();
        
        await DocsSubCategory.findByIdAndDelete(id)

        if(count.length === 1) {
            await DocsCategory.findByIdAndDelete(data.category)
        }
        
        const doc_category = await DocsCategory.find({ docs: doc._id }).lean()

        const result = await Promise.all(
            doc_category.map(async (item) => {
                const sub = await DocsSubCategory.find({ category: item._id });
        
                return {
                    ...item,
                    dropdown: sub,
                    token: doc.token,
                    base_url: doc.base_url,
                };
            })
        );

        return res.status(200).json({ 
            result: result,
            alert: {
                variant: 'success', 
                message: 'documentation deleted' 
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

exports.updateDocCategory = async (req, res) => {
    const { category, data } = req.body

    if (!category) {
        return res.status(403).json({ alert: {
            variant: 'danger', 
            message: 'invalid parameter' 
        } });
    }

    try {
        const doc = await Docs.findOne({ doc_name: category }).lean()

        if(!doc) {
            return res.status(404).json({ alert: {
                variant: 'danger', 
                message: 'doc not found' 
            } });
        }

        await DocsSubCategory.findByIdAndUpdate(data._id, data, { new: true })

        const doc_category = await DocsCategory.find({ docs: doc._id }).lean()

        const result = await Promise.all(
            doc_category.map(async (item) => {
                const sub = await DocsSubCategory.find({ category: item._id });
        
                return {
                    ...item,
                    dropdown: sub,
                    token: doc.token,
                    base_url: doc.base_url,
                };
            })
        );

        return res.status(200).json({ 
            result: result,
            alert: {
                variant: 'success', 
                message: 'documentation updated' 
            }
        });
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