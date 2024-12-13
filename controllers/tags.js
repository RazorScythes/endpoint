const Groups             = require('../models/grouplist.model')
const Tags               = require('../models/tags.model')
const Video              = require('../models/video.model')
const mongoose           = require('mongoose');

exports.updateTagsCount = async (req, res) => {
    const tags = await Tags.find(); 

    const tagCounts = await Promise.all(
        tags.map(async (tag) => {
            const count = await Video.countDocuments({ "tags._id": tag._id.toString() });
            await Tags.findByIdAndUpdate(tag._id, { count }, { new: true });
            
            return {
                _id: tag._id,
                name: tag.name,
                count
            };
        })
    );
    
    res.status(200).json(tagCounts)
};


exports.getTags = async (req, res) => {
    const { type, options } = req.params;

    if (!type) {
        return res.status(403).json({ alert: {
            variant: 'danger', 
            message: 'invalid parameter' 
        } });
    }

    try {
        const tags = options ? await Tags.aggregate([
                { $match: { type } }, 
                {
                $project: {
                    _id: 1,
                    name: 1,
                    count: 1,
                    value: '$_id',
                },
                },
            ]) : await Tags.find({ type }).populate({ path: 'user', select: 'username role avatar' }).lean();

        res.status(200).json({ result: tags });
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

exports.newTags = async (req, res) => {
    const { user } = req.token;
    const { data } = req.body

    try {
        const newTags = new Tags(data)

        await newTags.save()

        const tags = await Tags.find({ type: data.type }).populate({ path: 'user', select: 'username role avatar' }).lean();

        return res.status(200).json({ 
            result: tags,
            alert: {
                variant: "success",
                heading: "",
                message: "Tags added"
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

exports.updateTags = async (req, res) => {
    const { data } = req.body

    try {
        await Tags.findByIdAndUpdate(data.id, data, { new: true })

        const tags = await Tags.find({ type: data.type }).populate({ path: 'user', select: 'username role avatar' }).lean();

        return res.status(200).json({ 
            result: tags,
            alert: {
                variant: "info",
                heading: "",
                message: "Tags updated"
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

exports.deleteTags = async (req, res) => {
    const { id, type } = req.params

    try {
        if (!type) {
            return res.status(403).json({ alert: {
                variant: 'danger', 
                message: 'invalid parameter' 
            } });
        }

        await Tags.findByIdAndDelete(id)

        const tags = await Tags.find({ type }).populate({ path: 'user', select: 'username role avatar' }).lean();

        return res.status(200).json({ 
            result: tags,
            alert: {
                variant: "warning",
                heading: "",
                message: "Tags deleted"
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

exports.deleteMultipleTags = async (req, res) => {
    const { user } = req.token;
    const { ids, type } = req.body

    try {
        if (ids.length === 0 || !type) {
            return res.status(403).json({ alert: {
                variant: 'danger', 
                message: 'invalid parameter' 
            } });
        }

        const objectIdsToDelete = ids.map(id => new mongoose.Types.ObjectId(id));

        await Tags.deleteMany({ _id: { $in: objectIdsToDelete } })

        const tags = await Tags.find({ type }).populate({ path: 'user', select: 'username role avatar' }).lean();

        return res.status(200).json({ 
            result: tags,
            alert: {
                variant: "warning",
                heading: "",
                message: "Tags deleted"
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