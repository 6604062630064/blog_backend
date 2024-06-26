const asyncHandler = require("express-async-handler");
const Post = require("../models/post");
const Comment = require("../models/comment");
const User = require("../models/user");
const jwt = require("jsonwebtoken");
const { validationResult, body, param } = require("express-validator");
const mongoose = require("mongoose");
exports.allPosts_get = asyncHandler(async (req, res, next) => {
	// get all posts
	const posts = await Post.find({}, { comments: 0, body: 0 })
		.sort({ created: -1 })
		.populate({
			path: "posted_by",
			select: "username",
		})
		.exec();

	if (posts) {
		res.json(posts);
	} else {
		res.sendStatus(404);
	}
});

exports.post_get = asyncHandler(async (req, res, next) => {
	// get a post
	const post = await Post.find({ title: req.params.postId.replace(/-/g, " ") })
		.populate({
			path: "comments",
			populate: {
				path: "posted_by",
				select: "username",
			},
		})
		.populate({
			path: "posted_by",
			select: "username",
		})
		.exec();

	// check if array is empty
	if (post.length) {
		res.json(post);
	} else {
		res.sendStatus(404);
	}
});

exports.createPost_post = [
	body("title")
		.escape()
		.isLength({ min: 1, max: 60 })
		.withMessage("Invalid title length"),
	body("body")
		.escape()
		.isLength({ max: 1000 })
		.withMessage("Invalid body length"),
	asyncHandler(async (req, res, next) => {
		// create a post
		const result = validationResult(req);
		const requestedToken = req.token;

		if (!requestedToken) {
			// if token is null, it goes here
			return res.sendStatus(401);
		}

		jwt.verify(
			requestedToken,
			process.env.PRIVATE_KEY,
			async (err, decodedUser) => {
				if (err) {
					// in case of invalid syntax
					return res.sendStatus(401);
				}

				if (decodedUser.role === "admin") {
					// user has admin rights
					if (!result.isEmpty()) {
						return res.json(result.array());
					}

					const post = new Post({
						title: req.body.title,
						body: req.body.body,
						comments: [],
						posted_by: decodedUser._id,
						created: new Date(),
					});
					try {
						const savedPost = await post.save();

						if (savedPost) {
							res.json(savedPost);
						} else {
							// If it fails to upload to database
							res.sendStatus(500);
						}
					} catch (err) {
						return res.sendStatus(500);
					}
				} else {
					// user doesn't have admin rights
					res.status(401).send("Posting is only reserved for admins");
				}
			}
		);
	}),
];

exports.createComment_post = [
	param("postId")
		.escape()
		.custom(async (v, { req }) => {
			const post = await Post.findOne({ title: v.replace(/-/g, " ") }).exec();
			if (!post) {
				// post not found
				throw new Error("Post not found");
			}
		}),
	body("content").isLength({ min: 1, max: 500 }).withMessage("Invalid length"),
	asyncHandler(async (req, res, next) => {
		// create a comment
		const result = validationResult(req);

		if (!result.isEmpty()) {
			return res.json(result.array({ onlyFirstError: true }));
		}

		const postId = req.params.postId.replace(/-/g, " ");
		const requestedToken = req.token;

		if (!requestedToken) {
			// if token is null, it goes here
			return res.sendStatus(401);
		}

		jwt.verify(
			requestedToken,
			process.env.PRIVATE_KEY,
			async (err, decodedUser) => {
				if (err) {
					// invalid syntax
					return res.sendStatus(401);
				}

				const comment = new Comment({
					content: req.body.content,
					posted_by: decodedUser._id,
					created: new Date(),
				});

				const savedComment = await comment.save();

				if (!savedComment) {
					// in case of a failed upload to database
					return res.sendStatus(500);
				}

				const post = await Post.findOneAndUpdate(
					{ title: postId },
					{ $push: { comments: { $each: [savedComment._id], $position: 0 } } },
					{ new: true }
				).exec();

				if (post) {
					res.json(post);
				} else {
					res.sendStatus(500);
				}
			}
		);
	}),
];

exports.editPost_put = [
	param("postId")
		.escape()
		.custom(async (v) => {
			const post = await Post.findOne({ title: v.replace(/-/g, " ") }).exec();
			if (!post) {
				// post not found
				throw new Error("Post not found");
			}
		}),
	body("title")
		.escape()
		.isLength({ min: 1, max: 60 })
		.withMessage("Invalid title length"),
	body("body")
		.escape()
		.isLength({ min: 1, max: 1000 })
		.withMessage("Invalid body length"),
	asyncHandler(async (req, res, next) => {
		// edit a post
		const result = validationResult(req);

		if (!result.isEmpty()) {
			return res.json(result.array());
		}

		const postId = req.params.postId.replace(/-/g, " ");
		const requestedToken = req.token;

		if (!requestedToken) {
			// if token is null, it goes here
			return res.sendStatus(401);
		}

		jwt.verify(
			requestedToken,
			process.env.PRIVATE_KEY,
			async (err, decodedUser) => {
				if (err) {
					// invalid syntax
					return res.sendStatus(401);
				}

				if (decodedUser.role !== "admin") {
					return res.sendStatus(401);
				}
				const title = req.body.title;
				const body = req.body.body;
				const post = await Post.findOneAndUpdate(
					{ title: postId },
					{ title: title, body: body },
					{ new: true }
				).exec();

				if (post) {
					res.json(post);
				} else {
					res.sendStatus(500);
				}
			}
		);
	}),
];

exports.removePost_remove = [
	param("postId")
		.escape()
		.custom(async (v) => {
			if (!mongoose.isValidObjectId(v)) {
				throw new Error("Post not found");
			}

			const post = await Post.findOne({ _id: v }).exec();
			if (!post) {
				// post not found
				throw new Error("Post not found");
			}
		}),
	asyncHandler(async (req, res, next) => {
		// remove a post and comments within the post
		const result = validationResult(req);

		if (!result.isEmpty()) {
			return res.json(result.array());
		}

		const postId = req.params.postId;
		const requestedToken = req.token;

		if (!requestedToken) {
			// if token is null, it goes here
			return res.sendStatus(401);
		}

		jwt.verify(
			requestedToken,
			process.env.PRIVATE_KEY,
			async (err, decodedUser) => {
				if (err) {
					// invalid syntax
					return res.sendStatus(401);
				}

				if (decodedUser.role !== "admin") {
					return res.sendStatus(401);
				}

				const deletedPost = await Post.findByIdAndDelete({ _id: postId });
				if (deletedPost) {
					await Comment.deleteMany({ _id: { $in: deletedPost.comments } });
					return res.sendStatus(202);
				} else {
					return res.sendStatus(500);
				}
			}
		);
	}),
];

exports.removeComment_remove = [
	param("postId")
		.escape()
		.custom(async (v) => {
			if (!mongoose.isValidObjectId(v)) {
				throw new Error("Post not found");
			}

			const post = await Post.findOne({ _id: v }).exec();
			if (!post) {
				// post not found
				throw new Error("Post not found");
			}
		}),
	param("commentId")
		.escape()
		.custom(async (v) => {
			if (!mongoose.isValidObjectId(v)) {
				throw new Error("Comment not found");
			}

			const comment = await Comment.findOne({ _id: v }).exec();
			if (!comment) {
				// post not found
				throw new Error("Comment not found");
			}
		}),
	asyncHandler(async (req, res, next) => {
		// remove a comment
		const result = validationResult(req);
		const requestedToken = req.token;
		if (!result.isEmpty()) {
			return res.json(result.array({ onlyFirstError: true }));
		}

		if (!requestedToken) {
			// if token is null, it goes here
			return res.sendStatus(401);
		}
		const postId = req.params.postId;
		const commentId = req.params.commentId;

		jwt.verify(
			requestedToken,
			process.env.PRIVATE_KEY,
			async (err, decodedUser) => {
				if (err) {
					// invalid syntax
					return res.sendStatus(401);
				}

				if (decodedUser.role !== "admin") {
					return res.sendStatus(401);
				}

				const commentInPostDeletionresult = await Post.updateOne(
					{ _id: postId },
					{ $pullAll: { comments: [{ _id: commentId }] } }
				).exec();

				if (!commentInPostDeletionresult.modifiedCount) {
					// Check if the query has modified content
					return res.sendStatus(404);
				}

				const commentDeletionResult = await Comment.deleteOne({
					_id: commentId,
				}).exec();

				if (commentDeletionResult) {
					return res.sendStatus(202);
				} else {
					return res.sendStatus(500);
				}
			}
		);
	}),
];
