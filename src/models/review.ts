import mongoose, { Schema } from "mongoose";

const schema = new Schema({
    rating: {
        type: Number,
        required:[true, "Please give a rating"],
        min: [1, "Rating must be at least 1"],
        max: [5, "Rating must be at most 5"],
    },
    comment: {
        type: String,
    },
    user: {
        type: String,
        ref: "User",
        required: true,
    },
    product: {
        type: Schema.Types.ObjectId,
        ref: "Product",
        required: true,
    },
}, { timestamps: true });

export const Review = mongoose.model("Review", schema);