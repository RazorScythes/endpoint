const mongoose = require('mongoose')
const Schema = mongoose.Schema

const tileRuleSchema = new Schema({
    tile: { type: Number },
    chance: { type: Number },
    requiresNoAdj: { type: Boolean, default: false }
}, { _id: false })

const categoryDefSchema = new Schema({
    id: { type: String },
    label: { type: String },
    color: { type: String, default: '#6b7280' },
    description: { type: String, default: '' }
}, { _id: false })

const structureDefSchema = new Schema({
    id: { type: String },
    label: { type: String },
    category: { type: String },
    minW: { type: Number },
    maxW: { type: Number },
    minH: { type: Number },
    maxH: { type: Number },
    count: { type: Number },
    biomes: [{ type: String }],
    floorType: { type: String },
    lootCount: { type: Number },
    lootTable: { type: String },
    lootTier: { type: Number, default: 1 },
    spawnRate: { type: Number, default: 50 },
    mapDefinitionId: { type: Schema.Types.ObjectId, ref: 'MapDefinition', default: null }
}, { _id: false })

const biomeDefSchema = new Schema({
    id: { type: String },
    label: { type: String },
    color: { type: String },
    defaultTile: { type: Number },
    tileRules: [tileRuleSchema],
    spawnRate: { type: Number, default: 50 },
    mapDefinitionId: { type: Schema.Types.ObjectId, ref: 'MapDefinition', default: null }
}, { _id: false })

const spriteAssetSchema = new Schema({
    id: { type: String },
    name: { type: String },
    url: { type: String },
    folder: { type: String, default: '' }
}, { _id: false })

const spriteFolderSchema = new Schema({
    id: { type: String },
    name: { type: String },
    color: { type: String, default: '#6b7280' }
}, { _id: false })

const editorSpriteSchema = new Schema({
    id: { type: String },
    sprite: { type: String },
    x: { type: Number },
    y: { type: Number },
    width: { type: Number },
    height: { type: Number },
    rotation: { type: Number, default: 0 },
    spawnRate: { type: Number, default: 100 },
    zIndex: { type: Number, default: 0 },
    objectType: { type: String },
    label: { type: String },
    structureData: { type: Schema.Types.Mixed },
    biomeData: { type: Schema.Types.Mixed }
}, { _id: false })

const schema = Schema({
    user: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    title: { type: String, required: true },
    category: { type: String, default: 'structure' },
    featured_image: { type: String, default: '' },
    data: {
        structures: [structureDefSchema],
        biomes: [biomeDefSchema],
        categories: [categoryDefSchema],
        editorObjects: [editorSpriteSchema],
        sprites: [spriteAssetSchema],
        folders: [spriteFolderSchema]
    },
    privacy: { type: Boolean, default: false },
    strict: { type: Boolean, default: false },
    version: { type: String, default: '1.0.0' },
    platform: { type: String, default: 'Desktop' },
    deleted_at: { type: Date, default: null }
}, { timestamps: true })

const model = mongoose.model('MapDefinition', schema)

module.exports = model
