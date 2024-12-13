const Tags               = require('../models/tags.model')
const Video              = require('../models/video.model')

export default async function updateTagsCount (req, res) {
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