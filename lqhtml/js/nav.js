/**
 * 导航栏相关功能
 */
document.addEventListener('DOMContentLoaded', () => {
    initMobileNav();
    setActiveNavLink();
});

/**
 * 初始化移动端导航
 */
function initMobileNav() {
    const navToggle = document.querySelector('.nav-toggle');
    const navLinks = document.querySelector('.nav-links');

    navToggle?.addEventListener('click', () => {
        navLinks.classList.toggle('active');
    });

    // 点击导航链接后自动关闭菜单
    document.querySelectorAll('.nav-links a').forEach(link => {
        link.addEventListener('click', () => {
            navLinks.classList.remove('active');
        });
    });

    // 点击页面其他区域关闭菜单
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.nav-toggle') && !e.target.closest('.nav-links')) {
            navLinks.classList.remove('active');
        }
    });
}

/**
 * 设置当前页面的导航链接为激活状态
 */
function setActiveNavLink() {
    const currentPath = window.location.pathname;
    const navLinks = document.querySelectorAll('.nav-links a');

    navLinks.forEach(link => {
        // 移除所有active类
        link.classList.remove('active');
        
        // 获取链接的路径
        const linkPath = link.getAttribute('href');
        
        // 如果当前页面路径包含链接路径,则添加active类
        if (currentPath.includes(linkPath) && linkPath !== 'index.html') {
            link.classList.add('active');
        }
        
        // 特殊处理首页
        if (currentPath.endsWith('/') || currentPath.endsWith('index.html')) {
            if (linkPath === 'index.html') {
                link.classList.add('active');
            }
        }
    });
}

/**
 * 页面跳转前的过渡动画
 */
document.querySelectorAll('.nav-links a').forEach(link => {
    link.addEventListener('click', (e) => {
        e.preventDefault();
        const href = link.getAttribute('href');
        
        // 添加页面退出动画
        document.body.classList.add('page-exit');
        
        // 等待动画完成后跳转
        setTimeout(() => {
            window.location.href = href;
        }, 300);
    });
}); 