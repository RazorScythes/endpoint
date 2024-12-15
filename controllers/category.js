const Category           = require('../models/category.model')
const Video              = require('../models/video.model')
const mongoose           = require('mongoose');

const categorySettings = (type, value) => {
    if(type === 'strict') return { label: 'Strict mode', data: { strict: value } };
    else if(type === 'privacy') return { label: 'Visibility', data: { privacy: value } };
    else if(type === 'downloadable') return { label: 'Downloadable', data: { downloadable: value } };
    else return {};
}

exports.updateCategoryCount = async (req, res) => {
    const category = await Category.find(); 

    const result = await Promise.all(
        category.map(async (tag) => {
            const count = await Video.countDocuments({ "category._id": tag._id.toString() });
            await Category.findByIdAndUpdate(tag._id, { count }, { new: true });
            
            return {
                _id: tag._id,
                name: tag.name,
                count
            };
        })
    );
    
    res.status(200).json(result)
};

exports.getCategory = async (req, res) => {
    const { type, options } = req.params;

    if (!type) {
        return res.status(403).json({ alert: {
            variant: 'danger', 
            message: 'invalid parameter' 
        } });
    }

    try {
        const category = options ? await Category.aggregate([
                { $match: { type } }, 
                {
                $project: {
                    _id: 1,
                    name: 1,
                    value: '$_id',
                },
                },
            ]) : await Category.find({ type }).populate({ path: 'user', select: 'username role avatar' }).lean();

        res.status(200).json({ result: category });
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

exports.newCategory = async (req, res) => {
    const { data } = req.body

    try {
        const existing = await Category.findOne({ name: data.name });      
 
        if(existing) {
            return res.status(500).json({ 
                alert: {
                    variant: 'danger', 
                    message: 'Category already exists' 
                }
            }) 
        }

        const newCategory = new Category(data)

        await newCategory.save()

        const category = await Category.find({ type: data.type }).populate({ path: 'user', select: 'username role avatar' }).lean();

        return res.status(200).json({ 
            result: category,
            alert: {
                variant: "success",
                heading: "",
                message: "Category added"
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

exports.updateCategory = async (req, res) => {
    const { data } = req.body

    try {
        await Category.findByIdAndUpdate(data.id, data, { new: true })

        const category = await Category.find({ type: data.type }).populate({ path: 'user', select: 'username role avatar' }).lean();

        return res.status(200).json({ 
            result: category,
            alert: {
                variant: "info",
                heading: "",
                message: "Category updated"
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

exports.deleteCategory = async (req, res) => {
    const { id, type } = req.params

    try {
        if (!type) {
            return res.status(403).json({ alert: {
                variant: 'danger', 
                message: 'invalid parameter' 
            } });
        }

        await Category.findByIdAndDelete(id)

        const category = await Category.find({ type }).populate({ path: 'user', select: 'username role avatar' }).lean();

        return res.status(200).json({ 
            result: category,
            alert: {
                variant: "warning",
                heading: "",
                message: "Category deleted"
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

exports.deleteMultipleCategory = async (req, res) => {
    const { ids, type } = req.body

    try {
        if (ids.length === 0 || !type) {
            return res.status(403).json({ alert: {
                variant: 'danger', 
                message: 'invalid parameter' 
            } });
        }

        const objectIdsToDelete = ids.map(id => new mongoose.Types.ObjectId(id));

        await Category.deleteMany({ _id: { $in: objectIdsToDelete } })

        const category = await Category.find({ type }).populate({ path: 'user', select: 'username role avatar' }).lean();

        return res.status(200).json({ 
            result: category,
            alert: {
                variant: "warning",
                heading: "",
                message: "Category deleted"
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

exports.updateCategorySettings = async (req, res) => {
    const { id, type, value } = req.body

    try {    
        const settings = categorySettings(type, value)

        if(!settings) {
            return res.status(403).json({ alert: {
                variant: 'danger', 
                message: 'invalid parameter' 
            } });
        }
        
        const result = await Category.findByIdAndUpdate(id, settings.data, { new: true }).populate({ path: 'user', select: 'username role avatar' }).lean();

        res.status(200).json({ 
            result,
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
