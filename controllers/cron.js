const Category           = require('../models/category.model')
const Tags               = require('../models/tags.model')
const Author             = require('../models/author.model')
const Video              = require('../models/video.model')

exports.updateListCount = async (req, res) => {
    const tags = await Tags.find(); 
    const category = await Category.find(); 
    const author = await Author.find(); 

    const tag_result = await Promise.all(
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

    const category_result = await Promise.all(
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

    const author_result = await Promise.all(
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
    
    res.status(200).json({
        tag_result,
        category_result,
        author_result
    })
};

exports.updateVideoProperties = async (req, res) => {
    const videos = await Video.find();

    const result = await Promise.all(
        videos.map(async (video) => {
            if(video.tags.length > 0) {
                const data = await Promise.all (
                    video.tags.map(async (tag) => {
                        const t = await Tags.findById(tag?._id);

                        return t ? {
                            _id: t._id.toString(),
                            name: t.name,
                            count: t.count,
                            value: t._id.toString()
                        } : null
                    })
                )

                const filteredData = data.filter((item) => item !== null);

                await Video.findByIdAndUpdate(video._id, { tags: filteredData }, { new: true });
            }

            if(video.category.length > 0) {
                const data = await Promise.all (
                    video.category.map(async (cat) => {
                        const c = await Category.findById(cat?._id);

                        return c ? {
                            _id: c._id.toString(),
                            name: c.name,
                            value: c._id.toString()
                        } : null
                    })
                )

                const filteredData = data.filter((item) => item !== null);

                await Video.findByIdAndUpdate(video._id, { category: filteredData }, { new: true });
            }

            if(video.owner.length > 0) {
                const data = await Promise.all (
                    video.owner.map(async (author) => {
                        const a = await Author.findById(author?._id);

                        return a ? {
                            _id: a._id.toString(),
                            name: a.name,
                            value: a._id.toString()
                        } : null
                    })
                )

                const filteredData = data.filter((item) => item !== null);

                await Video.findByIdAndUpdate(video._id, { owner: filteredData }, { new: true });
            }

            return video;
        })
    )

    res.status(200).json(result)
}