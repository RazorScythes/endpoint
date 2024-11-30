const mongoose      = require('mongoose')
const Schema        = mongoose.Schema

const videoSchema = new Schema({
    user: {
        type: Schema.Types.ObjectId,
        ref:'User'
    },
    groups: {
        type: Schema.Types.ObjectId,
        ref:'Groups'
    },
    thumbnail: { type: String },
    owner: { type: Array },
    link: { type: String },
    title: { type: String },
    likes: { type: [String] },
    tags: { type: Array },
    dislikes: { type: [String] },
    views: { type: Array },
    comment: { type: Array },
    strict: { type: Boolean },
    privacy: { type: Boolean },
    access_key: { type: String },
    downloadable: { type: Boolean },
    related_videos: { type: Array },
    fileSize: { type: String },
    alternateLink: { type: String },
    downloadUrl: { type: String },
    embedLink: { type: String },
    fileExtension: { type: String },
    webContentLink: { type: String },
    thumbnailLink: { type: String },
    ownerNames: { type: Array },
    duration: { type: String },
    category: { type: Array }
},{
    timestamps: true,
    collection: "video"
})

const Video = mongoose.model('Video', videoSchema)

module.exports = Video