const Author             = require('../models/author.model')
const Video              = require('../models/video.model')
const mongoose           = require('mongoose');

exports.updateAuthorCount = async (req, res) => {
    const author = await Author.find(); 

    const result = await Promise.all(
        author.map(async (tag) => {
            const count = await Video.countDocuments({ "owner._id": tag._id.toString() });
            await Author.findByIdAndUpdate(tag._id, { count }, { new: true });
            
            return {
                _id: tag._id,
                name: tag.name,
                count
            };
        })
    );
    
    res.status(200).json(result)
};

exports.getAuthor = async (req, res) => {
    const { type, options } = req.params;

    if (!type) {
        return res.status(403).json({ alert: {
            variant: 'danger', 
            message: 'invalid parameter' 
        } });
    }

    try {
        const author = options ? await Author.aggregate([
                { $match: { type } }, 
                {
                $project: {
                    _id: 1,
                    name: 1,
                    value: '$_id',
                },
                },
            ]) : await Author.find({ type }).populate({ path: 'user', select: 'username role avatar' }).lean();

        res.status(200).json({ result: author });
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

exports.newAuthor = async (req, res) => {
    const { data } = req.body

    try {
        const existing = await Author.findOne({ name: data.name });      
 
        if(existing) {
            return res.status(500).json({ 
                alert: {
                    variant: 'danger', 
                    message: 'Author already exists' 
                }
            }) 
        }

        const newAuthor = new Author(data)

        await newAuthor.save()

        const author = await Author.find({ type: data.type }).populate({ path: 'user', select: 'username role avatar' }).lean();

        return res.status(200).json({ 
            result: author,
            alert: {
                variant: "success",
                heading: "",
                message: "Author added"
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

exports.updateAuthor = async (req, res) => {
    const { data } = req.body

    try {
        await Author.findByIdAndUpdate(data.id, data, { new: true })

        const author = await Author.find({ type: data.type }).populate({ path: 'user', select: 'username role avatar' }).lean();

        return res.status(200).json({ 
            result: author,
            alert: {
                variant: "info",
                heading: "",
                message: "Author updated"
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

exports.deleteAuthor = async (req, res) => {
    const { id, type } = req.params

    try {
        if (!type) {
            return res.status(403).json({ alert: {
                variant: 'danger', 
                message: 'invalid parameter' 
            } });
        }

        await Author.findByIdAndDelete(id)

        const author = await Author.find({ type }).populate({ path: 'user', select: 'username role avatar' }).lean();

        return res.status(200).json({ 
            result: author,
            alert: {
                variant: "warning",
                heading: "",
                message: "Author deleted"
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

exports.deleteMultipleAuthor = async (req, res) => {
    const { ids, type } = req.body

    try {
        if (ids.length === 0 || !type) {
            return res.status(403).json({ alert: {
                variant: 'danger', 
                message: 'invalid parameter' 
            } });
        }

        const objectIdsToDelete = ids.map(id => new mongoose.Types.ObjectId(id));

        await Author.deleteMany({ _id: { $in: objectIdsToDelete } })

        const author = await Author.find({ type }).populate({ path: 'user', select: 'username role avatar' }).lean();

        return res.status(200).json({ 
            result: author,
            alert: {
                variant: "warning",
                heading: "",
                message: "Author deleted"
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
