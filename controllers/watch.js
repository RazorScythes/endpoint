const Video              = require('../models/video.model')
const Comment            = require('../models/comment.model')
const Groups             = require('../models/grouplist.model')
const Users              = require('../models/user.model')
const db                 = require('../plugins/database')
const { createNotification } = require('./notification')

exports.likeVideo = async (req, res) => {
    const { user } = req.token
    const { videoId } = req.body

    try {
        const video = await Video.findById(videoId)
        if (!video) return res.status(404).json({ alert: { variant: 'danger', message: 'Video not found' } })

        const userId = user._id.toString()
        const alreadyLiked = video.likes.includes(userId)

        if (alreadyLiked) {
            video.likes = video.likes.filter(id => id !== userId)
        } else {
            video.likes.push(userId)
            video.dislikes = video.dislikes.filter(id => id !== userId)
        }

        await video.save()

        const result = { likes: video.likes, dislikes: video.dislikes }

        const io = req.app.get('io')
        io.to(`video:${videoId}`).emit('likes_updated', { videoId, ...result })

        if (!alreadyLiked && video.user) {
            const populatedVideo = await Video.findById(videoId).populate('user', 'username')
            createNotification({
                recipientId: video.user,
                senderId: user._id,
                type: 'like',
                message: `liked your video "${populatedVideo?.title || 'Untitled'}"`,
                link: `/watch/${videoId}`,
                referenceId: videoId,
                referenceModel: 'Video',
                io
            })
        }

        res.status(200).json({ result })
    } catch (err) {
        console.log(err)
        return res.status(500).json({ alert: { variant: 'danger', message: 'internal server error' } })
    }
}

exports.dislikeVideo = async (req, res) => {
    const { user } = req.token
    const { videoId } = req.body

    try {
        const video = await Video.findById(videoId)
        if (!video) return res.status(404).json({ alert: { variant: 'danger', message: 'Video not found' } })

        const userId = user._id.toString()
        const alreadyDisliked = video.dislikes.includes(userId)

        if (alreadyDisliked) {
            video.dislikes = video.dislikes.filter(id => id !== userId)
        } else {
            video.dislikes.push(userId)
            video.likes = video.likes.filter(id => id !== userId)
        }

        await video.save()

        const result = { likes: video.likes, dislikes: video.dislikes }

        const io = req.app.get('io')
        io.to(`video:${videoId}`).emit('likes_updated', { videoId, ...result })

        res.status(200).json({ result })
    } catch (err) {
        console.log(err)
        return res.status(500).json({ alert: { variant: 'danger', message: 'internal server error' } })
    }
}

exports.toggleSubscribe = async (req, res) => {
    const { user } = req.token
    const { targetUserId } = req.body

    try {
        if (!targetUserId) {
            return res.status(400).json({ alert: { variant: 'danger', message: 'Target user is required' } })
        }

        const currentUserId = user._id.toString()

        if (currentUserId === targetUserId) {
            return res.status(400).json({ alert: { variant: 'danger', message: 'You cannot subscribe to your own account' } })
        }

        const targetUser = await Users.findById(targetUserId)
        if (!targetUser) {
            return res.status(404).json({ alert: { variant: 'danger', message: 'User not found' } })
        }

        if (!targetUser.subscribers) targetUser.subscribers = []

        const alreadySubscribed = targetUser.subscribers.includes(currentUserId)

        if (alreadySubscribed) {
            targetUser.subscribers = targetUser.subscribers.filter(id => id !== currentUserId)
        } else {
            targetUser.subscribers.push(currentUserId)

            const io = req.app.get('io')
            createNotification({
                recipientId: targetUserId,
                senderId: user._id,
                type: 'subscribe',
                message: `subscribed to your channel`,
                link: `/user/${user.username || user._id}`,
                referenceId: user._id,
                referenceModel: 'User',
                io
            })
        }

        await targetUser.save()

        res.status(200).json({
            result: { subscribers: targetUser.subscribers }
        })
    } catch (err) {
        console.log(err)
        return res.status(500).json({ alert: { variant: 'danger', message: 'internal server error' } })
    }
}

exports.getVideosByType = async (req, res) => {
    const { type } = req.params;
    const { search, page = 1, limit = 20, filter = 'all', tag } = req.query;

    if (!type) {
        return res.status(400).json({ alert: { variant: 'danger', message: 'type is required' } });
    }

    try {
        const publicGroups = await Groups.find({
            strict: { $ne: true },
            privacy: { $ne: true }
        }).select('_id');

        const groupIds = publicGroups.map(g => g._id);

        if (groupIds.length === 0) {
            return res.status(200).json({ result: [], total: 0, page: 1, totalPages: 0, tags: [] });
        }

        const baseMatch = {
            groups: { $in: groupIds },
            strict: { $ne: true },
            privacy: { $ne: true }
        };

        if (search) {
            baseMatch.title = { $regex: search, $options: 'i' };
        }

        const tagsAgg = await Video.aggregate([
            { $match: baseMatch },
            { $match: { tags: { $exists: true, $ne: [], $type: 'array' } } },
            { $unwind: '$tags' },
            { $group: { _id: '$tags.name', count: { $sum: 1 } } },
            { $match: { _id: { $ne: null } } },
            { $sort: { count: -1 } }
        ]);
        const availableTags = tagsAgg.map(t => ({ name: t._id, count: t.count }));

        const matchStage = { ...baseMatch };
        if (tag) {
            matchStage['tags.name'] = tag;
        }

        const skip = (parseInt(page) - 1) * parseInt(limit);
        const total = await Video.countDocuments(matchStage);

        let sortStage;
        switch (filter) {
            case 'latest':
                sortStage = { createdAt: -1 };
                break;
            case 'popular':
                sortStage = { likesCount: -1, createdAt: -1 };
                break;
            case 'most_viewed':
                sortStage = { viewsCount: -1, createdAt: -1 };
                break;
            default:
                sortStage = { createdAt: -1 };
        }

        const pipeline = [
            { $match: matchStage },
            {
                $addFields: {
                    likesCount: { $size: { $ifNull: ['$likes', []] } },
                    viewsCount: { $size: { $ifNull: ['$views', []] } }
                }
            },
            { $sort: sortStage },
            { $skip: skip },
            { $limit: parseInt(limit) },
            {
                $lookup: {
                    from: 'users',
                    localField: 'user',
                    foreignField: '_id',
                    as: 'userData'
                }
            },
            { $unwind: { path: '$userData', preserveNullAndEmptyArrays: true } },
            {
                $project: {
                    _id: 1,
                    thumbnail: 1,
                    title: 1,
                    views: 1,
                    likes: 1,
                    tags: 1,
                    duration: 1,
                    downloadUrl: 1,
                    createdAt: 1,
                    user: { $ifNull: ['$userData.username', ''] },
                    avatar: { $ifNull: ['$userData.avatar', ''] }
                }
            }
        ];

        const result = await Video.aggregate(pipeline);

        return res.status(200).json({
            result,
            total,
            page: parseInt(page),
            totalPages: Math.ceil(total / parseInt(limit)),
            tags: availableTags
        });
    } catch (err) {
        console.log(err);
        return res.status(500).json({
            alert: { variant: 'danger', message: 'internal server error' }
        });
    }
};

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
            subscribers: video.user.subscribers || [],
            video
        };
        result.video['user'] = {};

        if(settings) {
            if(settings.settings_id.safe_content || settings.settings_id.safe_content === undefined) {
                if(video.strict) { 
                    return res.status(409).json({ forbidden: 'strict'});
                }
                else if(video.privacy) { 
                    if(video.access_key === access_key || video.user._id.equals(user._id)) {
                        return res.status(200).json({ result });
                    }
                    else if(!access_key) {
                        return res.status(409).json({ forbidden: 'private' }); 
                    }
                    else {
                        return res.status(409).json({ forbidden: 'access_invalid' }); 
                    }
                }
                else { 
                    return res.status(200).json({ result }); 
                }
            }
            else {
                if(video.strict) { 
                    return res.status(409).json({ forbidden: 'strict'});
                }
                else if(video.privacy) { 
                    if(video.access_key === access_key || video.user._id.equals(user._id)) {
                        return res.status(200).json({ result });
                    }
                    else if(!access_key) {
                        return res.status(409).json({ forbidden: 'private' }); 
                    }
                    else {
                        return res.status(409).json({ forbidden: 'access_invalid' }); 
                    }
                }
                else { 
                    return res.status(200).json({ result }); 
                }
            }
        }
        else {
            if(video.strict) { 
                return res.status(409).json({ forbidden: 'strict' }); 
            }
            else if(video.privacy) { 
                if(!access_key) {
                    return res.status(409).json({ forbidden: 'private' }); 
                }
                else if(video.access_key === access_key) {
                    return res.status(200).json({ result });
                }
                else {
                    return res.status(409).json({ forbidden: 'access_invalid' }); 
                }
            }
            else { 
                return res.status(200).json({ result });
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

        const io = req.app.get('io')
        io.to(`video:${req.body.parent_id}`).emit('comments_updated', { videoId: req.body.parent_id, comments })

        if (existing.user && req.body.user) {
            createNotification({
                recipientId: existing.user,
                senderId: req.body.user,
                type: 'comment',
                message: `commented on your video "${existing.title || 'Untitled'}"`,
                link: `/watch/${req.body.parent_id}`,
                referenceId: req.body.parent_id,
                referenceModel: 'Video',
                io
            })
        }

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

        const io = req.app.get('io')
        io.to(`video:${id}`).emit('comments_updated', { videoId: id, comments })

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

        const io = req.app.get('io')
        io.to(`video:${video_id}`).emit('comments_updated', { videoId: video_id, comments })

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

exports.viewVideo = async (req, res) => {
    const { videoId, uid } = req.body;

    if (!videoId || !uid) {
        return res.status(400).json({ alert: { variant: 'danger', message: 'Missing required fields' } });
    }

    try {
        const video = await Video.findByIdAndUpdate(
            videoId,
            { $addToSet: { views: uid } },
            { new: true }
        );

        if (!video) {
            return res.status(404).json({ alert: { variant: 'danger', message: 'Video not found' } });
        }

        return res.status(200).json({ result: { views: video.views } });
    } catch (err) {
        console.log(err);
        return res.status(500).json({ alert: { variant: 'danger', message: 'internal server error' } });
    }
}

exports.getRelatedVideos = async (req, res) => {
    const { id } = req.params;
    const limit = parseInt(req.query.limit) || 8;

    try {
        const video = await Video.findById(id).select('tags category groups');
        if (!video) return res.status(200).json({ result: [] });

        const publicGroups = await Groups.find({
            strict: { $ne: true },
            privacy: { $ne: true }
        }).select('_id');
        const groupIds = publicGroups.map(g => g._id);

        const tagNames = (video.tags || []).map(t => t.name).filter(Boolean);
        const catIds = (video.category || []).map(c => c._id || c).filter(Boolean);

        const matchConditions = [
            { 'tags.name': { $in: tagNames } },
            { category: { $elemMatch: { _id: { $in: catIds } } } },
            { groups: video.groups }
        ];

        const pipeline = [
            {
                $match: {
                    _id: { $ne: video._id },
                    groups: { $in: groupIds },
                    strict: { $ne: true },
                    privacy: { $ne: true },
                    $or: matchConditions
                }
            },
            {
                $addFields: {
                    relevance: {
                        $add: [
                            { $size: { $setIntersection: [{ $ifNull: [{ $map: { input: '$tags', as: 't', in: '$$t.name' } }, []] }, tagNames] } },
                            { $cond: [{ $eq: ['$groups', video.groups] }, 2, 0] }
                        ]
                    },
                    viewsCount: { $size: { $ifNull: ['$views', []] } }
                }
            },
            { $sort: { relevance: -1, viewsCount: -1, createdAt: -1 } },
            { $limit: limit },
            {
                $lookup: {
                    from: 'users',
                    localField: 'user',
                    foreignField: '_id',
                    as: 'userData'
                }
            },
            { $unwind: { path: '$userData', preserveNullAndEmptyArrays: true } },
            {
                $project: {
                    _id: 1, thumbnail: 1, title: 1, views: 1, likes: 1,
                    tags: 1, duration: 1, downloadUrl: 1, createdAt: 1,
                    user: { $ifNull: ['$userData.username', ''] },
                    avatar: { $ifNull: ['$userData.avatar', ''] }
                }
            }
        ];

        const result = await Video.aggregate(pipeline);
        return res.status(200).json({ result });
    } catch (err) {
        console.log(err);
        return res.status(200).json({ result: [] });
    }
}