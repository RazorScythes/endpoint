const Video              = require('../models/video.model')
const Comment            = require('../models/comment.model')
const Groups             = require('../models/grouplist.model')
const Users              = require('../models/user.model')
const db                 = require('../plugins/database')

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
                    if(video.access_key === access_key || video.user._id.equals(user._id)) {
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

exports.getVideoList = async (req, res) => {
    const { user } = req.token;
    const { id } = req.params;

    try {
        const video = await Video.findById(id).select('_id thumbnail title views groups user downloadUrl duration');
        const group = await Groups.findById(video.groups).select('group_name description strict privacy');
        const settings = await Users.findById(user).populate('settings_id');

        const getResponseData = async (videos) => ({
            group_name: group.group_name,
            description: group.description,
            videos
        });

        let videos;
        if (group.strict && settings.settings_id) {
            videos = await Video.find({ groups: group._id }).select('_id thumbnail title views groups user downloadUrl duration');
        } else if (group.privacy && video.user.equals(user._id)) {
            videos = await Video.find({ groups: group._id }).select('_id thumbnail title views groups user downloadUrl duration');
        } else if (!group.strict && !group.privacy) {
            videos = await Video.find({ groups: group._id }).select('_id thumbnail title views groups user downloadUrl duration');
        } else {
            videos = [video];
        }

        const data = await getResponseData(videos);
        return res.status(200).json({ result: data });
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


exports.getVideoComment = async (req, res) => {
    const { id } = req.params;

    try {
        const comments = await db.getComments(id);

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

        const comments = await db.getComments(req.body.parent_id);
    
        res.status(200).json({ 
            result: comments,
            alert: {
                variant: 'success', 
                message: 'Commented!' 
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

        const comments = await db.getComments(id);

        return res.status(200).json({ 
            result: comments
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

exports.deleteVideoComment = async (req, res) => {
    const { id, video_id } = req.params
    
    try {
        if (!id) {
            return res.status(403).json({ alert: {
                variant: 'danger', 
                message: 'invalid parameter' 
            } });
        }

        await Comment.findByIdAndDelete(id)

        const comments = await db.getComments(video_id);

        return res.status(200).json({ 
            result: comments,
            alert: {
                variant: "warning",
                heading: "",
                message: "Deleted comment"
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