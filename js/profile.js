/**
 * 个人中心页面逻辑
 */
document.addEventListener('DOMContentLoaded', () => {
    initTabSwitching();
    initAvatarUpload();
    initFormSubmission();
    initSecuritySettings();
    initProfileNav();
    loadUserInfo();
    loadUserStats();
});

/**
 * 初始化个人中心导航
 */
const initProfileNav = () => {
    const navBtns = document.querySelectorAll('.nav-btn');
    navBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            navBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            loadContent(btn.dataset.section);
        });
    });
};

/**
 * 加载用户信息
 */
const loadUserInfo = async () => {
    try {
        const userInfo = await fetchUserInfo();
        updateProfileDisplay(userInfo);
    } catch (err) {
        console.error('加载用户信息失败:', err);
    }
};

/**
 * 初始化标签页切换
 */
function initTabSwitching() {
    const menuItems = document.querySelectorAll('.profile-menu li');
    const sections = document.querySelectorAll('.profile-section');
    
    menuItems.forEach(item => {
        item.addEventListener('click', () => {
            // 移除所有激活状态
            menuItems.forEach(i => i.classList.remove('active'));
            sections.forEach(s => s.classList.remove('active'));
            
            // 添加新的激活状态
            item.classList.add('active');
            const targetSection = document.getElementById(item.dataset.tab);
            if (targetSection) {
                targetSection.classList.add('active');
            }
        });
    });
}

/**
 * 初始化头像上传
 */
function initAvatarUpload() {
    const avatarBtn = document.querySelector('.change-avatar-btn');
    const avatarImg = document.querySelector('.user-avatar');
    
    // 创建隐藏的文件输入框
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'image/*';
    fileInput.style.display = 'none';
    document.body.appendChild(fileInput);
    
    avatarBtn.addEventListener('click', () => {
        fileInput.click();
    });
    
    fileInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        // 验证文件类型和大小
        if (!file.type.startsWith('image/')) {
            showToast('请选择图片文件');
            return;
        }
        
        if (file.size > 5 * 1024 * 1024) {
            showToast('图片大小不能超过5MB');
            return;
        }
        
        try {
            // 显示预览
            const reader = new FileReader();
            reader.onload = (e) => {
                avatarImg.src = e.target.result;
            };
            reader.readAsDataURL(file);
            
            // 上传到服务器
            await uploadAvatar(file);
            showToast('头像更新成功');
        } catch (error) {
            showToast('头像上传失败，请重试');
            // 恢复原头像
            avatarImg.src = avatarImg.dataset.original || 'images/default-avatar.png';
        }
    });
}

/**
 * 初始化表单提交
 */
function initFormSubmission() {
    const basicInfoForm = document.getElementById('basicInfoForm');
    
    basicInfoForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        try {
            const formData = new FormData(basicInfoForm);
            await updateUserInfo(formData);
            showToast('保存成功');
        } catch (error) {
            showToast('保存失败，请重试');
        }
    });
}

/**
 * 初始化安全设置
 */
function initSecuritySettings() {
    const changeButtons = document.querySelectorAll('.change-btn');
    
    changeButtons.forEach(button => {
        button.addEventListener('click', () => {
            const action = button.parentElement.querySelector('h4').textContent;
            switch (action) {
                case '登录密码':
                    showChangePasswordModal();
                    break;
                case '手机绑定':
                    showChangePhoneModal();
                    break;
            }
        });
    });
}

/**
 * 显示修改密码模态框
 */
function showChangePasswordModal() {
    // 创建模态框HTML
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
        <div class="modal-content">
            <h3>修改密码</h3>
            <form id="changePasswordForm">
                <div class="form-group">
                    <label for="currentPassword">当前密码</label>
                    <input type="password" id="currentPassword" required>
                </div>
                <div class="form-group">
                    <label for="newPassword">新密码</label>
                    <input type="password" id="newPassword" required>
                </div>
                <div class="form-group">
                    <label for="confirmNewPassword">确认新密码</label>
                    <input type="password" id="confirmNewPassword" required>
                </div>
                <div class="modal-buttons">
                    <button type="button" class="cancel-btn">取消</button>
                    <button type="submit" class="confirm-btn">确认修改</button>
                </div>
            </form>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // 处理关闭
    modal.querySelector('.cancel-btn').addEventListener('click', () => {
        modal.remove();
    });
    
    // 处理表单提交
    modal.querySelector('form').addEventListener('submit', async (e) => {
        e.preventDefault();
        // 这里添加修改密码的逻辑
        modal.remove();
    });
}

/**
 * 显示Toast提示
 * @param {string} message - 提示信息
 */
function showToast(message) {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    
    document.body.appendChild(toast);
    
    setTimeout(() => toast.classList.add('show'), 10);
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

/**
 * 上传头像到服务器
 * @param {File} file - 头像文件
 */
async function uploadAvatar(file) {
    // 这里添加实际的上传逻辑
    return new Promise((resolve) => {
        setTimeout(resolve, 1500);
    });
}

/**
 * 更新用户信息
 * @param {FormData} formData - 表单数据
 */
async function updateUserInfo(formData) {
    // 这里添加实际的更新逻辑
    return new Promise((resolve) => {
        setTimeout(resolve, 1000);
    });
}

/**
 * 更新头像
 */
const updateAvatar = async (file) => {
    try {
        const result = await uploadAvatar(file);
        updateAvatarDisplay(result.url);
    } catch (err) {
        showErrorMessage('头像更新失败');
    }
};

/**
 * 加载用户训练统计数据
 */
async function loadUserStats() {
    try {
        const stats = await fetchUserStats();
        updateStatsDisplay(stats);
        initTrainingChart(stats.trainingHistory);
    } catch (error) {
        console.error('加载训练数据失败:', error);
    }
}

/**
 * 更新统计数据显示
 * @param {Object} stats - 用户统计数据
 */
function updateStatsDisplay(stats) {
    // 更新训练时长
    document.querySelector('#totalTrainingTime').textContent = 
        formatTrainingTime(stats.totalTime);
    
    // 更新投篮命中率
    document.querySelector('#shootingAccuracy').textContent = 
        `${stats.shootingAccuracy}%`;
    
    // 添加更多统计数据
    const statsGrid = document.querySelector('.stats-grid');
    statsGrid.innerHTML += `
        <div class="stat-card">
            <div class="stat-icon">
                <i class="fas fa-calendar-check"></i>
            </div>
            <div class="stat-info">
                <h4>训练天数</h4>
                <p>${stats.trainingDays}天</p>
            </div>
        </div>
        <div class="stat-card">
            <div class="stat-icon">
                <i class="fas fa-fire"></i>
            </div>
            <div class="stat-info">
                <h4>消耗热量</h4>
                <p>${stats.caloriesBurned}千卡</p>
            </div>
        </div>
    `;
}

/**
 * 初始化训练数据图表
 * @param {Array} history - 训练历史数据
 */
function initTrainingChart(history) {
    const ctx = document.getElementById('trainingChart').getContext('2d');
    
    new Chart(ctx, {
        type: 'line',
        data: {
            labels: history.map(item => item.date),
            datasets: [
                {
                    label: '训练时长(分钟)',
                    data: history.map(item => item.duration),
                    borderColor: 'rgb(75, 192, 192)',
                    tension: 0.1
                },
                {
                    label: '投篮命中率(%)',
                    data: history.map(item => item.accuracy),
                    borderColor: 'rgb(255, 99, 132)',
                    tension: 0.1
                }
            ]
        },
        options: {
            responsive: true,
            plugins: {
                title: {
                    display: true,
                    text: '近30天训练数据'
                },
                tooltip: {
                    mode: 'index',
                    intersect: false
                }
            },
            scales: {
                y: {
                    beginAtZero: true
                }
            }
        }
    });
}

/**
 * 格式化训练时长
 * @param {number} minutes - 训练分钟数
 * @returns {string} 格式化后的时间
 */
function formatTrainingTime(minutes) {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}小时${mins}分钟`;
}

/**
 * 获取用户统计数据
 * @returns {Promise<Object>} 用户统计数据
 */
async function fetchUserStats() {
    // 模拟API调用
    return new Promise((resolve) => {
        setTimeout(() => {
            resolve({
                totalTime: 7200, // 120小时
                shootingAccuracy: 65,
                trainingDays: 45,
                caloriesBurned: 15000,
                trainingHistory: generateTrainingHistory()
            });
        }, 1000);
    });
}

/**
 * 生成模拟训练历史数据
 * @returns {Array} 训练历史数据
 */
function generateTrainingHistory() {
    const history = [];
    const now = new Date();
    
    for (let i = 29; i >= 0; i--) {
        const date = new Date(now);
        date.setDate(date.getDate() - i);
        
        history.push({
            date: date.toLocaleDateString(),
            duration: Math.floor(Math.random() * 120) + 30, // 30-150分钟
            accuracy: Math.floor(Math.random() * 30) + 40 // 40-70%
        });
    }
    
    return history;
} 