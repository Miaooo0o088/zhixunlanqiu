document.addEventListener('DOMContentLoaded', () => {
    initPasswordStrength();
    initPasswordToggles();
    initVerificationCode();
    initFormValidation();
});

/**
 * 初始化表单验证
 */
function initFormValidation() {
    const form = document.getElementById('resetPasswordForm');
    const newPassword = document.getElementById('newPassword');
    const confirmPassword = document.getElementById('confirmPassword');
    
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        if (newPassword.value !== confirmPassword.value) {
            showToast('两次输入的密码不一致');
            return;
        }
        
        try {
            await resetPassword(form);
            showToast('密码重置成功');
            // 延迟跳转到登录页
            setTimeout(() => {
                window.location.href = 'auth.html';
            }, 1500);
        } catch (error) {
            showToast(error.message || '重置失败，请重试');
        }
    });
}

/**
 * 重置密码
 * @param {HTMLFormElement} form - 重置密码表单
 */
async function resetPassword(form) {
    const formData = new FormData(form);
    const data = Object.fromEntries(formData.entries());
    
    // 这里添加实际的重置密码逻辑
    return new Promise((resolve) => {
        setTimeout(resolve, 1500);
    });
}

// 复用 register.js 中的其他函数
// initPasswordStrength()
// initPasswordToggles()
// initVerificationCode()
// showToast()
// startCountdown()
// resetSendButton()
// sendVerificationCode() 