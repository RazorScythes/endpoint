const Groups             = require('../models/grouplist.model')
const Video              = require('../models/video.model')
const mongoose           = require('mongoose');

const getGroupsWithVideoCounts = async (type, userId) => {
    const groups = await Groups.find({ type, user: userId }).lean();

    const groupIds = groups.map(group => group._id);

    const videoCounts = await Video.aggregate([
        { $match: { groups: { $in: groupIds } } },
        { $group: { _id: "$groups", count: { $sum: 1 } } }
    ]);

    const videoCountMap = videoCounts.reduce((acc, vc) => {
        acc[vc._id] = vc.count;
        return acc;
    }, {});

    return groups.map(group => ({
        ...group,
        items: videoCountMap[group._id] || 0
    }));
};

exports.getGroups = async (req, res) => {
    const { user } = req.token;
    const { type } = req.params;

    if (!type) {
        return res.status(403).json({ alert: {
            variant: 'danger', 
            message: 'invalid parameter' 
        } });
    }

    try {
        const groups = await getGroupsWithVideoCounts(type, user._id)

        res.status(200).json({ result: groups });
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

exports.newGroups = async (req, res) => {
    const { user } = req.token;
    const { data } = req.body

    try {
        const newGroups = new Groups(data)

        await newGroups.save()

        const groups = await getGroupsWithVideoCounts(data.type, user._id)
        return res.status(200).json({ 
            result: groups,
            alert: {
                variant: "success",
                heading: "",
                message: "Group added"
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

exports.updateGroups = async (req, res) => {
    const { user } = req.token;
    const { data } = req.body

    try {
        await Groups.findByIdAndUpdate(data.id, data, { new: true })

        const groups = await getGroupsWithVideoCounts(data.type, user._id)

        return res.status(200).json({ 
            result: groups,
            alert: {
                variant: "info",
                heading: "",
                message: "Group updated"
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

exports.deleteGroups = async (req, res) => {
    const { user } = req.token;
    const { id, type } = req.params

    try {
        if (!type) {
            return res.status(403).json({ alert: {
                variant: 'danger', 
                message: 'invalid parameter' 
            } });
        }

        await Groups.findByIdAndDelete(id)

        const groups = await getGroupsWithVideoCounts(type, user._id)

        return res.status(200).json({ 
            result: groups,
            alert: {
                variant: "warning",
                heading: "",
                message: "Group deleted"
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

exports.deleteMultipleGroups = async (req, res) => {
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

        await Groups.deleteMany({ _id: { $in: objectIdsToDelete } })

        const groups = await getGroupsWithVideoCounts(type, user._id)

        return res.status(200).json({ 
            result: groups,
            alert: {
                variant: "warning",
                heading: "",
                message: "Groups deleted"
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