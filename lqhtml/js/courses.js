/**
 * 课程页面逻辑
 */
document.addEventListener('DOMContentLoaded', () => {
    initCourseFilters();
    loadCourses();
});

/**
 * 初始化课程筛选器
 */
const initCourseFilters = () => {
    const filters = document.querySelectorAll('.filter-btn');
    const courses = document.querySelectorAll('.course-card');

    filters.forEach(filter => {
        filter.addEventListener('click', () => {
            // 移除所有active类
            filters.forEach(f => f.classList.remove('active'));
            filter.classList.add('active');

            const category = filter.dataset.category;

            // 筛选课程
            courses.forEach(course => {
                if (category === 'all' || course.dataset.category === category) {
                    course.style.display = 'block';
                } else {
                    course.style.display = 'none';
                }
            });
        });
    });
};

/**
 * 加载课程列表
 * @param {string} type - 课程类型
 */
const loadCourses = async (type = 'all') => {
    try {
        const courses = await fetchCourses(type);
        renderCourses(courses);
    } catch (err) {
        console.error('加载课程失败:', err);
    }
};

/**
 * 课程报名
 * @param {number} courseId - 课程ID
 */
const enrollCourse = async (courseId) => {
    try {
        await enrollToCourse(courseId);
        showSuccessMessage('报名成功');
    } catch (err) {
        showErrorMessage('报名失败');
    }
}; 