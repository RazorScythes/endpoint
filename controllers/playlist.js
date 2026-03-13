const Playlist          = require('../models/playlist.model')
const mongoose          = require('mongoose')
const { logActivity }   = require('../plugins/logger')

const populateVideos = {
    path: 'videos',
    select: '_id thumbnail title duration views downloadUrl owner category tags createdAt'
}

exports.getPlaylists = async (req, res) => {
    const { user } = req.token

    try {
        const playlists = await Playlist.find({ user: user._id })
            .sort({ createdAt: -1 })
            .populate(populateVideos)

        res.status(200).json({ result: playlists })
    } catch (err) {
        console.log(err)
        return res.status(500).json({
            alert: { variant: 'danger', message: 'internal server error' }
        })
    }
}

exports.getPlaylistById = async (req, res) => {
    const { id } = req.params

    try {
        const playlist = await Playlist.findById(id)
            .populate(populateVideos)
            .populate('user', 'username avatar')

        if (!playlist) {
            return res.status(404).json({
                alert: { variant: 'danger', message: 'Playlist not found' }
            })
        }

        res.status(200).json({ result: playlist })
    } catch (err) {
        console.log(err)
        return res.status(500).json({
            alert: { variant: 'danger', message: 'internal server error' }
        })
    }
}

exports.createPlaylist = async (req, res) => {
    const { user } = req.token
    const { name, description, videoId } = req.body

    try {
        if (!name?.trim()) {
            return res.status(400).json({
                alert: { variant: 'danger', message: 'Playlist name is required' }
            })
        }

        const existing = await Playlist.findOne({
            user: user._id,
            name: { $regex: new RegExp(`^${name.trim()}$`, 'i') }
        })

        if (existing) {
            return res.status(400).json({
                alert: { variant: 'danger', message: 'A playlist with this name already exists' }
            })
        }

        const playlistData = {
            user: user._id,
            name: name.trim(),
            description: description || '',
            videos: videoId ? [videoId] : []
        }

        const newPlaylist = new Playlist(playlistData)
        await newPlaylist.save()

        const playlists = await Playlist.find({ user: user._id })
            .sort({ createdAt: -1 })
            .populate(populateVideos)

        logActivity(req, {
            action: 'create_playlist',
            category: 'account',
            message: `Playlist created: "${name.trim()}"`
        })

        res.status(200).json({
            result: playlists,
            alert: { variant: 'success', message: 'Playlist created' }
        })
    } catch (err) {
        console.log(err)
        return res.status(500).json({
            alert: { variant: 'danger', message: 'internal server error' }
        })
    }
}

exports.updatePlaylist = async (req, res) => {
    const { user } = req.token
    const { id, name, description, privacy } = req.body

    try {
        const playlist = await Playlist.findOne({ _id: id, user: user._id })

        if (!playlist) {
            return res.status(404).json({
                alert: { variant: 'danger', message: 'Playlist not found' }
            })
        }

        if (name !== undefined) playlist.name = name.trim()
        if (description !== undefined) playlist.description = description
        if (privacy !== undefined) playlist.privacy = privacy

        await playlist.save()

        const playlists = await Playlist.find({ user: user._id })
            .sort({ createdAt: -1 })
            .populate(populateVideos)

        logActivity(req, {
            action: 'update_playlist',
            category: 'account',
            message: `Playlist updated: "${playlist.name}"`
        })

        res.status(200).json({
            result: playlists,
            alert: { variant: 'info', message: 'Playlist updated' }
        })
    } catch (err) {
        console.log(err)
        return res.status(500).json({
            alert: { variant: 'danger', message: 'internal server error' }
        })
    }
}

exports.deletePlaylist = async (req, res) => {
    const { user } = req.token
    const { id } = req.params

    try {
        const playlist = await Playlist.findOneAndDelete({ _id: id, user: user._id })

        if (!playlist) {
            return res.status(404).json({
                alert: { variant: 'danger', message: 'Playlist not found' }
            })
        }

        const playlists = await Playlist.find({ user: user._id })
            .sort({ createdAt: -1 })
            .populate(populateVideos)

        logActivity(req, {
            action: 'delete_playlist',
            category: 'account',
            message: `Playlist deleted: "${playlist.name}"`
        })

        res.status(200).json({
            result: playlists,
            alert: { variant: 'warning', message: 'Playlist deleted' }
        })
    } catch (err) {
        console.log(err)
        return res.status(500).json({
            alert: { variant: 'danger', message: 'internal server error' }
        })
    }
}

exports.toggleVideo = async (req, res) => {
    const { user } = req.token
    const { playlistId, videoId } = req.body

    try {
        const playlist = await Playlist.findOne({ _id: playlistId, user: user._id })

        if (!playlist) {
            return res.status(404).json({
                alert: { variant: 'danger', message: 'Playlist not found' }
            })
        }

        const videoObjectId = new mongoose.Types.ObjectId(videoId)
        const videoIndex = playlist.videos.findIndex(v => v.equals(videoObjectId))

        let action
        if (videoIndex > -1) {
            playlist.videos.splice(videoIndex, 1)
            action = 'removed from'
        } else {
            playlist.videos.push(videoObjectId)
            action = 'added to'
        }

        await playlist.save()

        const playlists = await Playlist.find({ user: user._id })
            .sort({ createdAt: -1 })
            .populate(populateVideos)

        res.status(200).json({
            result: playlists,
            alert: { variant: 'info', message: `Video ${action} "${playlist.name}"` }
        })
    } catch (err) {
        console.log(err)
        return res.status(500).json({
            alert: { variant: 'danger', message: 'internal server error' }
        })
    }
}

exports.removeVideoFromPlaylist = async (req, res) => {
    const { user } = req.token
    const { playlistId, videoId } = req.body

    try {
        const playlist = await Playlist.findOne({ _id: playlistId, user: user._id })

        if (!playlist) {
            return res.status(404).json({
                alert: { variant: 'danger', message: 'Playlist not found' }
            })
        }

        const videoObjectId = new mongoose.Types.ObjectId(videoId)
        playlist.videos = playlist.videos.filter(v => !v.equals(videoObjectId))

        await playlist.save()

        const playlists = await Playlist.find({ user: user._id })
            .sort({ createdAt: -1 })
            .populate(populateVideos)

        res.status(200).json({
            result: playlists,
            alert: { variant: 'warning', message: 'Video removed from playlist' }
        })
    } catch (err) {
        console.log(err)
        return res.status(500).json({
            alert: { variant: 'danger', message: 'internal server error' }
        })
    }
}
