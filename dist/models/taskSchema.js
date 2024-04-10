"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
const mongoose_1 = require("mongoose");
const TaskSchema = new mongoose_1.Schema({
    type: {
        type: String,
        enum: ['open', 'assigned'],
        required: true
    },
    layer_number_task: {
        type: String, required: true
    },
    task_name: {
        type: String, required: true
    },
    task_description: {
        type: String, required: true
    },
    project: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'Project',
    },
    layer_related_id: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'Layer',
    },
    repository_related_id: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'Repo'
    },
    goals: [{ type: String }],
    commits_hashes: [{
            type: String
        }],
    status: {
        type: String,
        required: true,
        enum: ['pending', 'approval', 'completed'],
        default: 'completed'
    },
    priority: {
        type: String,
        enum: ['Low', 'Medium', 'High', 'Critical'],
        required: true
    },
    conclusion_date: { type: Date },
    deadline: {
        type: Date,
        default: null
    },
    additional_info: {
        estimated_hours: { type: Number },
        actual_hours: { type: Number },
        notes: [{ type: String }],
    },
    assigned_to: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'User',
        default: null
    },
    contributorsIds: [{
            type: String
        }],
}, { timestamps: true });
TaskSchema.methods.toJSON = function () {
    const _a = this.toObject(), { __v } = _a, task = __rest(_a, ["__v"]);
    return task;
};
const Task = (0, mongoose_1.model)('Task', TaskSchema);
exports.default = Task;
//# sourceMappingURL=taskSchema.js.map