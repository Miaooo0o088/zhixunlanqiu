/**
 * 社区页面逻辑
 */
document.addEventListener('DOMContentLoaded', () => {
    initPostEditor();
    initTopicTags();
    initPostActions();
    loadPosts();
});

// 存储用户状态
const userState = {
    likedPosts: new Set(),
    followedUsers: new Set()
};

/**
 * 初始化发帖编辑器
 */
function initPostEditor() {
    const editor = document.querySelector('.post-form');
    const publishBtn = editor.querySelector('.post-btn');
    const imageInput = document.createElement('input');
    imageInput.type = 'file';
    imageInput.accept = 'image/*';
    imageInput.style.display = 'none';
    editor.appendChild(imageInput);

    // 发布帖子
    publishBtn.addEventListener('click', () => {
        const content = editor.querySelector('textarea').value;
        if (!content.trim()) {
            alert('请输入内容');
            return;
        }
        createPost(content);
        editor.querySelector('textarea').value = '';
    });

    // 上传图片
    const uploadBtn = editor.querySelector('.upload-btn');
    uploadBtn.addEventListener('click', () => imageInput.click());
    
    imageInput.addEventListener('change', handleImageUpload);
}

/**
 * 处理图片上传
 * @param {Event} e - 事件对象
 */
function handleImageUpload(e) {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = document.createElement('img');
            img.src = e.target.result;
            document.querySelector('.post-preview').appendChild(img);
        };
        reader.readAsDataURL(file);
    }
}

/**
 * 创建新帖子
 * @param {string} content - 帖子内容
 */
function createPost(content) {
    const post = {
        id: Date.now(),
        author: {
            name: '当前用户',
            avatar: 'images/avatars/default.jpg'
        },
        content,
        time: new Date().toLocaleString(),
        likes: 0,
        comments: []
    };

    // 添加到帖子列表
    const postsList = document.querySelector('.posts');
    const postElement = createPostElement(post);
    postsList.insertBefore(postElement, postsList.firstChild);
}

/**
 * 创建帖子元素
 * @param {Object} post - 帖子数据
 */
function createPostElement(post) {
    const postCard = document.createElement('div');
    postCard.className = 'post-card';
    postCard.dataset.postId = post.id;
    
    postCard.innerHTML = `
        <div class="post-header">
            <div class="post-info">
                <img src="${post.author.avatar}" alt="用户头像">
                <div>
                    <span class="username">${post.author.name}</span>
                    <span class="post-time">${post.time}</span>
                </div>
            </div>
            <button class="follow-btn" onclick="toggleFollow(this)">
                <i class="fas fa-plus"></i> 关注
            </button>
        </div>
        <div class="post-content">
            <p>${post.content}</p>
        </div>
        <div class="post-actions">
            <button onclick="toggleLike(this)">
                <i class="far fa-heart"></i>
                <span>${post.likes}</span>
            </button>
            <button onclick="toggleComments(this)">
                <i class="far fa-comment"></i>
                <span>评论</span>
            </button>
            <button onclick="sharePost(this)">
                <i class="far fa-share-square"></i>
                <span>分享</span>
            </button>
        </div>
        <div class="comments-section" style="display: none;">
            <div class="comments-list"></div>
            <div class="comment-form">
                <textarea placeholder="写下你的评论..."></textarea>
                <button onclick="addComment(this)">发送</button>
            </div>
        </div>
    `;
    
    return postCard;
}

/**
 * 初始化话题标签
 */
function initTopicTags() {
    const tagsContainer = document.querySelector('.posts-filter');
    tagsContainer.addEventListener('click', (e) => {
        if (e.target.classList.contains('filter-btn')) {
            // 移除其他标签的激活状态
            tagsContainer.querySelectorAll('.filter-btn').forEach(btn => {
                btn.classList.remove('active');
            });
            // 激活当前标签
            e.target.classList.add('active');
            // 根据标签筛选帖子
            filterPosts(e.target.textContent);
        }
    });
}

/**
 * 根据标签筛选帖子
 * @param {string} tag - 标签名称
 */
function filterPosts(tag) {
    // 这里可以添加实际的筛选逻辑
    console.log('筛选标签:', tag);
}

/**
 * 切换点赞状态
 * @param {HTMLElement} btn - 点赞按钮
 */
function toggleLike(btn) {
    const postId = btn.closest('.post-card').dataset.postId;
    const icon = btn.querySelector('i');
    const count = btn.querySelector('span');
    
    if (userState.likedPosts.has(postId)) {
        userState.likedPosts.delete(postId);
        icon.className = 'far fa-heart';
        count.textContent = parseInt(count.textContent) - 1;
    } else {
        userState.likedPosts.add(postId);
        icon.className = 'fas fa-heart';
        count.textContent = parseInt(count.textContent) + 1;
    }
}

/**
 * 切换评论区显示
 * @param {HTMLElement} btn - 评论按钮
 */
function toggleComments(btn) {
    const commentsSection = btn.closest('.post-card').querySelector('.comments-section');
    commentsSection.style.display = commentsSection.style.display === 'none' ? 'block' : 'none';
}

/**
 * 添加评论
 * @param {HTMLElement} btn - 发送按钮
 */
function addComment(btn) {
    const commentForm = btn.closest('.comment-form');
    const content = commentForm.querySelector('textarea').value;
    if (!content.trim()) return;
    
    const commentsList = btn.closest('.comments-section').querySelector('.comments-list');
    const comment = document.createElement('div');
    comment.className = 'comment';
    comment.innerHTML = `
        <div class="comment-header">
            <img src="images/avatars/default.jpg" alt="用户头像">
            <span class="username">当前用户</span>
            <span class="comment-time">刚刚</span>
        </div>
        <p>${content}</p>
    `;
    
    commentsList.appendChild(comment);
    commentForm.querySelector('textarea').value = '';
}

/**
 * 切换关注状态
 * @param {HTMLElement} btn - 关注按钮
 */
function toggleFollow(btn) {
    const userId = btn.closest('.post-card').dataset.userId;
    
    if (userState.followedUsers.has(userId)) {
        userState.followedUsers.delete(userId);
        btn.innerHTML = '<i class="fas fa-plus"></i> 关注';
        btn.classList.remove('following');
    } else {
        userState.followedUsers.add(userId);
        btn.innerHTML = '<i class="fas fa-check"></i> 已关注';
        btn.classList.add('following');
    }
}

/**
 * 分享帖子
 * @param {HTMLElement} btn - 分享按钮
 */
function sharePost(btn) {
    const postId = btn.closest('.post-card').dataset.postId;
    const post = mockPosts.find(p => p.id === parseInt(postId));
    if (!post) return;

    // 创建分享弹窗
    const shareModal = document.createElement('div');
    shareModal.className = 'share-modal';
    shareModal.innerHTML = `
        <div class="share-content">
            <h3>分享到</h3>
            <div class="share-options">
                <button class="share-btn wechat">
                    <i class="fab fa-weixin"></i>
                    <span>微信</span>
                </button>
                <button class="share-btn weibo">
                    <i class="fab fa-weibo"></i>
                    <span>微博</span>
                </button>
                <button class="share-btn qq">
                    <i class="fab fa-qq"></i>
                    <span>QQ</span>
                </button>
                <button class="share-btn link" onclick="copyShareLink('${post.id}')">
                    <i class="fas fa-link"></i>
                    <span>复制链接</span>
                </button>
            </div>
            <button class="close-btn">
                <i class="fas fa-times"></i>
            </button>
        </div>
    `;

    document.body.appendChild(shareModal);

    // 添加关闭事件
    shareModal.querySelector('.close-btn').onclick = () => {
        shareModal.remove();
    };

    // 点击外部关闭
    shareModal.onclick = (e) => {
        if (e.target === shareModal) {
            shareModal.remove();
        }
    };
}

/**
 * 复制分享链接
 * @param {string} postId - 帖子ID
 */
function copyShareLink(postId) {
    const link = `${window.location.origin}/post/${postId}`;
    navigator.clipboard.writeText(link).then(() => {
        showMessage('链接已复制到剪贴板');
    }).catch(() => {
        showMessage('复制失败，请手动复制', 'error');
    });
}

/**
 * 显示消息提示
 * @param {string} message - 消息内容
 * @param {string} type - 消息类型(success/error)
 */
function showMessage(message, type = 'success') {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message-toast ${type}`;
    messageDiv.textContent = message;
    document.body.appendChild(messageDiv);
    setTimeout(() => messageDiv.remove(), 2000);
}

/**
 * 图片预览功能
 * @param {string} imgSrc - 图片地址
 */
function previewImage(imgSrc) {
    const preview = document.createElement('div');
    preview.className = 'image-preview';
    preview.innerHTML = `
        <div class="preview-content">
            <img src="${imgSrc}" alt="预览图片">
            <button class="close-btn">
                <i class="fas fa-times"></i>
            </button>
        </div>
    `;

    document.body.appendChild(preview);

    // 添加关闭事件
    preview.querySelector('.close-btn').onclick = () => {
        preview.remove();
    };

    // 点击外部关闭
    preview.onclick = (e) => {
        if (e.target === preview) {
            preview.remove();
        }
    };
}

// 模拟帖子数据
const mockPosts = [
    {
        id: 1,
        author: {
            id: 'user1',
            name: '篮球达人',
            avatar: 'images/avatars/user1.jpg'
        },
        content: '今天完成了投篮训练，准确率提升到85%了！继续加油💪',
        images: ['images/training/shooting-result.jpg'],
        time: '2小时前',
        likes: 128,
        comments: [
            {
                author: { name: '训练小助手', avatar: 'images/avatars/coach.jpg' },
                content: '动作很标准，继续保持！',
                time: '1小时前'
            }
        ]
    },
    {
        id: 2,
        author: {
            id: 'user2',
            name: '运球高手',
            avatar: 'images/avatars/user2.jpg'
        },
        content: '分享一个运球训练小技巧：专注于手指控制，而不是手掌。',
        time: '4小时前',
        likes: 256,
        comments: []
    }
];

/**
 * 加载帖子列表
 * @param {string} filter - 筛选类型(latest/hot/featured)
 */
const loadPosts = async (filter = 'latest') => {
    try {
        // 模拟API请求延迟
        await new Promise(resolve => setTimeout(resolve, 500));
        const posts = mockPosts;
        
        // 根据筛选条件处理数据
        let filteredPosts = [...posts];
        switch (filter) {
            case 'hot':
                filteredPosts.sort((a, b) => b.likes - a.likes);
                break;
            case 'featured':
                filteredPosts = posts.filter(post => post.likes > 100);
                break;
            default:
                // 最新帖子，按时间倒序
                filteredPosts.reverse();
        }

        renderPosts(filteredPosts);
    } catch (err) {
        console.error('加载帖子失败:', err);
        showErrorMessage('加载失败，请稍后重试');
    }
};

/**
 * 渲染帖子列表
 * @param {Array} posts - 帖子数据数组
 */
function renderPosts(posts) {
    const postsContainer = document.querySelector('.posts-list');
    postsContainer.innerHTML = ''; // 清空现有内容

    posts.forEach(post => {
        const postElement = createPostElement(post);
        postsContainer.appendChild(postElement);
    });
}

/**
 * 显示错误消息
 * @param {string} message - 错误信息
 */
function showErrorMessage(message) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message';
    errorDiv.textContent = message;
    
    document.body.appendChild(errorDiv);
    setTimeout(() => errorDiv.remove(), 3000);
}

/**
 * 初始化帖子交互功能
 */
function initPostActions() {
    document.addEventListener('click', (e) => {
        // 点赞事件委托
        if (e.target.closest('.like-btn')) {
            toggleLike(e.target.closest('.like-btn'));
        }
        
        // 评论事件委托
        if (e.target.closest('.comment-btn')) {
            toggleComments(e.target.closest('.comment-btn'));
        }
        
        // 分享事件委托
        if (e.target.closest('.share-btn')) {
            sharePost(e.target.closest('.share-btn'));
        }
    });
} 