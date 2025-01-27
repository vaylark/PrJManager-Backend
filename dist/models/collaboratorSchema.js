"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = require("mongoose");
const collaboratorSchema = new mongoose_1.Schema({
    repository: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'Repo',
        required: true
    },
    user: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    accessLevel: {
        type: String,
        enum: ['Editor', 'Reader', 'Admin', 'Owner'],
        required: true
    }
});
exports.default = (0, mongoose_1.model)('Collaborator', collaboratorSchema);
//# sourceMappingURL=collaboratorSchema.js.map