/**
 * 排行榜功能模块
 */
document.addEventListener('DOMContentLoaded', () => {
    initLeaderboard();
    initTabSwitching();
});

/**
 * 初始化排行榜
 */
function initLeaderboard() {
    loadLeaderboardData('daily'); // 默认加载日榜
}

/**
 * 初始化标签切换
 */
function initTabSwitching() {
    const tabs = document.querySelectorAll('.tab-btn');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            // 移除其他标签的激活状态
            tabs.forEach(t => t.classList.remove('active'));
            // 激活当前标签
            tab.classList.add('active');
            // 加载对应时期的排行榜数据
            loadLeaderboardData(tab.dataset.period);
        });
    });
}

/**
 * 加载排行榜数据
 * @param {string} period - 时间周期(daily/weekly/monthly)
 */
async function loadLeaderboardData(period) {
    try {
        // 显示加载状态
        showLoading();
        
        // 模拟API请求
        await new Promise(resolve => setTimeout(resolve, 800));
        const data = getMockData(period);
        
        // 更新排行榜显示
        updateLeaderboard(data);
    } catch (error) {
        console.error('加载排行榜失败:', error);
        showError('加载失败，请稍后重试');
    } finally {
        hideLoading();
    }
}

/**
 * 获取模拟数据
 * @param {string} period - 时间周期
 */
function getMockData(period) {
    // 这里可以替换为实际的API调用
    return {
        daily: [
            { rank: 1, name: '王者归来', level: 18, score: 98, avatar: 'images/avatars/user1.jpg' },
            { rank: 2, name: '投篮王者', level: 16, score: 95, avatar: 'images/avatars/user2.jpg' },
            { rank: 3, name: '篮球达人', level: 15, score: 92, avatar: 'images/avatars/user3.jpg' },
            { rank: 4, name: '训练新星', level: 14, score: 90, avatar: 'images/avatars/user4.jpg', trend: 'up' },
            { rank: 5, name: '投篮高手', level: 13, score: 88, avatar: 'images/avatars/user5.jpg', trend: 'down' },
            { rank: 6, name: '篮球小将', level: 12, score: 85, avatar: 'images/avatars/user6.jpg', trend: 'up' },
            { rank: 7, name: '运球达人', level: 11, score: 82, avatar: 'images/avatars/user7.jpg', trend: 'same' },
            { rank: 8, name: '篮球新秀', level: 10, score: 80, avatar: 'images/avatars/user8.jpg', trend: 'up' }
        ],
        weekly: [
            { rank: 1, name: '投篮王者', level: 16, score: 96, avatar: 'images/avatars/user2.jpg' },
            { rank: 2, name: '王者归来', level: 18, score: 94, avatar: 'images/avatars/user1.jpg' },
            { rank: 3, name: '训练新星', level: 14, score: 93, avatar: 'images/avatars/user4.jpg' }
        ],
        monthly: [
            { rank: 1, name: '篮球达人', level: 15, score: 97, avatar: 'images/avatars/user3.jpg' },
            { rank: 2, name: '王者归来', level: 18, score: 96, avatar: 'images/avatars/user1.jpg' },
            { rank: 3, name: '投篮王者', level: 16, score: 95, avatar: 'images/avatars/user2.jpg' }
        ]
    }[period];
}

/**
 * 更新排行榜显示
 * @param {Array} data - 排行榜数据
 */
function updateLeaderboard(data) {
    // 更新前三名显示
    updateTopThree(data.slice(0, 3));
    // 更新其他排名
    updateRankList(data.slice(3));
}

/**
 * 显示加载状态
 */
function showLoading() {
    const loading = document.createElement('div');
    loading.className = 'loading';
    loading.innerHTML = '<i class="fas fa-spinner"></i> 加载中...';
    document.querySelector('.leaderboard-list').appendChild(loading);
}

/**
 * 隐藏加载状态
 */
function hideLoading() {
    const loading = document.querySelector('.loading');
    if (loading) {
        loading.remove();
    }
}

/**
 * 显示错误信息
 * @param {string} message - 错误信息
 */
function showError(message) {
    const error = document.createElement('div');
    error.className = 'error-message';
    error.textContent = message;
    document.body.appendChild(error);
    setTimeout(() => error.remove(), 3000);
}

/**
 * 更新前三名显示
 * @param {Array} topThree - 前三名数据
 */
function updateTopThree(topThree) {
    const topThreeContainer = document.querySelector('.top-three');
    if (!topThreeContainer) return;

    // 清空现有内容
    topThreeContainer.innerHTML = '';

    // 创建并添加第二名
    if (topThree[1]) {
        topThreeContainer.appendChild(createTopCard(topThree[1], 'second'));
    }

    // 创建并添加第一名
    if (topThree[0]) {
        topThreeContainer.appendChild(createTopCard(topThree[0], 'first'));
    }

    // 创建并添加第三名
    if (topThree[2]) {
        topThreeContainer.appendChild(createTopCard(topThree[2], 'third'));
    }
}

/**
 * 创建排名卡片
 * @param {Object} user - 用户数据
 * @param {string} position - 排名位置
 */
function createTopCard(user, position) {
    const card = document.createElement('div');
    card.className = `rank-card ${position}`;
    card.innerHTML = `
        <div class="rank-number">${user.rank}</div>
        ${position === 'first' ? '<div class="crown"><i class="fas fa-crown"></i></div>' : ''}
        <img src="${user.avatar}" alt="${user.name}" class="user-avatar">
        <div class="user-info">
            <h3>${user.name}</h3>
            <span class="level">Level ${user.level}</span>
        </div>
        <div class="score">${user.score}分</div>
    `;
    return card;
}

/**
 * 更新排名列表
 * @param {Array} rankings - 排名数据
 */
function updateRankList(rankings) {
    const rankList = document.querySelector('.rank-list');
    if (!rankList) return;

    // 清空现有内容
    rankList.innerHTML = '';

    // 添加排名项
    rankings.forEach(user => {
        const rankItem = document.createElement('div');
        rankItem.className = 'rank-item';
        rankItem.innerHTML = `
            <div class="rank-number">${user.rank}</div>
            <img src="${user.avatar}" alt="${user.name}" class="user-avatar">
            <div class="user-info">
                <h3>${user.name}</h3>
                <span class="level">Level ${user.level}</span>
            </div>
            <div class="score">${user.score}分</div>
            ${user.trend ? `<div class="trend ${user.trend}">
                <i class="fas fa-${getTrendIcon(user.trend)}"></i>
            </div>` : ''}
        `;
        rankList.appendChild(rankItem);
    });
}

/**
 * 获取趋势图标
 * @param {string} trend - 趋势类型
 */
function getTrendIcon(trend) {
    switch (trend) {
        case 'up': return 'arrow-up';
        case 'down': return 'arrow-down';
        default: return 'minus';
    }
} 