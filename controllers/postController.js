const asyncHandler = require("express-async-handler");
const Post = require("../models/post");
const Comments = require("../models/comment");
const User = require("../models/user");

exports.allPosts_get = asyncHandler(async (req, res, next) => {
	// get all posts
	const posts = await Post.find({}, { comments: 0 })
		.populate({
			path: "posted_by",
			select: "username",
		})
		.exec();

	if (posts) {
		res.json(posts);
	} else {
		res.sendStatus(403);
	}
});

exports.post_get = asyncHandler(async (req, res, next) => {
	// get a post
	return res.send("Not implemented");
});

exports.createPost_post = asyncHandler(async (req, res, next) => {
	// create a post
	return res.send("Not implemented");
});

exports.createComment_post = asyncHandler(async (req, res, next) => {
	// create a comment
	return res.send("Not implemented");
});

exports.editPost_put = asyncHandler(async (req, res, next) => {
	// edit a post
	return res.send("Not implemented");
});

exports.removePost_remove = asyncHandler(async (req, res, next) => {
	// remove a post and comments within the post
	return res.send("Not implemented");
});

exports.removeComment_remove = asyncHandler(async (req, res, next) => {
	// remove a comment
	return res.send("Not implemented");
});
