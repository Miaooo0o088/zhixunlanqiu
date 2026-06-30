/**
 * 当文档加载完成时执行
 */
document.addEventListener('DOMContentLoaded', () => {
    // 初始化各个模块
    initNavigation();
    initTraining();
    initLeaderboard();
    initCommunity();
    initProfile();
    initAuth();

    console.log('网页已加载完成');

    /**
     * 处理表单提交
     * @param {Event} e - 表单提交事件
     */
    const handleSubmit = (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const data = Object.fromEntries(formData);
        console.log('表单数据：', data);
        alert('感谢您的留言！');
        e.target.reset();
    };

    // 绑定表单提交事件
    const contactForm = document.getElementById('contact-form');
    if (contactForm) {
        contactForm.addEventListener('submit', handleSubmit);
    }

    /**
     * 添加滚动显示动画
     */
    const addScrollAnimation = () => {
        const elements = document.querySelectorAll('.feature-card, .section h2, .form-group');
        elements.forEach(element => {
            element.classList.add('fade-in');
        });

        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('visible');
                }
            });
        }, {
            threshold: 0.3
        });

        elements.forEach(element => {
            observer.observe(element);
        });
    };

    addScrollAnimation();
});

/**
 * 导航栏功能初始化
 */
const initNavigation = () => {
    // 平滑滚动
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            document.querySelector(this.getAttribute('href')).scrollIntoView({
                behavior: 'smooth'
            });
        });
    });

    // 导航栏滚动效果
    const nav = document.querySelector('nav');
    let lastScroll = 0;

    window.addEventListener('scroll', () => {
        const currentScroll = window.pageYOffset;
        if (currentScroll <= 0) {
            nav.classList.remove('scroll-up');
            return;
        }
        
        if (currentScroll > lastScroll && !nav.classList.contains('scroll-down')) {
            nav.classList.remove('scroll-up');
            nav.classList.add('scroll-down');
        } else if (currentScroll < lastScroll && nav.classList.contains('scroll-down')) {
            nav.classList.remove('scroll-down');
            nav.classList.add('scroll-up');
        }
        lastScroll = currentScroll;
    });
};

/**
 * 训练模块初始化
 */
const initTraining = () => {
    const startBtn = document.querySelector('.start-btn');
    const cameraView = document.querySelector('.camera-view');
    
    if (startBtn && cameraView) {
        startBtn.addEventListener('click', async () => {
            try {
                // 请求摄像头权限
                const stream = await navigator.mediaDevices.getUserMedia({ video: true });
                const video = document.createElement('video');
                video.srcObject = stream;
                video.autoplay = true;
                
                // 替换摄像头图标
                cameraView.innerHTML = '';
                cameraView.appendChild(video);
                
                startBtn.textContent = '训练中...';
                startBtn.disabled = true;
                startBtn.classList.add('loading');
                
                // 更新训练数据
                updateTrainingStats();
                
                // 模拟训练结束
                setTimeout(() => {
                    stream.getTracks().forEach(track => track.stop());
                    startBtn.textContent = '开始训练';
                    startBtn.disabled = false;
                    startBtn.classList.remove('loading');
                    
                    // 显示训练结果
                    showTrainingResult();
                }, 10000);
            } catch (err) {
                console.error('无法访问摄像头:', err);
                alert('请允许访问摄像头以开始训练');
            }
        });
    }
};

/**
 * 更新训练数据
 */
const updateTrainingStats = () => {
    const stats = document.querySelectorAll('.stat-item .value');
    stats.forEach(stat => {
        // 模拟数据更新
        const currentValue = parseInt(stat.textContent);
        const interval = setInterval(() => {
            const newValue = Math.min(currentValue + Math.random() * 5, 100);
            stat.textContent = `${newValue.toFixed(1)}%`;
            if (newValue >= 100) {
                clearInterval(interval);
            }
        }, 1000);
    });
};

/**
 * 显示训练结果
 */
const showTrainingResult = () => {
    const result = document.createElement('div');
    result.className = 'training-result fade-in';
    result.innerHTML = `
        <h3>训练完成！</h3>
        <div class="result-stats">
            <div class="result-item">
                <span>动作准确率</span>
                <span class="value">92%</span>
            </div>
            <div class="result-item">
                <span>完成度</span>
                <span class="value">100%</span>
            </div>
        </div>
        <button class="share-btn">分享到社区</button>
    `;
    
    document.querySelector('.training-container').appendChild(result);
    
    // 绑定分享按钮事件
    result.querySelector('.share-btn').addEventListener('click', () => {
        const content = `完成今日训练！动作准确率92%，继续努力💪`;
        createNewPost(content);
        result.remove();
    });
};

/**
 * 排行榜功能初始化
 */
const initLeaderboard = () => {
    const tabs = document.querySelectorAll('.leaderboard-tabs .tab');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            // 移除其他标签的active类
            tabs.forEach(t => t.classList.remove('active'));
            // 添加当前标签的active类
            tab.classList.add('active');
            // 更新排行榜数据
            updateLeaderboardData(tab.textContent);
        });
    });
};

/**
 * 更新排行榜数据
 * @param {string} type - 排行榜类型
 */
const updateLeaderboardData = (type) => {
    const rankingList = document.querySelector('.ranking-list');
    rankingList.classList.add('loading');
    
    // 模拟加载数据
    setTimeout(() => {
        const mockData = {
            '日榜': [
                { rank: 1, name: '王者归来', score: 98, avatar: 'images/avatar1.jpg' },
                { rank: 2, name: '篮球达人', score: 95, avatar: 'images/avatar2.jpg' },
                { rank: 3, name: '训练狂人', score: 93, avatar: 'images/avatar3.jpg' }
            ],
            '周榜': [
                { rank: 1, name: '训练狂人', score: 456, avatar: 'images/avatar3.jpg' },
                { rank: 2, name: '王者归来', score: 442, avatar: 'images/avatar1.jpg' },
                { rank: 3, name: '篮球达人', score: 389, avatar: 'images/avatar2.jpg' }
            ],
            '月榜': [
                { rank: 1, name: '篮球达人', score: 1890, avatar: 'images/avatar2.jpg' },
                { rank: 2, name: '训练狂人', score: 1856, avatar: 'images/avatar3.jpg' },
                { rank: 3, name: '王者归来', score: 1788, avatar: 'images/avatar1.jpg' }
            ]
        };
        
        const data = mockData[type] || mockData['日榜'];
        rankingList.innerHTML = data.map(item => `
            <div class="ranking-item fade-in">
                <span class="rank">${item.rank}</span>
                <img src="${item.avatar}" alt="${item.name}">
                <span class="name">${item.name}</span>
                <span class="score">${item.score}分</span>
            </div>
        `).join('');
        
        rankingList.classList.remove('loading');
    }, 500);
};

/**
 * 社区功能初始化
 */
const initCommunity = () => {
    const postForm = document.querySelector('.post-form');
    if (postForm) {
        postForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const content = postForm.querySelector('textarea').value;
            if (content.trim()) {
                createNewPost(content);
                postForm.reset();
            }
        });

        // 初始化点赞和评论功能
        initPostActions();
    }
};

/**
 * 创建新帖子
 * @param {string} content - 帖子内容
 */
const createNewPost = (content) => {
    const posts = document.querySelector('.posts');
    const newPost = document.createElement('div');
    newPost.className = 'post-card';
    newPost.innerHTML = `
        <div class="post-header">
            <img src="images/avatar.jpg" alt="用户头像">
            <div class="post-info">
                <h4>我</h4>
                <span>刚刚</span>
            </div>
        </div>
        <p class="post-content">${content}</p>
        <div class="post-actions">
            <button><i class="fas fa-heart"></i> 点赞</button>
            <button><i class="fas fa-comment"></i> 评论</button>
        </div>
    `;
    posts.insertBefore(newPost, posts.firstChild);
};

/**
 * 初始化个人资料页面
 */
const initProfile = () => {
    // 初始化进度图表
    const ctx = document.getElementById('progressChart');
    if (ctx) {
        new Chart(ctx, {
            type: 'line',
            data: {
                labels: ['周一', '周二', '周三', '周四', '周五', '周六', '周日'],
                datasets: [{
                    label: '训练时长（小时）',
                    data: [2, 3, 1.5, 4, 2.5, 3.8, 3],
                    borderColor: '#007AFF',
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        position: 'top',
                    },
                    title: {
                        display: true,
                        text: '本周训练数据'
                    }
                }
            }
        });
    }
};

/**
 * 初始化帖子交互功能
 */
const initPostActions = () => {
    document.querySelectorAll('.post-actions button').forEach(button => {
        button.addEventListener('click', function() {
            const isLike = this.innerHTML.includes('fa-heart');
            if (isLike) {
                this.classList.toggle('liked');
            } else {
                // 显示评论输入框
                const postCard = this.closest('.post-card');
                toggleCommentForm(postCard);
            }
        });
    });
};

/**
 * 切换评论表单的显示状态
 * @param {HTMLElement} postCard - 帖子卡片元素
 */
const toggleCommentForm = (postCard) => {
    const existingForm = postCard.querySelector('.comment-form');
    if (existingForm) {
        existingForm.remove();
        return;
    }

    const commentForm = document.createElement('div');
    commentForm.className = 'comment-form';
    commentForm.innerHTML = `
        <textarea placeholder="写下你的评论..."></textarea>
        <button class="post-btn">发送</button>
    `;
    postCard.appendChild(commentForm);
};

/**
 * 初始化用户认证功能
 */
const initAuth = () => {
    const modal = document.getElementById('authModal');
    const tabs = document.querySelectorAll('.auth-tab');
    const forms = document.querySelectorAll('.auth-form');
    const closeBtn = document.querySelector('.close');

    // 显示模态框
    const showModal = () => {
        modal.style.display = 'block';
        document.body.style.overflow = 'hidden';
    };

    // 隐藏模态框
    const hideModal = () => {
        modal.style.display = 'none';
        document.body.style.overflow = 'auto';
    };

    // 切换登录/注册表单
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const targetForm = tab.dataset.tab;
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            
            forms.forEach(form => {
                form.style.display = form.id === `${targetForm}Form` ? 'block' : 'none';
            });
        });
    });

    // 关闭模态框
    closeBtn.addEventListener('click', hideModal);
    window.addEventListener('click', (e) => {
        if (e.target === modal) hideModal();
    });

    // 处理登录表单提交
    document.getElementById('loginForm').addEventListener('submit', (e) => {
        e.preventDefault();
        const email = document.getElementById('loginEmail').value;
        const password = document.getElementById('loginPassword').value;
        const rememberMe = document.getElementById('rememberMe').checked;
        
        // 模拟登录请求
        console.log('登录信息:', { email, password, rememberMe });
        
        // 如果记住登录，保存登录状态
        if (rememberMe) {
            localStorage.setItem('userEmail', email);
            localStorage.setItem('isLoggedIn', 'true');
        }
        
        alert('登录成功！');
        hideModal();
        updateUserStatus(true);
    });

    // 添加忘记密码功能
    const forgotPasswordLink = document.querySelector('.forgot-password');
    const forgotPasswordForm = document.getElementById('forgotPasswordForm');
    const backToLoginBtn = document.querySelector('.back-to-login');
    
    forgotPasswordLink.addEventListener('click', (e) => {
        e.preventDefault();
        document.getElementById('loginForm').style.display = 'none';
        document.querySelector('.auth-tabs').style.display = 'none';
        forgotPasswordForm.style.display = 'block';
    });
    
    backToLoginBtn.addEventListener('click', () => {
        forgotPasswordForm.style.display = 'none';
        document.querySelector('.auth-tabs').style.display = 'flex';
        document.getElementById('loginForm').style.display = 'block';
    });
    
    // 处理忘记密码表单提交
    forgotPasswordForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const email = document.getElementById('resetEmail').value;
        
        // 模拟发送重置密码邮件
        console.log('发送重置密码邮件到:', email);
        alert('重置密码链接已发送到您的邮箱，请查收！');
        backToLoginBtn.click();
    });

    // 检查是否有保存的登录状态
    const checkSavedLogin = () => {
        const isLoggedIn = localStorage.getItem('isLoggedIn');
        const userEmail = localStorage.getItem('userEmail');
        
        if (isLoggedIn === 'true' && userEmail) {
            updateUserStatus(true);
            // 可以在这里自动填充登录表单
            document.getElementById('loginEmail').value = userEmail;
            document.getElementById('rememberMe').checked = true;
        }
    };

    checkSavedLogin();

    // 处理注册表单提交
    document.getElementById('registerForm').addEventListener('submit', (e) => {
        e.preventDefault();
        const name = document.getElementById('registerName').value;
        const email = document.getElementById('registerEmail').value;
        const password = document.getElementById('registerPassword').value;
        const confirmPassword = document.getElementById('confirmPassword').value;

        if (password !== confirmPassword) {
            alert('两次输入的密码不一致！');
            return;
        }

        // 模拟注册请求
        console.log('注册信息:', { name, email, password });
        alert('注册成功！请登录');
        tabs[0].click(); // 切换到登录表单
    });

    // 添加登录按钮到导航栏
    const nav = document.querySelector('nav ul');
    const loginBtn = document.createElement('li');
    loginBtn.innerHTML = '<a href="#" id="loginBtn"><i class="fas fa-user"></i> 登录</a>';
    nav.appendChild(loginBtn);

    // 绑定登录按钮点击事件
    document.getElementById('loginBtn').addEventListener('click', (e) => {
        e.preventDefault();
        showModal();
    });

    // 在initAuth函数中添加密码强度检查
    initPasswordStrength();
    initSocialLogin();

    // 添加验证码功能
    initCaptcha();

    // 初始化手机登录功能
    initPhoneLogin();

    // 初始化认证相关按钮事件
    initAuthButtons();
};

/**
 * 更新用户登录状态
 * @param {boolean} isLoggedIn - 是否已登录
 */
const updateUserStatus = (isLoggedIn) => {
    const loginBtn = document.getElementById('loginBtn');
    if (isLoggedIn) {
        loginBtn.innerHTML = '<i class="fas fa-user"></i> 我的账户';
        loginBtn.href = '#profile';
    } else {
        loginBtn.innerHTML = '<i class="fas fa-user"></i> 登录';
        loginBtn.href = '#';
        // 清除保存的登录状态
        localStorage.removeItem('isLoggedIn');
        localStorage.removeItem('userEmail');
    }
};

// 在initAuth函数中添加密码强度检查
const initPasswordStrength = () => {
    const passwordInput = document.getElementById('registerPassword');
    const strengthBar = document.querySelector('.strength-bar');
    const strengthText = document.querySelector('.strength-text');
    const requirements = document.querySelectorAll('.requirement');

    const checkPasswordStrength = (password) => {
        let strength = 0;
        const checks = {
            length: password.length >= 8,
            uppercase: /[A-Z]/.test(password),
            lowercase: /[a-z]/.test(password),
            number: /[0-9]/.test(password),
            special: /[^A-Za-z0-9]/.test(password)
        };

        // 更新要求列表
        requirements.forEach(req => {
            const type = req.dataset.requirement;
            if (checks[type]) {
                req.classList.add('met');
                strength++;
            } else {
                req.classList.remove('met');
            }
        });

        // 更新强度条
        strengthBar.className = 'strength-bar';
        if (strength > 3) {
            strengthBar.classList.add('strong');
            strengthText.textContent = '密码强度: 强';
        } else if (strength > 2) {
            strengthBar.classList.add('medium');
            strengthText.textContent = '密码强度: 中';
        } else {
            strengthBar.classList.add('weak');
            strengthText.textContent = '密码强度: 弱';
        }
    };

    passwordInput.addEventListener('input', (e) => {
        checkPasswordStrength(e.target.value);
    });
};

// 添加社交媒体登录处理
const initSocialLogin = () => {
    document.querySelector('.social-btn.wechat').addEventListener('click', () => {
        // 模拟微信登录
        console.log('微信登录');
        alert('正在跳转到微信登录...');
    });

    document.querySelector('.social-btn.qq').addEventListener('click', () => {
        // 模拟QQ登录
        console.log('QQ登录');
        alert('正在跳转到QQ登录...');
    });
};

// 添加退出登录功能
const addLogoutFunction = () => {
    const loginBtn = document.getElementById('loginBtn');
    loginBtn.addEventListener('click', (e) => {
        if (loginBtn.innerHTML.includes('我的账户')) {
            e.preventDefault();
            if (confirm('确定要退出登录吗？')) {
                updateUserStatus(false);
            }
        }
    });
};

/**
 * 验证码生成和验证
 */
const initCaptcha = () => {
    const canvas = document.getElementById('captchaCanvas');
    const refreshBtn = document.querySelector('.refresh-captcha');
    let captchaText = '';

    /**
     * 生成随机验证码
     */
    const generateCaptcha = () => {
        const ctx = canvas.getContext('2d');
        canvas.width = 100;
        canvas.height = 40;

        // 生成随机字符
        const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        captchaText = '';
        
        // 绘制背景
        ctx.fillStyle = '#f0f0f0';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // 绘制文字
        ctx.font = 'bold 24px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        for (let i = 0; i < 4; i++) {
            const char = chars[Math.floor(Math.random() * chars.length)];
            captchaText += char;
            
            // 随机颜色
            ctx.fillStyle = `hsl(${Math.random() * 360}, 70%, 40%)`;
            // 随机旋转
            const rotation = (Math.random() - 0.5) * 0.3;
            
            ctx.save();
            ctx.translate(20 + i * 20, 20);
            ctx.rotate(rotation);
            ctx.fillText(char, 0, 0);
            ctx.restore();
        }

        // 添加干扰线
        for (let i = 0; i < 3; i++) {
            ctx.beginPath();
            ctx.strokeStyle = `rgba(0,0,0,0.1)`;
            ctx.moveTo(Math.random() * canvas.width, Math.random() * canvas.height);
            ctx.lineTo(Math.random() * canvas.width, Math.random() * canvas.height);
            ctx.stroke();
        }

        // 添加噪点
        for (let i = 0; i < 50; i++) {
            ctx.fillStyle = `rgba(0,0,0,0.1)`;
            ctx.fillRect(
                Math.random() * canvas.width,
                Math.random() * canvas.height,
                2,
                2
            );
        }
    };

    // 初始生成验证码
    generateCaptcha();

    // 点击刷新验证码
    canvas.addEventListener('click', generateCaptcha);
    refreshBtn.addEventListener('click', generateCaptcha);

    // 修改登录表单提交验证
    const loginForm = document.getElementById('loginForm');
    const originalSubmit = loginForm.onsubmit;
    
    loginForm.onsubmit = (e) => {
        e.preventDefault();
        const captchaInput = document.getElementById('captcha');
        
        if (captchaInput.value.toUpperCase() !== captchaText) {
            alert('验证码错误，请重新输入！');
            captchaInput.value = '';
            generateCaptcha();
            return;
        }

        // 继续原有的登录逻辑
        const email = document.getElementById('loginEmail').value;
        const password = document.getElementById('loginPassword').value;
        const rememberMe = document.getElementById('rememberMe').checked;
        
        // 模拟登录请求
        console.log('登录信息:', { email, password, rememberMe });
        
        if (rememberMe) {
            localStorage.setItem('userEmail', email);
            localStorage.setItem('isLoggedIn', 'true');
        }
        
        alert('登录成功！');
        hideModal();
        updateUserStatus(true);
    };
};

/**
 * 初始化手机登录功能
 */
const initPhoneLogin = () => {
    const switchBtns = document.querySelectorAll('.switch-btn');
    const loginTypes = document.querySelectorAll('.login-type');
    const sendCodeBtn = document.querySelector('.send-code-btn');
    const phoneInput = document.getElementById('phoneNumber');
    let countdown = 60;
    let timer = null;

    // 切换登录方式
    switchBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const type = btn.dataset.type;
            switchBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            loginTypes.forEach(form => {
                form.style.display = form.id === `${type}Login` ? 'block' : 'none';
            });
        });
    });

    // 发送验证码倒计时
    const startCountdown = () => {
        sendCodeBtn.disabled = true;
        sendCodeBtn.classList.add('counting');
        timer = setInterval(() => {
            countdown--;
            sendCodeBtn.textContent = `重新发送(${countdown}s)`;
            
            if (countdown <= 0) {
                clearInterval(timer);
                sendCodeBtn.disabled = false;
                sendCodeBtn.classList.remove('counting');
                sendCodeBtn.textContent = '发送验证码';
                countdown = 60;
            }
        }, 1000);
    };

    // 发送验证码
    sendCodeBtn.addEventListener('click', () => {
        const phone = phoneInput.value;
        if (!/^1[3-9]\d{9}$/.test(phone)) {
            alert('请输入正确的手机号码');
            return;
        }

        // 模拟发送验证码
        console.log('发送验证码到:', phone);
        alert(`验证码已发送到 ${phone}`);
        startCountdown();
    });

    // 修改登录表单提交
    const loginForm = document.getElementById('loginForm');
    const originalSubmit = loginForm.onsubmit;
    
    loginForm.onsubmit = (e) => {
        e.preventDefault();
        const activeType = document.querySelector('.switch-btn.active').dataset.type;

        if (activeType === 'phone') {
            const phone = phoneInput.value;
            const smsCode = document.getElementById('smsCode').value;
            
            if (!/^1[3-9]\d{9}$/.test(phone)) {
                alert('请输入正确的手机号码');
                return;
            }
            
            if (!/^\d{6}$/.test(smsCode)) {
                alert('请输入6位验证码');
                return;
            }

            // 模拟手机登录
            console.log('手机登录:', { phone, smsCode });
            alert('登录成功！');
            hideModal();
            updateUserStatus(true);
        } else {
            // 继续原有的邮箱登录逻辑
            originalSubmit.call(this, e);
        }
    };
};

/**
 * 初始化认证相关按钮事件
 */
const initAuthButtons = () => {
    const loginBtn = document.getElementById('loginBtn');
    const registerBtn = document.getElementById('registerBtn');
    const quickLogin = document.getElementById('quickLogin');
    const quickRegister = document.getElementById('quickRegister');
    const authTabs = document.querySelectorAll('.auth-tab');

    const showAuthModal = (tab) => {
        const modal = document.getElementById('authModal');
        modal.style.display = 'block';
        document.body.style.overflow = 'hidden';

        // 切换到对应的标签
        authTabs.forEach(t => {
            if (t.dataset.tab === tab) {
                t.click();
            }
        });
    };

    // 绑定导航栏按钮
    loginBtn.addEventListener('click', (e) => {
        e.preventDefault();
        showAuthModal('login');
    });

    registerBtn.addEventListener('click', (e) => {
        e.preventDefault();
        showAuthModal('register');
    });

    // 绑定首页快速操作按钮
    quickLogin.addEventListener('click', (e) => {
        e.preventDefault();
        showAuthModal('login');
    });

    quickRegister.addEventListener('click', (e) => {
        e.preventDefault();
        showAuthModal('register');
    });
};