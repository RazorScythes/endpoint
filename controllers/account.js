const Groups             = require('../models/grouplist.model')
const Video              = require('../models/video.model')

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
    const { id, type } = req.params;

    if (!type || !id) {
        return res.status(403).json({ alert: {
            variant: 'danger', 
            message: 'invalid parameter' 
        } });
    }

    try {
        const groups = await getGroupsWithVideoCounts(type, id)

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
    const { id, data } = req.body

    try {
        const newGroups = new Groups(data)

        await newGroups.save()

        const groups = await getGroupsWithVideoCounts(data.type, id)
        return res.status(200).json({ 
            result: groups,
            alert: {
                variant: "success",
                heading: "Group added",
                paragraph: ""
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
    const { id, data } = req.body

    try {
        if (!id) {
            return res.status(403).json({ alert: {
                variant: 'danger', 
                message: 'unauthorized' 
            } });
        }

        await Groups.findByIdAndUpdate(data.id, data, { new: true })

        const groups = await getGroupsWithVideoCounts(data.type, id)

        return res.status(200).json({ 
            result: groups,
            alert: {
                variant: "success",
                heading: "Group updated",
                paragraph: ""
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