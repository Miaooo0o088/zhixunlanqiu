/**
 * 初始化认证页面
 */
document.addEventListener('DOMContentLoaded', () => {
    initAuthTabs();
    initLoginTypes();
    initPasswordToggles();
    initFormValidation();
    initSendCode();
});

/**
 * 初始化认证标签页切换
 */
function initAuthTabs() {
    const tabs = document.querySelectorAll('.auth-tab');
    const forms = document.querySelectorAll('.auth-form');

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const targetForm = tab.dataset.tab;
            
            // 切换标签页激活状态
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            
            // 切换表单显示
            forms.forEach(form => {
                form.style.display = form.id === `${targetForm}Form` ? 'block' : 'none';
            });
        });
    });
}

/**
 * 初始化登录方式切换
 */
function initLoginTypes() {
    const switches = document.querySelectorAll('.switch-btn');
    const loginTypes = document.querySelectorAll('.login-type');

    switches.forEach(btn => {
        btn.addEventListener('click', () => {
            const type = btn.dataset.type;
            
            // 切换按钮激活状态
            switches.forEach(s => s.classList.remove('active'));
            btn.classList.add('active');
            
            // 切换登录方式显示
            loginTypes.forEach(login => {
                login.style.display = login.id === `${type}Login` ? 'block' : 'none';
            });
        });
    });
}

/**
 * 初始化密码显示切换
 */
function initPasswordToggles() {
    const toggles = document.querySelectorAll('.toggle-password');
    
    toggles.forEach(toggle => {
        toggle.addEventListener('click', () => {
            const input = toggle.parentElement.querySelector('input');
            const icon = toggle.querySelector('i');
            
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
 * 初始化表单验证
 */
function initFormValidation() {
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');

    loginForm.addEventListener('submit', handleLogin);
    registerForm.addEventListener('submit', handleRegister);
}

/**
 * 处理登录提交
 */
async function handleLogin(e) {
    e.preventDefault();
    const form = e.target;
    const type = form.querySelector('.switch-btn.active').dataset.type;
    
    try {
        if (type === 'email') {
            const email = form.querySelector('#email').value;
            const password = form.querySelector('#password').value;
            await loginWithEmail(email, password);
        } else {
            const phone = form.querySelector('#phone').value;
            const code = form.querySelector('#smsCode').value;
            await loginWithPhone(phone, code);
        }
        
        // 登录成功后跳转
        window.location.href = 'index.html';
    } catch (err) {
        showError('登录失败，请检查账号密码');
    }
}

/**
 * 处理注册提交
 */
async function handleRegister(e) {
    e.preventDefault();
    const form = e.target;
    
    try {
        const data = {
            username: form.querySelector('#regUsername').value,
            phone: form.querySelector('#regPhone').value,
            code: form.querySelector('#regCode').value,
            password: form.querySelector('#regPassword').value,
            confirmPassword: form.querySelector('#regConfirmPassword').value
        };
        
        // 验证密码
        if (data.password !== data.confirmPassword) {
            throw new Error('两次输入的密码不一致');
        }
        
        await register(data);
        showSuccess('注册成功');
        
        // 切换到登录页
        document.querySelector('[data-tab="login"]').click();
    } catch (err) {
        showError(err.message || '注册失败，请重试');
    }
}

/**
 * 初始化发送验证码功能
 */
function initSendCode() {
    const sendButtons = document.querySelectorAll('.send-code-btn');
    
    sendButtons.forEach(btn => {
        btn.addEventListener('click', async () => {
            const input = btn.parentElement.parentElement.querySelector('input[type="tel"]');
            const phone = input.value;
            
            if (!/^1[3-9]\d{9}$/.test(phone)) {
                showError('请输入正确的手机号');
                return;
            }
            
            try {
                await sendVerificationCode(phone);
                startCountdown(btn);
            } catch (err) {
                showError('发送验证码失败，请重试');
            }
        });
    });
}

/**
 * 开始倒计时
 */
function startCountdown(button, seconds = 60) {
    button.disabled = true;
    const originalText = button.textContent;
    
    const countdown = setInterval(() => {
        button.textContent = `${seconds}秒后重试`;
        seconds--;
        
        if (seconds < 0) {
            clearInterval(countdown);
            button.disabled = false;
            button.textContent = originalText;
        }
    }, 1000);
}

/**
 * 显示错误提示
 */
function showError(message) {
    // 实现错误提示UI
    alert(message);
}

/**
 * 显示成功提示
 */
function showSuccess(message) {
    // 实现成功提示UI
    alert(message);
}

// ... 从main.js复制其他相关函数 ...
// initPhoneLogin()
// initCaptcha()
// initPasswordStrength()
// initSocialLogin() 