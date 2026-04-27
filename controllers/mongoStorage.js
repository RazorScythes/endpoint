const mongoose = require('mongoose')

const parseConnectionInfo = () => {
    const uri = process.env.MONGODB_URI || ''
    try {
        const parsed = new URL(uri)
        return {
            host: parsed.hostname,
            protocol: parsed.protocol.replace(':', ''),
            port: parsed.port || (parsed.protocol === 'mongodb+srv:' ? 'SRV' : '27017'),
            user: parsed.username || '—',
            defaultDb: parsed.pathname?.replace('/', '') || '—',
            replicaSet: parsed.searchParams.get('replicaSet') || null,
            ssl: parsed.protocol === 'mongodb+srv:' || parsed.searchParams.get('ssl') === 'true',
        }
    } catch {
        return { host: '—', protocol: '—', port: '—', user: '—', defaultDb: '—', replicaSet: null, ssl: false }
    }
}

exports.getDbStats = async (req, res) => {
    try {
        const adminDb = mongoose.connection.db.admin()
        const dbListResult = await adminDb.listDatabases()

        const storageLimitMB = parseInt(process.env.MONGO_STORAGE_LIMIT_MB || '512', 10)
        const storageLimit = storageLimitMB * 1024 * 1024

        const connectionInfo = parseConnectionInfo()

        let serverInfo = {}
        try {
            const info = await adminDb.serverInfo()
            serverInfo = { version: info.version || '—' }
        } catch {
            serverInfo = { version: '—' }
        }

        const databases = await Promise.all(
            dbListResult.databases.map(async (dbInfo) => {
                let collections = 0
                try {
                    const db = mongoose.connection.client.db(dbInfo.name)
                    const cols = await db.listCollections({}, { nameOnly: true }).toArray()
                    collections = cols.length
                } catch { /* leave 0 */ }

                return {
                    name: dbInfo.name,
                    sizeOnDisk: dbInfo.sizeOnDisk || 0,
                    empty: dbInfo.empty || false,
                    collections,
                }
            })
        )

        const systemDbs = new Set(['local', 'admin', 'config'])

        databases.forEach(d => { d.isSystem = systemDbs.has(d.name) })
        databases.sort((a, b) => (a.isSystem === b.isSystem ? b.sizeOnDisk - a.sizeOnDisk : a.isSystem ? 1 : -1))

        const clusterTotalSize = databases
            .filter(d => !d.isSystem)
            .reduce((s, d) => s + d.sizeOnDisk, 0)

        const remaining = Math.max(0, storageLimit - clusterTotalSize)
        const usagePercent = storageLimit > 0
            ? Math.min(100, Math.round((clusterTotalSize / storageLimit) * 1000) / 10)
            : 0

        res.json({
            result: {
                clusterTotalSize,
                storageLimit,
                remaining,
                usagePercent,
                databaseCount: databases.length,
                totalCollections: databases.reduce((s, d) => s + d.collections, 0),
                connection: connectionInfo,
                server: serverInfo,
                databases,
            }
        })
    } catch (err) {
        res.status(500).json({ alert: { message: err.message, variant: 'danger' } })
    }
}

exports.getCollectionStats = async (req, res) => {
    try {
        const dbName = req.query.db
        const db = dbName
            ? mongoose.connection.client.db(dbName)
            : mongoose.connection.db

        const colList = await db.listCollections().toArray()

        const results = await Promise.all(
            colList.map(async (col) => {
                const coll = db.collection(col.name)
                try {
                    const [countResult, statsResult] = await Promise.all([
                        coll.estimatedDocumentCount(),
                        coll.aggregate([{ $collStats: { storageStats: {} } }]).toArray()
                            .catch(() => db.command({ collStats: col.name }).then(s => [{ storageStats: s }]))
                            .catch(() => [{}])
                    ])

                    const s = statsResult[0]?.storageStats || {}
                    const size = s.size || 0
                    const storageSize = s.storageSize || 0
                    const indexSize = s.totalIndexSize || 0

                    return {
                        name: col.name,
                        count: countResult,
                        size,
                        storageSize,
                        indexSize,
                        totalSize: storageSize + indexSize,
                        avgObjSize: countResult > 0 ? Math.round(size / countResult) : 0,
                        indexes: s.nindexes || 0,
                    }
                } catch {
                    return {
                        name: col.name, count: 0, size: 0, storageSize: 0,
                        indexSize: 0, totalSize: 0, avgObjSize: 0, indexes: 0,
                    }
                }
            })
        )

        results.sort((a, b) => b.totalSize - a.totalSize)
        res.json({ result: results })
    } catch (err) {
        res.status(500).json({ alert: { message: err.message, variant: 'danger' } })
    }
}

exports.createDatabase = async (req, res) => {
    try {
        const { name } = req.body
        if (!name || !/^[a-zA-Z0-9_-]+$/.test(name)) {
            return res.status(400).json({ alert: { message: 'Invalid database name. Use only letters, numbers, hyphens, and underscores.', variant: 'danger' } })
        }

        const existing = await mongoose.connection.db.admin().listDatabases()
        if (existing.databases.some(d => d.name === name)) {
            return res.status(409).json({ alert: { message: `Database "${name}" already exists`, variant: 'danger' } })
        }

        const db = mongoose.connection.client.db(name)
        await db.createCollection('_init')

        res.json({ alert: { message: `Database "${name}" created successfully`, variant: 'success' } })
    } catch (err) {
        res.status(500).json({ alert: { message: err.message, variant: 'danger' } })
    }
}

exports.getDocuments = async (req, res) => {
    try {
        const { db: dbName, collection: colName, page = 1, limit = 20 } = req.query
        if (!colName) return res.status(400).json({ alert: { message: 'Collection name required', variant: 'danger' } })

        const db = dbName
            ? mongoose.connection.client.db(dbName)
            : mongoose.connection.db

        const coll = db.collection(colName)
        const skip = (Math.max(1, parseInt(page)) - 1) * parseInt(limit)
        const lim = Math.min(100, Math.max(1, parseInt(limit)))

        const [docs, totalCount] = await Promise.all([
            coll.find({}).sort({ _id: -1 }).skip(skip).limit(lim).toArray(),
            coll.estimatedDocumentCount()
        ])

        res.json({
            result: {
                documents: docs,
                total: totalCount,
                page: parseInt(page),
                limit: lim,
                totalPages: Math.ceil(totalCount / lim),
            }
        })
    } catch (err) {
        res.status(500).json({ alert: { message: err.message, variant: 'danger' } })
    }
}
