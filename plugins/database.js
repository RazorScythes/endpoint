const Comment            = require('../models/comment.model')
const Users              = require('../models/user.model')

/*
    FUNCTION STARTS HERE
*/

const populateReplies = (replies, users) => {
    return replies.map(reply => {
        const user = users.find(u => u._id.toString() === reply.user_id.toString());

        const populatedReply = {
            ...reply,
            user: user ? user.username : '',
            avatar: user ? user.avatar : ''
        };
    
        if (reply.replies && reply.replies.length > 0) {
            populatedReply.replies = populateReplies(reply.replies, users);
        }
    
        return populatedReply;
    });
};
  
const populateComments = (comments, users) => {
    return comments.map(comment => {
        const plainComment = comment.toObject();
    
        const user = users.find(u => u._id.toString() === plainComment.user_id.toString());

        const populatedComment = {
            ...plainComment,
            user: user ? user.username : '',
            avatar: user ? user.avatar : ''
        };
    
        if (plainComment.replies && plainComment.replies.length > 0) {
            populatedComment.replies = populateReplies(plainComment.replies, users);
        }
    
        return populatedComment;
    });
};

/*
    FUNCTION ENDS HERE
*/

exports.getComments = async (parent_id) => {
    const users = await Users.find({}, { _id: 1, username: 1, avatar: 1 });
    const comments = await Comment.find({ parent_id }).sort({ createdAt: -1 });
    const populatedComments = populateComments(comments, users);

    return populatedComments;
}