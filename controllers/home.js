const Video = require('../models/video.model')
const Game = require('../models/game.model')
const Project = require('../models/project.model')
const Users = require('../models/user.model')
const Groups = require('../models/grouplist.model')
const Comment = require('../models/comment.model')

exports.getHomeData = async (req, res) => {
    try {
        const publicGroups = await Groups.find({
            strict: { $ne: true },
            privacy: { $ne: true }
        }).select('_id')

        const groupIds = publicGroups.map(g => g._id)

        const [recentVideos, recentGames, recentProjects, stats] = await Promise.all([
            Video.aggregate([
                {
                    $match: {
                        groups: { $in: groupIds },
                        strict: { $ne: true },
                        privacy: { $ne: true }
                    }
                },
                { $sort: { createdAt: -1 } },
                { $limit: 12 },
                {
                    $addFields: {
                        viewsCount: { $size: { $ifNull: ['$views', []] } },
                        likesCount: { $size: { $ifNull: ['$likes', []] } }
                    }
                },
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
                        _id: 1, thumbnail: 1, title: 1, viewsCount: 1, likesCount: 1,
                        duration: 1, createdAt: 1,
                        'userData.username': 1, 'userData.avatar': 1
                    }
                }
            ]),

            Game.find({ deleted_at: null, privacy: false, strict: { $ne: true } })
                .populate({ path: 'user', select: 'username avatar' })
                .sort({ createdAt: -1 })
                .limit(6)
                .select('title thumbnail description ratings downloads tags category createdAt')
                .lean(),

            Project.find({ privacy: { $ne: true } })
                .populate({ path: 'user', select: 'username avatar' })
                .sort({ createdAt: -1 })
                .limit(6)
                .select('title thumbnail description tags category status createdAt')
                .lean(),

            (async () => {
                const [videoCount, gameCount, projectCount, userCount] = await Promise.all([
                    Video.countDocuments({ groups: { $in: groupIds }, strict: { $ne: true }, privacy: { $ne: true } }),
                    Game.countDocuments({ deleted_at: null, privacy: false }),
                    Project.countDocuments({ privacy: { $ne: true } }),
                    Users.countDocuments({})
                ])
                return { videos: videoCount, games: gameCount, projects: projectCount, users: userCount }
            })()
        ])

        return res.status(200).json({
            recentVideos,
            recentGames,
            recentProjects,
            stats
        })
    } catch (err) {
        console.log(err)
        return res.status(200).json({
            recentVideos: [],
            recentGames: [],
            recentProjects: [],
            stats: { videos: 0, games: 0, projects: 0, users: 0 }
        })
    }
}
