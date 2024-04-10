"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getProjectLayersDataBaseOnAccess = exports.updateOtherCDataOfDeletedLayerCollaborators = exports.deleteCollaborators = exports.updateOtherCDataOfLayerModifiedCollaborators = exports.updateLayerCollaborators = exports.createOtherCDataOfLayerCreatedCollaborators = exports.newCollaborators = exports.verifyOneLevelAccessOfNewCollaborator = exports.validateCollaboratorAccessOnLayer = exports.validateLayerExistance = void 0;
const collaboratorSchema_1 = __importDefault(require("../models/collaboratorSchema"));
const layerSchema_1 = __importDefault(require("../models/layerSchema"));
const repoSchema_1 = __importDefault(require("../models/repoSchema"));
// ! Middlewares Helpers
const whatIsTheAccess = (accessLevel) => {
    switch (accessLevel) {
        case 'contributor':
            return {
                levels: ['open'],
            };
        case 'coordinator':
            return {
                levels: ['open', 'internal'],
            };
        case 'manager':
        case 'administrator':
            return {
                levels: ['open', 'internal', 'restricted'],
            };
        default:
            return { levels: [] };
    }
    ;
};
const appropiateLevelAccessOnRepo = (accessLevel) => {
    switch (accessLevel) {
        case 'contributor':
            return 'reader';
        case 'coordinator':
            return 'editor';
        case 'manager':
            return 'manager';
        case 'administrator':
            return 'administrator';
        default:
            return 'contributor';
    }
    ;
};
// ! Validations
const validateLayerExistance = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    const { layerID } = req.params;
    try {
        const layer = yield layerSchema_1.default.findById(layerID);
        if (!layer)
            return res.status(404).json({
                message: 'Layer not found'
            });
        req.layer = layer;
        next();
    }
    catch (error) {
        console.log('error2');
        res.status(500).json({
            message: 'Internal Server Error'
        });
    }
    ;
});
exports.validateLayerExistance = validateLayerExistance;
const validateCollaboratorAccessOnLayer = (minAccess) => {
    return (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
        const { project } = req;
        const { layerID } = req.params;
        const uid = req.query.uid;
        if (project.owner.toString() === uid) {
            return next();
        }
        const collaborator = yield collaboratorSchema_1.default.findOne({ uid, 'layer._id': layerID });
        if (!collaborator) {
            return res.status(400).json({
                message: 'You do not have access to this Layer'
            });
        }
        if (!minAccess.includes(collaborator.project.accessLevel)) {
            return res.status(400).json({
                message: 'You do not have the required access level to perform this action'
            });
        }
        next();
    });
};
exports.validateCollaboratorAccessOnLayer = validateCollaboratorAccessOnLayer;
const verifyOneLevelAccessOfNewCollaborator = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    const { project } = req;
    const { newCollaborators } = req.body;
    if (newCollaborators.length === 0) {
        return next();
    }
    yield Promise.all(newCollaborators.map((collaborator) => __awaiter(void 0, void 0, void 0, function* () {
        const { id, photoUrl, name } = collaborator;
        const prjCollaborator = yield collaboratorSchema_1.default.findOne({ uid: id, 'project._id': project._id });
        if (!prjCollaborator) {
            const c = new collaboratorSchema_1.default({ uid: id, name, photoUrl, project: { _id: project._id, accessLevel: 'contributor' } });
            yield c.save();
        }
    })));
    next();
});
exports.verifyOneLevelAccessOfNewCollaborator = verifyOneLevelAccessOfNewCollaborator;
// ! Creation / Updating
const newCollaborators = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    const { layerID } = req.params;
    const { newCollaborators } = req.body;
    if (newCollaborators.length === 0) {
        req.creatingMiddlewareState = false;
        return next();
    }
    let totalCreated = 0;
    try {
        const processCollaborator = (collaborator) => __awaiter(void 0, void 0, void 0, function* () {
            const { id, name, photoUrl, accessLevel } = collaborator;
            let existingCollaborator = yield collaboratorSchema_1.default.findOne({ uid: id, 'layer._id': layerID });
            if (existingCollaborator) {
                if (!existingCollaborator.state) {
                    yield collaboratorSchema_1.default.updateOne({ _id: existingCollaborator._id, 'layer._id': layerID }, { $set: { state: true, name: name, photoUrl: photoUrl, 'layer.accessLevel': accessLevel } });
                    totalCreated++;
                }
                // Si el colaborador existe y ya está activo, no aumentar totalCreated.
            }
            else {
                const c = new collaboratorSchema_1.default({ uid: id, name, photoUrl, layer: { _id: layerID, accessLevel }, state: true });
                yield c.save();
                totalCreated++;
            }
        });
        // Procesar cada colaborador con un intervalo entre ellos
        for (let i = 0; i < newCollaborators.length; i++) {
            yield processCollaborator(newCollaborators[i]);
            yield new Promise(resolve => setTimeout(resolve, 100)); // Esperar 100 ms antes de procesar el siguiente colaborador
        }
        req.totalCreatedCollaborators = totalCreated;
        req.creatingMiddlewareState = true;
        next();
    }
    catch (error) {
        res.status(400).json({
            message: 'Internal Server error',
            error
        });
    }
    ;
});
exports.newCollaborators = newCollaborators;
const createOtherCDataOfLayerCreatedCollaborators = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    const { projectID, layerID } = req.params;
    const { newCollaborators } = req.body;
    const { projectRepos } = req;
    if (newCollaborators.length === 0) {
        return next();
    }
    try {
        const repos = projectRepos.length !== 0
            ? projectRepos
            : yield repoSchema_1.default.find({ projectID: projectID, layerID, 'visibility': { $exists: true } });
        yield Promise.all(newCollaborators.map((collaborator) => __awaiter(void 0, void 0, void 0, function* () {
            const { id, name, photoUrl, accessLevel } = collaborator;
            const { levels } = whatIsTheAccess(accessLevel);
            // Asumiendo que `Layer` y `Repo` son los modelos de las capas y repositorios, respectivamente
            yield Promise.all(repos.map((repo) => __awaiter(void 0, void 0, void 0, function* () {
                // Crear el colaborador en el repositorio si tiene acceso
                let existingCollaborator = yield collaboratorSchema_1.default.findOne({ uid: id, projectID, 'repository._id': repo._id });
                if (existingCollaborator && !existingCollaborator.state) {
                    if (levels.includes(repo.visibility)) {
                        yield collaboratorSchema_1.default.updateOne({ uid: id, projectID, 'repository._id': repo._id }, { $set: { state: true, 'repository.accessLevel': appropiateLevelAccessOnRepo(accessLevel) } });
                    }
                }
                else {
                    if (levels.includes(repo.visibility)) {
                        const c = new collaboratorSchema_1.default({ uid: id, name, photoUrl, repository: { _id: repo._id, accessLevel: appropiateLevelAccessOnRepo(accessLevel) }, state: true, projectID });
                        yield c.save();
                    }
                }
                ;
            })));
        })));
        next();
    }
    catch (error) {
        console.log(error);
        res.status(400).json({
            message: 'Internal Server error',
            error
        });
    }
});
exports.createOtherCDataOfLayerCreatedCollaborators = createOtherCDataOfLayerCreatedCollaborators;
// ! Updating
const updateLayerCollaborators = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    const { layerID } = req.params;
    const { modifiedCollaborators } = req.body;
    if (modifiedCollaborators.length === 0) {
        req.updatingMiddlewareState = false;
        return next();
    }
    try {
        yield Promise.all(modifiedCollaborators.map((colab) => {
            const { id, accessLevel } = colab;
            return collaboratorSchema_1.default.findOneAndUpdate({ uid: id, 'layer._id': layerID }, { 'layer.accessLevel': accessLevel });
        }));
        // Este código no se ejecuta hasta que todas las promesas en el arreglo hayan sido resueltas
        req.updatingMiddlewareState = true;
        next();
    }
    catch (error) {
        res.status(400).json({
            message: 'Internal Server error',
            error
        });
    }
});
exports.updateLayerCollaborators = updateLayerCollaborators;
const updateOtherCDataOfLayerModifiedCollaborators = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    const { projectID, layerID } = req.params;
    const { modifiedCollaborators } = req.body;
    const { projectRepos } = req;
    if (modifiedCollaborators.length === 0) {
        return next();
    }
    try {
        const repos = projectRepos.length !== 0
            ? projectRepos
            : yield repoSchema_1.default.find({ projectID, layerID, 'visibility': { $exists: true } });
        yield Promise.all(modifiedCollaborators.map((collaborator) => __awaiter(void 0, void 0, void 0, function* () {
            const { levels } = whatIsTheAccess(collaborator.accessLevel);
            // Asumiendo que `Layer` y `Repo` son los modelos de las capas y repositorios, respectivamente
            yield Promise.all(repos.map((repo) => __awaiter(void 0, void 0, void 0, function* () {
                const existingCollaborator = yield collaboratorSchema_1.default.findOne({ 'repository._id': repo._id, uid: collaborator.id });
                if (!levels.includes(repo.visibility)) {
                    if (existingCollaborator) {
                        // El colaborador ya no debería tener acceso, actualiza el estado a false
                        yield collaboratorSchema_1.default.updateOne({ _id: existingCollaborator._id }, { $set: { state: false } });
                    }
                    // No hacer nada si no existe porque el colaborador no debería tener acceso
                }
                else {
                    if (existingCollaborator) {
                        // El colaborador debería tener acceso y ya existe, actualiza el estado a true y el nivel de acceso
                        yield collaboratorSchema_1.default.updateOne({ _id: existingCollaborator._id }, { $set: { state: true, 'repository.accessLevel': appropiateLevelAccessOnRepo(collaborator.accessLevel) } });
                    }
                    else {
                        // El colaborador debería tener acceso pero no existe un documento, créalo
                        const newCollaborator = new collaboratorSchema_1.default({
                            repository: { _id: repo._id, accessLevel: appropiateLevelAccessOnRepo(collaborator.accessLevel) },
                            uid: collaborator.id,
                            name: collaborator.name,
                            photoUrl: collaborator.photoUrl || null,
                            state: true // Asumiendo que quieres que el estado sea true por defecto
                            // Añade otros campos requeridos según tu esquema de colaborador
                        });
                        yield newCollaborator.save();
                    }
                }
            })));
        })));
        req.projectRepos = repos;
        next();
    }
    catch (error) {
        console.log(error);
        res.status(400).json({
            message: 'Internal Server error',
            error
        });
    }
});
exports.updateOtherCDataOfLayerModifiedCollaborators = updateOtherCDataOfLayerModifiedCollaborators;
// ! Deletion
const deleteCollaborators = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    const { layerID } = req.params;
    const { deletedCollaborators } = req.body;
    if (deletedCollaborators.length === 0) {
        req.totalDeletedCollaborators = 0;
        req.deletingMiddlewareState = false;
        return next();
    }
    try {
        // Ejecutar todas las operaciones de actualización y capturar los resultados
        const results = yield Promise.all(deletedCollaborators.map(id => {
            return collaboratorSchema_1.default.updateMany({ uid: id, 'layer._id': layerID }, { $set: { state: false } });
        }));
        const totalModified = results.reduce((acc, result) => acc + result.modifiedCount, 0);
        // Almacenar el total de colaboradores eliminados en el objeto de solicitud para su uso posterior
        req.totalDeletedCollaborators = totalModified;
        req.deletingMiddlewareState = true;
        next();
    }
    catch (error) {
        res.status(400).json({
            message: 'Internal Server error',
            error
        });
    }
});
exports.deleteCollaborators = deleteCollaborators;
const updateOtherCDataOfDeletedLayerCollaborators = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    const { projectID, layerID } = req.params;
    const { deletedCollaborators } = req.body;
    if (deletedCollaborators.length === 0) {
        req.projectRepos = [];
        return next();
    }
    try {
        yield Promise.all(deletedCollaborators.map((id) => __awaiter(void 0, void 0, void 0, function* () {
            const collaborators = yield collaboratorSchema_1.default.find({ uid: id, projectID, 'repository._id': { $exists: true } })
                .lean()
                .populate({
                path: 'repository._id',
                populate: { path: 'layerID' }
            });
            yield Promise.all(collaborators.map(collaborator => {
                const _a = collaborator.repository._id, { layerID: layer } = _a, rest = __rest(_a, ["layerID"]);
                if (layer._id.toString() === layerID && collaborator.state === true) {
                    console.log('Colaborador eliminado en repositorio:', rest);
                    return collaboratorSchema_1.default.updateOne({ uid: id, projectID, 'repository._id': collaborator.repository._id }, { $set: { state: false } });
                }
            }));
        })));
        next();
    }
    catch (error) {
        console.log(error);
        res.status(400).json({
            message: 'Internal Server error',
            error
        });
    }
});
exports.updateOtherCDataOfDeletedLayerCollaborators = updateOtherCDataOfDeletedLayerCollaborators;
// ! Collaborator Propper Data Return based on access level
const getProjectLayersDataBaseOnAccess = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    const { projectID } = req.params;
    const uid = req.user._id;
    const { owner, levels, type } = req;
    if (owner && owner === true) {
        return next();
    }
    try {
        if (type === 'collaborator') {
            const collaboratorOnLayers = yield collaboratorSchema_1.default.find({ projectID, uid, state: true, 'layer._id': { $exists: true } })
                .populate('layer._id')
                .lean();
            const layersBaseOnLevel = collaboratorOnLayers.map((collaborator) => {
                const _a = collaborator.layer, _b = _a._id, { gitlabId } = _b, rest = __rest(_b, ["gitlabId"]), { accessLevel } = _a;
                return Object.assign(Object.assign({}, rest), { accessLevel });
            });
            const openLayers = yield layerSchema_1.default.find({ project: projectID, visibility: 'open' })
                .lean();
            // Paso 4: Filtrar capas 'open' para excluir las ya incluidas en layersBaseOnLevel y asignarles 'guest' como nivel de acceso.
            const uniqueOpenLayersWithGuestAccess = openLayers.filter(openLayer => !layersBaseOnLevel.some(layer => layer._id.toString() === openLayer._id.toString())).map(layer => {
                const { gitlabId, __v } = layer, rest = __rest(layer, ["gitlabId", "__v"]);
                return Object.assign(Object.assign({}, rest), { accessLevel: 'guest' });
            });
            // Combinar los dos conjuntos de capas y devolverlos.
            req.layers = [...layersBaseOnLevel, ...uniqueOpenLayersWithGuestAccess];
            return next();
        }
        else {
            const layers = yield layerSchema_1.default.find({ project: projectID, visibility: { $in: levels } })
                .lean();
            const layersWithGuestAccess = layers.map(layer => {
                const { gitlabId, __v } = layer, rest = __rest(layer, ["gitlabId", "__v"]);
                return Object.assign(Object.assign({}, rest), { accessLevel: 'guest' });
            });
            req.layers = layersWithGuestAccess;
            return next();
        }
        ;
    }
    catch (error) {
        console.log(error);
        res.status(400).json({
            message: 'Internal Server error',
            error
        });
    }
});
exports.getProjectLayersDataBaseOnAccess = getProjectLayersDataBaseOnAccess;
//# sourceMappingURL=layer-middlewares.js.map