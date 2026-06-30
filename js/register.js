document.addEventListener('DOMContentLoaded', () => {
    initPasswordStrength();
    initPasswordToggles();
    initVerificationCode();
    initFormValidation();
});

/**
 * 初始化密码强度检测
 */
function initPasswordStrength() {
    const passwordInput = document.getElementById('password');
    const strengthBar = document.querySelector('.strength-bar');
    const strengthText = document.querySelector('.strength-text');

    passwordInput.addEventListener('input', () => {
        const password = passwordInput.value;
        const strength = checkPasswordStrength(password);
        updateStrengthIndicator(strength, strengthBar, strengthText);
    });
}

/**
 * 检查密码强度
 */
function checkPasswordStrength(password) {
    let score = 0;
    
    // 长度检查
    if (password.length >= 8) score++;
    if (password.length >= 12) score++;
    
    // 包含数字
    if (/\d/.test(password)) score++;
    
    // 包含小写字母
    if (/[a-z]/.test(password)) score++;
    
    // 包含大写字母
    if (/[A-Z]/.test(password)) score++;
    
    // 包含特殊字符
    if (/[!@#$%^&*]/.test(password)) score++;

    if (score < 3) return 'weak';
    if (score < 5) return 'medium';
    return 'strong';
}

/**
 * 更新密码强度指示器
 */
function updateStrengthIndicator(strength, bar, text) {
    // 移除所有强度类
    bar.classList.remove('weak', 'medium', 'strong');
    
    // 添加当前强度类
    bar.classList.add(strength);
    
    // 更新文本
    const strengthTexts = {
        weak: '弱',
        medium: '中',
        strong: '强'
    };
    
    text.textContent = `密码强度：${strengthTexts[strength]}`;
}

/**
 * 初始化表单验证
 */
function initFormValidation() {
    const form = document.getElementById('registerForm');
    const password = document.getElementById('password');
    const confirmPassword = document.getElementById('confirmPassword');
    
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        if (password.value !== confirmPassword.value) {
            alert('两次输入的密码不一致');
            return;
        }
        
        try {
            // 这里添加注册逻辑
            await registerUser(form);
            window.location.href = 'auth.html';
        } catch (error) {
            alert(error.message || '注册失败，请重试');
        }
    });
}

/**
 * 初始化验证码功能
 */
function initVerificationCode() {
    const sendButton = document.querySelector('.send-code-btn');
    const phoneInput = document.getElementById('phone');
    
    sendButton.addEventListener('click', async () => {
        const phone = phoneInput.value;
        
        // 验证手机号格式
        if (!/^1[3-9]\d{9}$/.test(phone)) {
            showToast('请输入正确的手机号码');
            return;
        }
        
        try {
            // 禁用按钮并开始倒计时
            startCountdown(sendButton);
            
            // 发送验证码请求
            await sendVerificationCode(phone);
            showToast('验证码已发送');
        } catch (error) {
            showToast('发送失败，请重试');
            // 恢复按钮状态
            resetSendButton(sendButton);
        }
    });
}

/**
 * 初始化密码显示/隐藏功能
 */
function initPasswordToggles() {
    const toggleButtons = document.querySelectorAll('.toggle-password');
    
    toggleButtons.forEach(button => {
        button.addEventListener('click', () => {
            const input = button.parentElement.querySelector('input');
            const icon = button.querySelector('i');
            
            // 切换密码显示状态
            if (input.type === 'password') {
                input.type = 'text';
                icon.classList.remove('fa-eye');
                icon.classList.add('fa-eye-slash');
            } else {
                input.type = 'password';
                icon.classList.remove('fa-eye-slash');
                icon.classList.add('fa-eye');
            }
        });
    });
}

/**
 * 开始倒计时
 * @param {HTMLButtonElement} button - 发送验证码按钮
 */
function startCountdown(button) {
    let seconds = 60;
    button.disabled = true;
    const originalText = button.textContent;
    
    const countdown = setInterval(() => {
        seconds--;
        button.textContent = `${seconds}秒后重试`;
        
        if (seconds <= 0) {
            clearInterval(countdown);
            resetSendButton(button, originalText);
        }
    }, 1000);
}

/**
 * 重置发送按钮状态
 * @param {HTMLButtonElement} button - 发送验证码按钮
 * @param {string} text - 按钮文本
 */
function resetSendButton(button, text = '获取验证码') {
    button.disabled = false;
    button.textContent = text;
}

/**
 * 显示提示信息
 * @param {string} message - 提示信息
 */
function showToast(message) {
    // 创建toast元素
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    
    // 添加到页面
    document.body.appendChild(toast);
    
    // 触发动画
    setTimeout(() => toast.classList.add('show'), 10);
    
    // 3秒后移除
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

/**
 * 发送验证码到服务器
 * @param {string} phone - 手机号
 */
async function sendVerificationCode(phone) {
    // 这里添加实际的验证码发送逻辑
    return new Promise((resolve) => {
        setTimeout(resolve, 1000);
    });
}

/**
 * 注册用户
 * @param {HTMLFormElement} form - 注册表单
 */
async function registerUser(form) {
    const formData = new FormData(form);
    const data = Object.fromEntries(formData.entries());
    
    // 这里添加实际的注册逻辑
    return new Promise((resolve) => {
        setTimeout(resolve, 1500);
    });
} 