document.addEventListener('DOMContentLoaded', () => {
    initCarousel();
    initAnimations();
    initInteractions();
});

/**
 * 初始化轮播图
 */
function initCarousel() {
    const track = document.querySelector('.carousel-track');
    const slides = document.querySelectorAll('.carousel-slide');
    const nextButton = document.querySelector('.carousel-btn.next');
    const prevButton = document.querySelector('.carousel-btn.prev');
    const dotsContainer = document.querySelector('.carousel-dots');
    
    let currentIndex = 0;
    const slideWidth = slides[0].getBoundingClientRect().width;
    
    // 创建导航点
    slides.forEach((_, index) => {
        const dot = document.createElement('div');
        dot.classList.add('dot');
        if (index === 0) dot.classList.add('active');
        dot.addEventListener('click', () => goToSlide(index));
        dotsContainer.appendChild(dot);
    });
    
    // 更新轮播图位置
    function updateCarousel() {
        track.style.transform = `translateX(-${currentIndex * slideWidth}px)`;
        document.querySelectorAll('.dot').forEach((dot, index) => {
            dot.classList.toggle('active', index === currentIndex);
        });
    }
    
    // 切换到指定幻灯片
    function goToSlide(index) {
        currentIndex = index;
        updateCarousel();
    }
    
    // 下一张
    function nextSlide() {
        currentIndex = (currentIndex + 1) % slides.length;
        updateCarousel();
    }
    
    // 上一张
    function prevSlide() {
        currentIndex = (currentIndex - 1 + slides.length) % slides.length;
        updateCarousel();
    }
    
    nextButton.addEventListener('click', nextSlide);
    prevButton.addEventListener('click', prevSlide);
    
    // 自动播放
    setInterval(nextSlide, 5000);
}

/**
 * 初始化动画
 */
function initAnimations() {
    // 监听元素进入视口
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('animate');
            }
        });
    });
    
    // 观察需要动画的元素
    document.querySelectorAll('.feature-card, .stat-item, .testimonial-card').forEach(el => {
        observer.observe(el);
    });
}

/**
 * 初始化交互功能
 */
function initInteractions() {
    // 数字增长动画
    document.querySelectorAll('.stat-item h3').forEach(el => {
        const finalValue = parseInt(el.textContent);
        let currentValue = 0;
        const duration = 2000;
        const increment = finalValue / (duration / 16);
        
        function updateValue() {
            if (currentValue < finalValue) {
                currentValue += increment;
                el.textContent = Math.round(currentValue).toLocaleString();
                requestAnimationFrame(updateValue);
            } else {
                el.textContent = finalValue.toLocaleString();
            }
        }
        
        updateValue();
    });
} 