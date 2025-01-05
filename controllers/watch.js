const Video              = require('../models/video.model')
const Comment            = require('../models/comment.model')
const Users              = require('../models/user.model')

exports.getVideoById = async (req, res) => {
    const { user } = req.token;
    const { id, access_key } = req.params;

    if(!id) {
        return res.status(404).json({ notFound: true });
    }

    try {
        const video = await Video.findById(id).populate('user');
        const settings = await Users.findById(user).populate('settings_id');

        if(!video) {
            return res.status(404).json({ notFound: true });
        }

        const result = {
            id: video.user._id,
            username: video.user.username,
            avatar: video.user.avatar,
            video
        };
        result.video['user'] = {};

        if(settings) {
            if(settings.settings_id.safe_content || settings.settings_id.safe_content === undefined) {
                if(video.strict) { 
                    return res.status(409).json({ forbiden: 'strict'});
                }
                else if(video.privacy) { 
                    if(video.access_key === access_key || video.user._id.equals(useruser._id)) {
                        return res.status(200).json({ result });
                    }
                    else if(!access_key) {
                        return res.status(409).json({ forbiden: 'private' }); 
                    }
                    else {
                        return res.status(409).json({ forbiden: 'access_invalid' }); 
                    }
                }
                else { 
                    return res.status(200).json({ result }); 
                }
            }
            else {
                if(video.strict) { 
                    return res.status(409).json({ forbiden: 'strict'});
                }
                else if(video.privacy) { 
                    console.log(video.access_key, access_key, video.user._id, user._id)
                    if(video.access_key === access_key || video.user._id.equals(user._id)) {
                        return res.status(200).json({ result });
                    }
                    else if(!access_key) {
                        console.log(1)
                        return res.status(409).json({ forbiden: 'private' }); 
                    }
                    else {
                        console.log(12)
                        return res.status(409).json({ forbiden: 'access_invalid' }); 
                    }
                }
                else { 
                    return res.status(200).json({ result }); 
                }
            }
        }
        else {
            if(video.strict) { 
                res.status(409).json({ forbiden: 'strict' }); 
            }
            else if(video.privacy) { 
                if(!access_key) {
                    return res.status(409).json({ forbiden: 'private' }); 
                }
                else if(video.access_key === access_key) {
                    return res.status(200).json({ result });
                }
                else {
                    return res.status(409).json({ forbiden: 'access_invalid' }); 
                }
            }
            else { 
                return res.status(200).json({  result: result });
            }
        }
    } catch (err) {
        console.log(err);
        return res.status(404).json({ 
            alert: {
                variant: 'danger', 
                message: 'video not found' 
            },
            notFound: true
        })
    }
}

exports.getVideoComment = async (req, res) => {
    const { id } = req.params;

    try {
        const comments = await Comment.find({ parent_id: id }).populate({ path: 'user_id', select: 'username avatar' }).sort({ createdAt: -1 });

        res.status(200).json({ result: comments });
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

exports.addVideoComment = async (req, res) => {
    const existing = await Video.findById(req.body.parent_id);

    if(!existing) {
        return res.status(200).json({ 
            alert: {
                variant: 'danger', 
                message: 'Video not found' 
            }
        });
    }

    try {
        const newComment = new Comment(req.body)

        await newComment.save()
    
        res.status(200).json({ 
            alert: {
                variant: 'success', 
                message: 'Commented success' 
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

exports.updateVideoComment = async (req, res) => {
    const { id, data } = req.body

    try {
        await Comment.findByIdAndUpdate(data._id, data, { new: true })

        const comments = await Comment.find({ parent_id: id }).populate({ path: 'user_id', select: 'username avatar' }).sort({ createdAt: -1 });

        return res.status(200).json({ 
            result: comments,
            alert: {
                variant: "info",
                heading: "",
                message: "Comment updated"
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