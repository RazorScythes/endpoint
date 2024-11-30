const Video              = require('../models/video.model')

const videoSettings = (type, value) => {
    if(type === 'strict') return { label: 'Strict mode', data: { strict: value } };
    else if(type === 'privacy') return { label: 'Visibility', data: { privacy: value } };
    else if(type === 'downloadable') return { label: 'Downloadable', data: { downloadable: value } };
    else return {};
}

exports.getUserVideos = async (req, res) => {
    const { user } = req.token;

    try {
        const videos = await Video.find({ user: user._id }).sort({ createdAt: -1 }).populate('groups')

        res.status(200).json({ result: videos });
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

exports.newVideo = async (req, res) => {
    const { user } = req.token;
    const { data } = req.body;

    const existing = await Video.find({ link: data.link })

    if(!existing.length) {
        const newVideo = new Video({ user: user._id, ...data })

        await newVideo.save()

        const video = await Video.find({ user: user._id }).sort({ createdAt: -1 }).populate('groups')
    
        res.status(200).json({ 
            result: video,
            alert: {
                variant: 'success', 
                message: 'Video uploaded successfully' 
            }
        });
    }
    else {
        const video = await Video.find({ user: user._id }).sort({ createdAt: -1 }).populate('groups')
    
        res.status(200).json({ 
            result: video,
            alert: {
                variant: 'danger', 
                message: 'Video already exists' 
            }
        });
    }
}

exports.updateVideoSettings = async (req, res) => {
    const { id, type, value } = req.body

    try {    
        const settings = videoSettings(type, value)

        if(!settings) {
            return res.status(403).json({ alert: {
                variant: 'danger', 
                message: 'invalid parameter' 
            } });
        }
        
        const result = await Video.findByIdAndUpdate(id, settings.data, { new: true }).populate('groups')

        res.status(200).json({ 
            result,
            alert: {
                variant: 'success', 
                message: `${settings.label} updated`
            }
        });
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
