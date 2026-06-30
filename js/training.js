/**
 * 训练页面逻辑
 */
document.addEventListener('DOMContentLoaded', () => {
    initTrainingStats();
    initTrainingHistory();
    initAnalysis();
});

/**
 * 更新训练统计显示
 * @param {object} stats - 统计数据
 */
const updateStatsDisplay = (stats) => {
    if (!stats) return;

    // 假设HTML中有对应的元素
    const totalTimeEl = document.getElementById('totalTime');
    const trainingDaysEl = document.getElementById('trainingDays');
    const shootingAccuracyEl = document.getElementById('shootingAccuracy');
    const caloriesBurnedEl = document.getElementById('caloriesBurned');

    if (totalTimeEl) totalTimeEl.textContent = (stats.totalTime / 60).toFixed(1);
    if (trainingDaysEl) trainingDaysEl.textContent = stats.trainingDays;
    if (shootingAccuracyEl) shootingAccuracyEl.textContent = `${stats.shootingAccuracy}%`;
    if (caloriesBurnedEl) caloriesBurnedEl.textContent = stats.caloriesBurned.toLocaleString();
};

/**
 * 初始化训练数据统计
 */
const initTrainingStats = async () => {
    // 从API获取训练数据
    try {
        const stats = await fetchTrainingStats();
        // 更新统计显示
        updateStatsDisplay(stats);
    } catch (error) {
        console.error('获取训练统计数据失败:', error);
    }
};

/**
 * 初始化训练历史记录
 */
const initTrainingHistory = async () => {
    try {
        // 优先从LocalStorage加载历史记录
        const localHistory = JSON.parse(localStorage.getItem('trainingHistory')) || [];
        if (localHistory.length > 0) {
            const recordsList = document.querySelector('.training-records');
            if (recordsList) {
                recordsList.innerHTML = ''; // 清空现有记录
                localHistory.sort((a, b) => new Date(b.date) - new Date(a.date)).forEach(record => {
                    addRecordToHistory(record);
                });
            }
            return;
        }

        // 如果本地没有，则加载模拟数据（仅首次）
        const history = await fetchTrainingHistory();
        const recordsList = document.querySelector('.training-records');
        if (recordsList) {
            recordsList.innerHTML = ''; // 清空现有记录
            history.forEach(record => {
                addRecordToHistory(record);
            });
        }
    } catch (error) {
        console.error('获取训练历史记录失败:', error);
    }
};

/**
 * 全局变量
 */
let cameraStream = null; // 存储相机流
let hasPermission = false; // 存储相机权限状态
let isTraining = false; // 存储训练状态
let currentCamera = 'user'; // 当前使用的相机('user'为前置,'environment'为后置)
let detectionModel = null; // 姿态检测模型
let detector = null; // 姿态检测器
let detectionInterval = null; // 检测间隔
let trainingStartTime = null; // 训练开始时间
let referencePose = null; // 参考姿态
let dynamicGuides = {}; // 动态参考线坐标
let sessionData = {}; // 本次训练会话的数据

// AI分析相关变量
let isAnalysisEnabled = false;

// 姿势连接关系定义
const poseConnections = [
    ['head', 'neck'],
    ['neck', 'shoulder_l'], ['neck', 'shoulder_r'],
    ['shoulder_l', 'elbow_l'], ['shoulder_r', 'elbow_r'],
    ['elbow_l', 'wrist_l'], ['elbow_r', 'wrist_r'],
    ['neck', 'hip_l'], ['neck', 'hip_r'],
    ['hip_l', 'knee_l'], ['hip_r', 'knee_r'],
    ['knee_l', 'ankle_l'], ['knee_r', 'ankle_r']
];

// 动作轨迹历史
const trajectoryHistory = new Map();
const maxTrajectoryPoints = 30;

// 标准动作参考数据
const standardPoses = {
    shooting: {
        preparation: {
            description: '准备姿势',
            keyPoints: {
                knee_angle: 120,
                elbow_angle: 90,
                ball_position: 'chest_height'
            }
        },
        release: {
            description: '出手阶段',
            keyPoints: {
                wrist_angle: 70,
                release_point: 'above_head',
                follow_through: true
            }
        }
    },
    dribbling: {
        basic: {
            description: '基础运球',
            keyPoints: {
                knee_bend: 'slight',
                ball_height: 'waist',
                body_balance: true
            }
        }
    }
};

/**
 * 请求相机权限
 * @param {string} type - 训练类型(shooting/dribbling)
 */
function requestCamera(type) {
    if (hasPermission && cameraStream) {
        // 如果已有权限，直接开始训练
        startTrainingSession(type);
        return;
    }

    const modal = document.getElementById('cameraModal');
    modal.classList.add('active');
    modal.dataset.trainingType = type;
}

/**
 * 切换摄像头
 */
async function switchCamera() {
    if (!cameraStream) return;
    
    // 停止当前相机流
    cameraStream.getTracks().forEach(track => track.stop());
    
    // 切换相机方向
    currentCamera = currentCamera === 'user' ? 'environment' : 'user';
    
    try {
        // 获取新的相机流
        cameraStream = await navigator.mediaDevices.getUserMedia({
            video: true
        });
        
        // 更新视频元素
        const videoElement = document.getElementById('camera');
        videoElement.srcObject = cameraStream;
        await videoElement.play();
        
        // 更新切换按钮图标
        const toggleBtn = document.getElementById('toggleCamera');
        toggleBtn.innerHTML = `
            <i class="fas fa-${currentCamera === 'user' ? 'camera' : 'camera-rotate'}"></i>
            <span>${currentCamera === 'user' ? '前置' : '后置'}相机</span>
        `;
        
    } catch (err) {
        console.error('切换相机失败:', err);
        alert('切换相机失败，请检查设备是否有多个相机');
    }
}

/**
 * 开始训练
 */
async function startTraining() {
    const modal = document.getElementById('cameraModal');
    const type = modal.dataset.trainingType;
    
    try {
        // 请求相机权限
        cameraStream = await navigator.mediaDevices.getUserMedia({
            video: true
        });
        hasPermission = true;
        
        // 将相机流连接到视频元素
        const videoElement = document.getElementById('camera');
        videoElement.srcObject = cameraStream;
        
        // 等待视频加载完成
        await videoElement.play();
        
        // 开始训练会话
        startTrainingSession(type);
        
        // 关闭弹窗
        closeModal();
        
    } catch (err) {
        console.error('相机访问失败:', err);
        if (err.name === 'NotFoundError') {
            alert('未检测到摄像头设备，请检查设备或使用带摄像头的设备访问。');
        } else {
            alert('无法访问相机，请确保已授予相机权限');
        }
        closeModal();
    }
}

/**
 * 开始训练会话
 * @param {string} type - 训练类型
 */
function startTrainingSession(type) {
    isTraining = true;
    trainingStartTime = Date.now();
    referencePose = null; // 重置参考姿态
    dynamicGuides = {}; // 重置参考线坐标
    sessionData = { // 初始化会话数据
        scores: {
            accuracy: [],
            smoothness: []
        },
        feedbackCounts: {}
    };

    const card = document.querySelector(`.training-card[data-type="${type}"]`);
    const startBtn = card.querySelector('.start-btn');
    
    // 更新按钮状态
    startBtn.innerHTML = `
        <span>
            <i class="fas fa-stop"></i>
            结束训练
        </span>
    `;
    startBtn.classList.add('training-active');
    startBtn.onclick = () => endTrainingSession(type);

    // 显示相机视图
    const videoContainer = document.querySelector('.video-container');
    videoContainer.style.display = 'flex';
    videoContainer.scrollIntoView({ behavior: 'smooth' });

    // 设置动作参考
    setPoseReference(type);

    // 确保视频元素正确显示
    const videoElement = document.getElementById('camera');
    videoElement.style.display = 'block';
    videoElement.style.width = '100%';
    videoElement.style.height = '100%';
    videoElement.style.objectFit = 'cover';

    // 开始姿势检测
    startPoseDetection(document.getElementById('camera'), type);
}

/**
 * 结束训练会话
 * @param {string} type - 训练类型
 */
function endTrainingSession(type) {
    isTraining = false;
    
    // 停止检测循环，避免在显示报告时还在后台运行
    if (detectionInterval) {
        clearInterval(detectionInterval);
        detectionInterval = null;
    }
    
    // 显示训练总结报告
    showTrainingSummary(type);
}

/**
 * 显示训练总结报告
 * @param {string} type - 训练类型
 */
function showTrainingSummary(type) {
    const modal = document.getElementById('reportModal');
    if (!modal) return;

    // --- 数据处理 ---
    const accuracyScores = sessionData.scores.accuracy;
    const smoothnessScores = sessionData.scores.smoothness;

    const avgAccuracy = accuracyScores.length > 0 
        ? (accuracyScores.reduce((a, b) => a + b, 0) / accuracyScores.length).toFixed(1)
        : 0;
    
    const avgSmoothness = smoothnessScores.length > 0
        ? (smoothnessScores.reduce((a, b) => a + b, 0) / smoothnessScores.length).toFixed(1)
        : 0;

    const duration = calculateTrainingDuration();

    // 找出最常见的反馈
    let coachTip = '动作非常标准，请继续保持！';
    if (Object.keys(sessionData.feedbackCounts).length > 0) {
        coachTip = Object.entries(sessionData.feedbackCounts).sort((a, b) => b[1] - a[1])[0][0];
    }
    
    // --- 填充UI ---
    document.getElementById('report-accuracy').textContent = `${avgAccuracy}%`;
    document.getElementById('report-smoothness').textContent = `${avgSmoothness}%`;
    document.getElementById('report-duration').textContent = duration;
    document.getElementById('report-coach-tip').textContent = coachTip;

    // --- 绘制图表 ---
    const ctx = document.getElementById('accuracyChart').getContext('2d');
    if (window.accuracyChart instanceof Chart) {
        window.accuracyChart.destroy();
    }
    window.accuracyChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: accuracyScores.map((_, i) => i + 1),
            datasets: [{
                label: '准确度变化',
                data: accuracyScores,
                borderColor: 'rgba(var(--primary-rgb), 0.8)',
                backgroundColor: 'rgba(var(--primary-rgb), 0.2)',
                fill: true,
                tension: 0.3
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: { display: false },
                title: { display: true, text: '表现趋势' }
            },
            scales: {
                y: { min: 0, max: 100, ticks: { stepSize: 20 } }
            }
        }
    });

    // --- 显示模态框并设置关闭逻辑 ---
    modal.classList.add('active');

    const saveBtn = document.getElementById('saveReportBtn');
    
    const saveAndCloseHandler = () => {
        modal.classList.remove('active');
        
        // 执行最终的清理工作
        const card = document.querySelector(`.training-card[data-type="${type}"]`);
        const startBtn = card.querySelector('.start-btn');
        startBtn.innerHTML = `<span><i class="fas fa-play"></i> 开始训练</span>`;
        startBtn.classList.remove('training-active');
        startBtn.onclick = () => requestCamera(type);

        document.querySelectorAll('.dynamic-guide').forEach(el => el.remove());
        if (cameraStream) {
            cameraStream.getTracks().forEach(track => track.stop());
            cameraStream = null;
        }

        // 保存一条简化的记录到列表
        saveTrainingRecord(type, {
            accuracy: `${avgAccuracy}%`,
            smoothness: `${avgSmoothness}%`,
            duration: duration,
            accuracyHistory: accuracyScores,
            feedbackCounts: sessionData.feedbackCounts
        });

        // 重置状态
        referencePose = null;
        dynamicGuides = {};
        trainingStartTime = null;

        saveBtn.removeEventListener('click', saveAndCloseHandler);
    };

    saveBtn.addEventListener('click', saveAndCloseHandler, { once: true });
}

/**
 * 关闭相机权限提示
 */
function closeModal() {
    const modal = document.getElementById('cameraModal');
    modal.classList.remove('active');
}

/**
 * 开始姿势检测
 * @param {HTMLVideoElement} video - 视频元素
 * @param {string} type - 训练类型
 */
async function startPoseDetection(video, type) {
    try {
        // 加载MoveNet模型
        if (!detector) {
            detectionModel = poseDetection.SupportedModels.MoveNet;
            
            // 创建检测器配置
            const modelConfig = {
                modelType: poseDetection.movenet.modelType.SINGLEPOSE_THUNDER,
                enableSmoothing: true
            };
            
            // 创建检测器
            detector = await poseDetection.createDetector(detectionModel, modelConfig);
        }

        // 初始化姿势标记点
        initializePoseMarkers();

        // 开始实时检测
        detectionInterval = setInterval(async () => {
            // 使用MoveNet进行姿势检测
            const poses = await detector.estimatePoses(video);

            if (poses.length > 0) {
                const pose = poses[0];

                // 如果没有参考姿态，则设置一个
                if (!referencePose && pose.score > 0.75) {
                    referencePose = pose;
                    drawDynamicReferenceLines(referencePose, type);
                }
                
                // MoveNet返回的关键点格式与PoseNet不同，需要进行转换
                const convertedPose = convertMoveNetPose(pose, video.videoWidth);
                updatePoseVisualization(convertedPose);
                if(isAnalysisEnabled){
                     analyzeTrainingForm(convertedPose, type);
                }
            }
        }, 100);

    } catch (error) {
        console.error('姿势检测初始化失败:', error);
        alert('AI模型加载失败，请检查网络连接');
    }
}

/**
 * 将MoveNet的姿势数据转换为与PoseNet兼容的格式
 * @param {Object} moveNetPose - MoveNet检测到的姿势数据
 * @returns {Object} 转换后的姿势数据
 */
function convertMoveNetPose(moveNetPose,imgWidth) {
    // 根据当前相机类型决定映射方式
    // 'user'为前置相机（已经是镜像的），不需要交换左右
    // 'environment'为后置相机，需要交换左右
    
    // MoveNet关键点名称与PoseNet名称的对应关系
    let keyPointMap;
    
    // 前置相机模式下使用直接映射
    if (currentCamera === 'user') {
        keyPointMap = [
            { movenet: 'nose', posenet: 'nose' },
            { movenet: 'left_eye', posenet: 'leftEye' },
            { movenet: 'right_eye', posenet: 'rightEye' },
            { movenet: 'left_ear', posenet: 'leftEar' },
            { movenet: 'right_ear', posenet: 'rightEar' },
            { movenet: 'left_shoulder', posenet: 'leftShoulder' },
            { movenet: 'right_shoulder', posenet: 'rightShoulder' },
            { movenet: 'left_elbow', posenet: 'leftElbow' },
            { movenet: 'right_elbow', posenet: 'rightElbow' },
            { movenet: 'left_wrist', posenet: 'leftWrist' },
            { movenet: 'right_wrist', posenet: 'rightWrist' },
            { movenet: 'left_hip', posenet: 'leftHip' },
            { movenet: 'right_hip', posenet: 'rightHip' },
            { movenet: 'left_knee', posenet: 'leftKnee' },
            { movenet: 'right_knee', posenet: 'rightKnee' },
            { movenet: 'left_ankle', posenet: 'leftAnkle' },
            { movenet: 'right_ankle', posenet: 'rightAnkle' }
        ];
    } 
    // 后置相机模式下交换左右
    else {
        keyPointMap = [
            { movenet: 'nose', posenet: 'nose' },
            { movenet: 'left_eye', posenet: 'rightEye' },
            { movenet: 'right_eye', posenet: 'leftEye' },
            { movenet: 'left_ear', posenet: 'rightEar' },
            { movenet: 'right_ear', posenet: 'leftEar' },
            { movenet: 'left_shoulder', posenet: 'rightShoulder' },
            { movenet: 'right_shoulder', posenet: 'leftShoulder' },
            { movenet: 'left_elbow', posenet: 'rightElbow' },
            { movenet: 'right_elbow', posenet: 'leftElbow' },
            { movenet: 'left_wrist', posenet: 'rightWrist' },
            { movenet: 'right_wrist', posenet: 'leftWrist' },
            { movenet: 'left_hip', posenet: 'rightHip' },
            { movenet: 'right_hip', posenet: 'leftHip' },
            { movenet: 'left_knee', posenet: 'rightKnee' },
            { movenet: 'right_knee', posenet: 'leftKnee' },
            { movenet: 'left_ankle', posenet: 'rightAnkle' },
            { movenet: 'right_ankle', posenet: 'leftAnkle' }
        ];
    }
    
    // 转换关键点数据
    const keypoints = moveNetPose.keypoints.map(point => {
        // 根据名称查找对应的PoseNet名称
        const mapping = keyPointMap.find(m => m.movenet === point.name);
        const partName = mapping ? mapping.posenet : point.name;
        
        let x = point.x;
        // 前置摄像头需要水平翻转坐标以实现镜像效果
        if (currentCamera === 'user') {
            x = imgWidth - point.x;
        }

        return {
            part: partName,
            position: {
                x: x,
                y: point.y
            },
            score: point.score
        };
    });
    
    return {
        keypoints,
        score: moveNetPose.score || 1.0
    };
}

/**
 * 初始化姿势标记点
 */
function initializePoseMarkers() {
    const poseMarkers = document.querySelector('.pose-markers');
    poseMarkers.innerHTML = '';

    // 创建关键点标记
    const keyPoints = [
        'nose', 'leftEye', 'rightEye', 'leftEar', 'rightEar',
        'leftShoulder', 'rightShoulder', 'leftElbow', 'rightElbow',
        'leftWrist', 'rightWrist', 'leftHip', 'rightHip',
        'leftKnee', 'rightKnee', 'leftAnkle', 'rightAnkle'
    ];

    keyPoints.forEach(point => {
        const marker = document.createElement('div');
        marker.className = 'pose-marker';
        marker.dataset.point = point;
        poseMarkers.appendChild(marker);
    });

    // 创建骨架连接线容器
    const skeletonContainer = document.createElement('div');
    skeletonContainer.className = 'pose-skeleton';
    poseMarkers.appendChild(skeletonContainer);
}

/**
 * 更新姿势可视化
 * @param {Object} pose - 检测到的姿势数据
 */
function updatePoseVisualization(pose) {
    const poseMarkers = document.querySelector('.pose-markers');
    const video = document.getElementById('camera');
    const keypoints = pose.keypoints;

    // 更新关键点位置
    keypoints.forEach(point => {
        const marker = poseMarkers.querySelector(`[data-point="${point.part}"]`);
        if (marker) {
            // 计算相对于视频容器的位置百分比
            const x = (point.position.x / video.videoWidth) * 100;
            const y = (point.position.y / video.videoHeight) * 100;
            marker.style.left = `${x}%`;
            marker.style.top = `${y}%`;
            // 根据置信度设置标记点的透明度
            marker.style.opacity = point.score > 0.5 ? 1 : 0.3;
            marker.style.transform = `scale(${point.score})`;
        }
    });

    // 更新骨架连接线
    updateSkeletonLines(keypoints);
}

/**
 * 更新骨架连接线
 * @param {Array} keypoints - 关键点数据
 */
function updateSkeletonLines(keypoints) {
    const skeletonContainer = document.querySelector('.pose-skeleton');
    skeletonContainer.innerHTML = '';

    // 定义骨架连接
    const skeleton = [
        ['leftShoulder', 'rightShoulder'],
        ['leftShoulder', 'leftElbow'],
        ['rightShoulder', 'rightElbow'],
        ['leftElbow', 'leftWrist'],
        ['rightElbow', 'rightWrist'],
        ['leftShoulder', 'leftHip'],
        ['rightShoulder', 'rightHip'],
        ['leftHip', 'rightHip'],
        ['leftHip', 'leftKnee'],
        ['rightHip', 'rightKnee'],
        ['leftKnee', 'leftAnkle'],
        ['rightKnee', 'rightAnkle']
    ];

    // 绘制连接线
    skeleton.forEach(([start, end]) => {
        const startPoint = keypoints.find(kp => kp.part === start);
        const endPoint = keypoints.find(kp => kp.part === end);

        if (startPoint && endPoint && startPoint.score > 0.5 && endPoint.score > 0.5) {
            drawSkeletonLine(startPoint.position, endPoint.position);
        }
    });
}

/**
 * 绘制骨架连接线
 * @param {Object} start - 起始点坐标
 * @param {Object} end - 终点坐标
 */
function drawSkeletonLine(start, end) {
    const video = document.getElementById('camera');
    const skeletonContainer = document.querySelector('.pose-skeleton');

    const startX = (start.x / video.videoWidth) * 100;
    const startY = (start.y / video.videoHeight) * 100;
    const endX = (end.x / video.videoWidth) * 100;
    const endY = (end.y / video.videoHeight) * 100;

    const length = Math.sqrt(Math.pow(endX - startX, 2) + Math.pow(endY - startY, 2));
    const angle = Math.atan2(endY - startY, endX - startX) * 180 / Math.PI;

    const line = document.createElement('div');
    line.className = 'skeleton-line';
    line.style.width = `${length}%`;
    line.style.left = `${startX}%`;
    line.style.top = `${startY}%`;
    line.style.transform = `rotate(${angle}deg)`;

    skeletonContainer.appendChild(line);
}

/**
 * 分析训练动作
 * @param {Object} pose - 检测到的姿势数据
 * @param {string} type - 训练类型
 */
function analyzeTrainingForm(pose, type) {
    let accuracy = 0;
    let smoothness = 0;
    let feedback = '';
    let highlights = [];
    let activations = [];

    const keypoints = pose.keypoints;

    // 动态判断使用哪一侧的身体
    const leftShoulder = getKeypoint(keypoints, 'leftShoulder');
    const rightShoulder = getKeypoint(keypoints, 'rightShoulder');
    // 默认使用右侧，如果左肩更靠前（x坐标更小），则使用左侧
    const side = (leftShoulder.position.x < rightShoulder.position.x) ? 'left' : 'right';

    if (type === 'shooting') {
        // 分析投篮姿势
        const result = analyzeShootingForm(keypoints, side);
        accuracy = result.score;
        smoothness = analyzeMovementSmoothness(keypoints, side);
        feedback = result.feedback;
        highlights = result.highlights;
        activations = result.activations;
    } else {
        // 分析运球姿势
        const result = analyzeDribblingForm(keypoints, side);
        accuracy = result.score;
        smoothness = analyzeMovementStability(keypoints);
        feedback = result.feedback;
        highlights = result.highlights;
        activations = result.activations;
    }

    // 更新分析指标
    updateMetrics({
        accuracy: accuracy.toFixed(1),
        smoothness: smoothness.toFixed(1)
    });

    // 收集数据供报告使用
    sessionData.scores.accuracy.push(accuracy);
    sessionData.scores.smoothness.push(smoothness);
    if (feedback) {
        sessionData.feedbackCounts[feedback] = (sessionData.feedbackCounts[feedback] || 0) + 1;
    }

    // 更新文字反馈
    updateFeedback(feedback);

    // 更新高亮显示
    updateHighlights(highlights);

    // 更新激活状态
    updateActivations(activations);
}

/**
 * 从关键点数组中获取指定部位的关键点
 * @param {Array} keypoints - 关键点数据数组
 * @param {string} partName - 身体部位名称
 * @returns {Object} 指定部位的关键点对象
 */
function getKeypoint(keypoints, partName) {
    const keypoint = keypoints.find(point => point.part === partName);
    if (!keypoint) {
        console.warn(`未找到关键点: ${partName}`);
        return {
            position: { x: 0, y: 0 },
            score: 0
        };
    }
    return keypoint;
}

/**
 * 分析投篮姿势
 * @param {Array} keypoints - 关键点数据
 * @param {string} side - 身体部位
 * @returns {Object} 包含分数和具体反馈的对象
 */
function analyzeShootingForm(keypoints, side) {
    
    // 获取关键点
    const shoulder = getKeypoint(keypoints, `${side}Shoulder`);
    const elbow = getKeypoint(keypoints, `${side}Elbow`);
    const wrist = getKeypoint(keypoints, `${side}Wrist`);
    
    // 计算手臂角度
    const elbowAngle = calculateAngle(shoulder, elbow, wrist);
    
    // 评估投篮姿势
    let score = 100;
    let feedback = '';
    const highlights = [];
    const activations = [];
    
    // 手肘角度应该接近90度
    if (Math.abs(elbowAngle - 90) > 20) {
        score -= 25;
        feedback = elbowAngle < 90 ? '请再抬高一些手肘' : '手肘抬太高了';
    } else if (Math.abs(elbowAngle - 90) > 10) {
        score -= 10;
        feedback = '请注意手肘角度';
    } else {
        // 角度正确，高亮手肘
        highlights.push(`${side}Elbow`);
    }
    
    // 检查手腕是否在出手点参考区域
    const video = document.getElementById('camera');
    // 参考弧线的大致位置 (百分比)
    const arcCenterX = 0.5 * video.videoWidth;
    const arcCenterY = 0.3 * video.videoHeight;
    const arcRadius = 0.1 * video.videoWidth;
    
    const wristPos = wrist.position;
    const dist = Math.sqrt(Math.pow(wristPos.x - arcCenterX, 2) + Math.pow(wristPos.y - arcCenterY, 2));

    if (dist < (dynamicGuides.arc ? dynamicGuides.arc.radius : 30)) {
        activations.push(`${side}Wrist`);
        if (!feedback) feedback = '准备出手！';
    }
    
    return { score: Math.max(0, score), feedback, highlights, activations };
}

/**
 * 计算关键点之间的角度
 */
function calculateAngle(pointA, pointB, pointC) {
    const BA = {
        x: pointA.position.x - pointB.position.x,
        y: pointA.position.y - pointB.position.y
    };
    
    const BC = {
        x: pointC.position.x - pointB.position.x,
        y: pointC.position.y - pointB.position.y
    };
    
    const angle = Math.atan2(BA.y, BA.x) - Math.atan2(BC.y, BC.x);
    return Math.abs(angle * 180 / Math.PI);
}

/**
 * 分析动作的平滑度
 * @param {Array} keypoints - 关键点数据
 * @param {string} side - 身体部位
 * @returns {number} 平滑度评分
 */
function analyzeMovementSmoothness(keypoints, side) {
    // 获取关键点
    const wrist = getKeypoint(keypoints, `${side}Wrist`);
    const elbow = getKeypoint(keypoints, `${side}Elbow`);
    
    // 计算平滑度评分
    // 这里使用简化的评分逻辑，实际应用中可能需要使用更复杂的算法
    // 例如可以通过记录关节位置的历史数据，计算其移动曲线的平滑程度
    
    // 检查关键点的置信度，低置信度的点会导致动作不平滑
    const confidenceScore = (wrist.score + elbow.score) * 50;
    
    // 模拟平滑度评分
    let smoothnessScore = 85 + Math.random() * 10;
    
    // 低置信度会降低平滑度
    if (confidenceScore < 80) {
        smoothnessScore *= (confidenceScore / 100);
    }
    
    return Math.min(100, smoothnessScore);
}

/**
 * 分析运球姿势
 * @param {Array} keypoints - 关键点数据
 * @param {string} side - 身体部位
 * @returns {Object} 包含分数和具体反馈的对象
 */
function analyzeDribblingForm(keypoints, side) {
    // 获取关键点
    const shoulder = getKeypoint(keypoints, `${side}Shoulder`);
    const hip = getKeypoint(keypoints, `${side}Hip`);
    const knee = getKeypoint(keypoints, `${side}Knee`);
    const ankle = getKeypoint(keypoints, `${side}Ankle`);
    
    // 计算身体姿势角度
    const kneeAngle = calculateAngle(hip, knee, ankle);
    
    // 评估运球姿势
    let score = 100;
    let feedback = '';
    const highlights = [];
    const activations = [];
    
    // 膝盖弯曲程度应适中（约120度）
    if (kneeAngle > 150) {
        score -= 20;
        feedback = '请降低重心，保持膝盖弯曲';
    } else if (kneeAngle > 135) {
        score -= 10;
        feedback = '可以再降低一点重心';
    } else {
        // 膝盖弯曲程度达标
        highlights.push(`${side}Knee`);
    }
    
    // 检查运球手是否在激活区
    const wrist = getKeypoint(keypoints, `${side}Wrist`);
    const video = document.getElementById('camera');
    const zoneCenterX = 0.5 * video.videoWidth;
    const zoneCenterY = 0.7 * video.videoHeight;
    const zoneRadius = dynamicGuides.dribbleZone ? dynamicGuides.dribbleZone.radius : 50;

    const wristPos = wrist.position;
    const distToZone = Math.sqrt(Math.pow(wristPos.x - zoneCenterX, 2) + Math.pow(wristPos.y - zoneCenterY, 2));
    
    if (distToZone < zoneRadius) {
        activations.push(`${side}Wrist`);
    }

    // 身体应保持低姿态
    const bodyHeight = Math.abs(shoulder.position.y - hip.position.y);
    const legHeight = Math.abs(hip.position.y - ankle.position.y);
    
    if (legHeight > 0 && (bodyHeight / legHeight) > 0.6) { // 简化判断
        score -= 15;
        if (!feedback) feedback = '注意保持上半身挺直';
    }
    
    // 检查平衡性
    const balanceScore = checkBalance(keypoints);
    if (balanceScore < 80) {
        score -= (100 - balanceScore) * 0.2;
        if (!feedback) feedback = '注意身体平衡';
    } else if (balanceScore > 95) {
        // 平衡性好，高亮核心
        highlights.push(`${side}Hip`);
    }
    
    return { score: Math.max(0, score), feedback, highlights, activations };
}

/**
 * 检查身体平衡性
 * @param {Array} keypoints - 关键点数据
 * @returns {number} 平衡性评分
 */
function checkBalance(keypoints) {
    // 检查身体中心线是否垂直
    const shoulder = {
        x: (getKeypoint(keypoints, 'leftShoulder').position.x + 
            getKeypoint(keypoints, 'rightShoulder').position.x) / 2,
        y: (getKeypoint(keypoints, 'leftShoulder').position.y + 
            getKeypoint(keypoints, 'rightShoulder').position.y) / 2
    };
    
    const hip = {
        x: (getKeypoint(keypoints, 'leftHip').position.x + 
            getKeypoint(keypoints, 'rightHip').position.x) / 2,
        y: (getKeypoint(keypoints, 'leftHip').position.y + 
            getKeypoint(keypoints, 'rightHip').position.y) / 2
    };
    
    // 计算身体倾斜度
    const tiltAngle = Math.atan2(shoulder.x - hip.x, shoulder.y - hip.y) * 180 / Math.PI;
    
    // 倾斜越接近0，平衡性越好
    return 100 - Math.min(100, Math.abs(tiltAngle) * 5);
}

/**
 * 分析动作稳定性
 * @param {Array} keypoints - 关键点数据
 * @returns {number} 稳定性评分
 */
function analyzeMovementStability(keypoints) {
    // 检查身体平衡性
    const balanceScore = checkBalance(keypoints);
    
    // 检查关键点的置信度
    const confidenceScore = calculateConfidenceScore(keypoints);
    
    // 综合评分
    return (balanceScore * 0.7 + confidenceScore * 0.3);
}

/**
 * 计算关键点的置信度评分
 * @param {Array} keypoints - 关键点数据
 * @returns {number} 置信度评分
 */
function calculateConfidenceScore(keypoints) {
    // 计算关键点的平均置信度
    const keyPartsForDribbling = [
        'leftShoulder', 'rightShoulder', 
        'leftElbow', 'rightElbow',
        'leftWrist', 'rightWrist',
        'leftHip', 'rightHip',
        'leftKnee', 'rightKnee'
    ];
    
    let totalScore = 0;
    let validPoints = 0;
    
    keyPartsForDribbling.forEach(part => {
        const point = getKeypoint(keypoints, part);
        if (point.score > 0.1) {
            totalScore += point.score;
            validPoints++;
        }
    });
    
    return validPoints > 0 ? (totalScore / validPoints) * 100 : 0;
}

/**
 * 设置动作参考
 * @param {string} type - 训练类型
 */
function setPoseReference(type) {
    const referenceData = standardPoses[type];
    if (!referenceData) return;

    // 创建参考线
    createReferenceGuides(type);

    // 显示关键点提示
    showKeyPointsGuide(referenceData);
}

/**
 * 创建参考线
 * @param {string} type - 训练类型
 */
function createReferenceGuides(type) {
    const container = document.querySelector('.pose-markers');
    const guideLayer = document.createElement('div');
    guideLayer.className = 'reference-guides';

    if (type === 'shooting') {
        // 添加投篮参考线
        guideLayer.innerHTML = `
            <div class="guide-line vertical"></div>
            <div class="guide-line angle-45"></div>
            <div class="guide-arc"></div>
        `;
    } else if (type === 'dribbling') {
        // 添加运球参考区域
        guideLayer.innerHTML = `
            <div class="guide-zone"></div>
            <div class="guide-line horizontal"></div>
        `;
    }

    container.appendChild(guideLayer);
}

/**
 * 显示关键点提示
 * @param {Object} referenceData - 参考动作数据
 */
function showKeyPointsGuide(referenceData) {
    const container = document.querySelector('.analysis-info');
    const guideSection = document.createElement('div');
    guideSection.className = 'key-points-guide';

    let guideContent = '<h4>动作要领</h4><ul>';
    Object.entries(referenceData).forEach(([phase, data]) => {
        guideContent += `
            <li>
                <strong>${data.description}</strong>
                <ul>
                    ${Object.entries(data.keyPoints)
                        .map(([key, value]) => `<li>${formatKeyPoint(key, value)}</li>`)
                        .join('')}
                </ul>
            </li>
        `;
    });
    guideContent += '</ul>';

    guideSection.innerHTML = guideContent;
    container.appendChild(guideSection);
}

/**
 * 格式化关键点提示文本
 * @param {string} key - 关键点名称
 * @param {any} value - 关键点值
 * @returns {string} 格式化后的文本
 */
function formatKeyPoint(key, value) {
    const keyMap = {
        knee_angle: '膝盖角度',
        elbow_angle: '手肘角度',
        wrist_angle: '手腕角度',
        ball_position: '球的位置',
        release_point: '出手点',
        follow_through: '跟随动作',
        knee_bend: '屈膝程度',
        ball_height: '球的高度',
        body_balance: '身体平衡'
    };

    const valueMap = {
        chest_height: '胸部高度',
        above_head: '头顶以上',
        slight: '轻微',
        waist: '腰部'
    };

    const formattedKey = keyMap[key] || key;
    const formattedValue = typeof value === 'boolean' 
        ? (value ? '保持' : '注意') 
        : (valueMap[value] || value);

    return `${formattedKey}: ${formattedValue}`;
}

// 初始化AI分析
function initAnalysis() {
    const toggleAnalysis = document.getElementById('toggleAnalysis');
    const toggleGuide = document.getElementById('toggleGuide');
    
    toggleAnalysis.addEventListener('click', () => {
        if (!isTraining) {
            alert('请先开始训练，再开启AI分析');
            return;
        }
        isAnalysisEnabled = !isAnalysisEnabled;
        toggleAnalysis.classList.toggle('active');
    });
    
    toggleGuide.addEventListener('click', () => {
        toggleGuide.classList.toggle('active');
        document.querySelector('.pose-markers').classList.toggle('show-guides');
    });
}

// 更新分析指标
function updateMetrics(data) {
    const accuracy = document.querySelector('.accuracy');
    const smoothness = document.querySelector('.smoothness');
    
    if (accuracy && data.accuracy) {
        accuracy.textContent = `${data.accuracy}%`;
    }
    
    if (smoothness && data.smoothness) {
        smoothness.textContent = `${data.smoothness}%`;
    }
}

/**
 * 保存训练记录
 * @param {string} type - 训练类型
 * @param {Object} [stats] - 可选的统计数据，用于报告生成后的保存
 */
function saveTrainingRecord(type, stats) {
    const record = {
        type,
        date: new Date().toISOString(), // 使用ISO格式以便排序和解析
        duration: stats ? stats.duration : calculateTrainingDuration(),
        accuracy: stats ? stats.accuracy : document.querySelector('.accuracy').textContent,
        smoothness: stats ? stats.smoothness : document.querySelector('.smoothness').textContent,
        // 附加数据，用于在个人中心查看详情
        details: {
            accuracyHistory: stats ? stats.accuracyHistory : null,
            feedbackCounts: stats ? stats.feedbackCounts : null
        }
    };

    // 添加记录到历史列表
    addRecordToHistory(record);

    // 更新训练统计
    updateTrainingStats(record);

    // 保存到LocalStorage
    const history = JSON.parse(localStorage.getItem('trainingHistory')) || [];
    history.push(record);
    localStorage.setItem('trainingHistory', JSON.stringify(history));
}

/**
 * 添加记录到历史列表
 * @param {Object} record - 训练记录
 */
function addRecordToHistory(record) {
    const recordsList = document.querySelector('.training-records');
    const recordItem = document.createElement('div');
    recordItem.className = 'record-item';
    
    recordItem.innerHTML = `
        <div class="record-header">
            <div class="record-type">
                <i class="fas fa-${record.type === 'shooting' ? 'basketball' : 'running'}"></i>
                <h4>${record.type === 'shooting' ? '投篮训练' : '运球训练'}</h4>
            </div>
            <span class="record-date">${new Date(record.date).toLocaleString()}</span>
        </div>
        <div class="record-stats">
            <div class="stat">
                <span class="label">训练时长</span>
                <span class="value">${record.duration}</span>
            </div>
            <div class="stat">
                <span class="label">准确度</span>
                <span class="value">${record.accuracy}</span>
            </div>
            <div class="stat">
                <span class="label">流畅度</span>
                <span class="value">${record.smoothness}</span>
            </div>
        </div>
    `;

    // 将新记录插入到列表顶部
    if (recordsList.firstChild) {
        recordsList.insertBefore(recordItem, recordsList.firstChild);
    } else {
        recordsList.appendChild(recordItem);
    }
}

/**
 * 计算训练时长
 * @returns {string} 格式化的训练时长
 */
function calculateTrainingDuration() {
    if (!trainingStartTime) {
        return '0秒';
    }
    const durationInSeconds = Math.round((Date.now() - trainingStartTime) / 1000);
    
    if (durationInSeconds < 60) {
        return `${durationInSeconds}秒`;
    }
    
    const minutes = Math.floor(durationInSeconds / 60);
    const seconds = durationInSeconds % 60;
    
    return `${minutes}分钟 ${seconds}秒`;
}

/**
 * 更新训练统计数据
 * @param {Object} record - 训练记录
 */
function updateTrainingStats(record) {
    const card = document.querySelector(`.training-card[data-type="${record.type}"]`);
    const stats = card.querySelectorAll('.stat-item .value');
    
    // 更新卡片上的统计数据
    if (record.type === 'shooting') {
        stats[0].textContent = record.accuracy;
        stats[1].textContent = record.smoothness;
    } else {
        stats[0].textContent = record.smoothness;
        stats[1].textContent = '92%'; // 速度指标
    }
}

/**
 * 获取训练统计数据（模拟API）
 * @returns {Promise<Object>} 训练统计数据
 */
async function fetchTrainingStats() {
    // 模拟API调用
    return new Promise((resolve) => {
        setTimeout(() => {
            resolve({
                totalTime: 3600, // 单位：分钟
                shootingAccuracy: 70,
                trainingDays: 30,
                caloriesBurned: 8000
            });
        }, 800);
    });
}

/**
 * 获取训练历史记录 (模拟API)
 * @returns {Promise<Array>} 训练历史记录
 */
async function fetchTrainingHistory() {
    // 模拟API调用
    return new Promise(resolve => {
        setTimeout(() => {
            resolve([
                {
                    type: 'shooting',
                    date: new Date(Date.now() - 86400000).toLocaleString(), // 昨天
                    duration: '30分钟',
                    accuracy: '85.2%',
                    smoothness: '92.1%'
                },
                {
                    type: 'dribbling',
                    date: new Date(Date.now() - 172800000).toLocaleString(), // 2天前
                    duration: '45分钟',
                    accuracy: 'N/A',
                    smoothness: '88.7%'
                },
                 {
                    type: 'shooting',
                    date: new Date(Date.now() - 3 * 86400000).toLocaleString(), // 3天前
                    duration: '25分钟',
                    accuracy: '78.5%',
                    smoothness: '85.3%'
                }
            ]);
        }, 1200);
    });
}

/**
 * 更新实时文字反馈
 * @param {string} text - 要显示的反馈文本
 */
function updateFeedback(text) {
    const feedbackEl = document.getElementById('feedback-text');
    if (feedbackEl) {
        feedbackEl.textContent = text || '动作标准';
    }
}

/**
 * 更新高亮显示的关节点
 * @param {Array<string>} highlightedParts - 需要高亮的身体部位名称数组
 */
function updateHighlights(highlightedParts = []) {
    // 移除所有旧的高亮
    document.querySelectorAll('.pose-marker.correct-position').forEach(marker => {
        marker.classList.remove('correct-position');
    });

    // 添加新的高亮
    highlightedParts.forEach(part => {
        const marker = document.querySelector(`.pose-marker[data-point="${part}"]`);
        if (marker) {
            marker.classList.add('correct-position');
        }
    });
}

/**
 * 更新激活状态的关节点
 * @param {Array<string>} activatedParts - 需要激活的身体部位名称数组
 */
function updateActivations(activatedParts = []) {
    // 移除所有旧的激活状态
    document.querySelectorAll('.pose-marker.activated').forEach(marker => {
        marker.classList.remove('activated');
    });

    // 添加新的激活状态
    activatedParts.forEach(part => {
        const marker = document.querySelector(`.pose-marker[data-point="${part}"]`);
        if (marker) {
            marker.classList.add('activated');
        }
    });
}

/**
 * 动态绘制参考线
 * @param {Object} pose - 参考姿态
 * @param {string} type - 训练类型
 */
function drawDynamicReferenceLines(pose, type) {
    const container = document.querySelector('.pose-markers');
    if (!container) return;

    // 清理旧的静态参考线(以防万一)
    const oldGuides = container.querySelector('.reference-guides');
    if(oldGuides) oldGuides.remove();

    const keypoints = pose.keypoints;
    const video = document.getElementById('camera');

    // 获取身体侧
    const leftShoulder = getKeypoint(keypoints, 'leftShoulder');
    const rightShoulder = getKeypoint(keypoints, 'rightShoulder');
    const side = (leftShoulder.position.x < rightShoulder.position.x) ? 'left' : 'right';

    if (type === 'shooting') {
        const shoulder = getKeypoint(keypoints, `${side}Shoulder`);
        const elbow = getKeypoint(keypoints, `${side}Elbow`);
        const wrist = getKeypoint(keypoints, `${side}Wrist`);
        const hip = getKeypoint(keypoints, `${side}Hip`);

        // 1. 身体垂直线 (基于躯干)
        const torsoTopY = shoulder.position.y;
        const torsoHeight = hip.position.y - torsoTopY;
        const torsoCenterX = (shoulder.position.x + hip.position.x) / 2;
        
        const bodyLine = createGuideElement(['guide-line', 'vertical']);
        bodyLine.style.left = `${(torsoCenterX / video.videoWidth) * 100}%`;
        bodyLine.style.top = `${(torsoTopY / video.videoHeight) * 100}%`;
        bodyLine.style.height = `${(torsoHeight / video.videoHeight) * 100}%`;
        container.appendChild(bodyLine);

        // 2. 小臂辅助线 (出手弧线)
        const forearmLength = Math.sqrt(Math.pow(wrist.position.x - elbow.position.x, 2) + Math.pow(wrist.position.y - elbow.position.y, 2));
        const arcDiameter = forearmLength * 2.5; // 让弧线比小臂稍长
        
        const arc = createGuideElement(['guide-arc']);
        arc.style.width = `${(arcDiameter / video.videoWidth) * 100}%`;
        arc.style.height = `${(arcDiameter / video.videoHeight) * 100}%`;
        arc.style.left = `${((elbow.position.x - arcDiameter / 2) / video.videoWidth) * 100}%`;
        arc.style.top = `${((elbow.position.y - arcDiameter / 2) / video.videoHeight) * 100}%`;
        container.appendChild(arc);

        dynamicGuides.arc = {
            centerX: elbow.position.x,
            centerY: elbow.position.y,
            radius: arcDiameter / 2
        };
    }

    if (type === 'dribbling') {
        const hip = getKeypoint(keypoints, `${side}Hip`);
        const knee = getKeypoint(keypoints, `${side}Knee`);
        const shoulderWidth = Math.abs(leftShoulder.position.x - rightShoulder.position.x);

        // 运球高度参考线 (在膝盖位置)
        const dribbleLine = createGuideElement(['guide-line', 'horizontal']);
        dribbleLine.style.top = `${(knee.position.y / video.videoHeight) * 100}%`;
        dribbleLine.style.left = `${((hip.position.x - shoulderWidth / 2) / video.videoWidth) * 100}%`;
        dribbleLine.style.width = `${(shoulderWidth / video.videoWidth) * 100}%`;
        container.appendChild(dribbleLine);
        
        dynamicGuides.dribbleZone = {
            y: knee.position.y,
            radius: shoulderWidth / 2
        };
    }
}

/**
 * 创建一个参考线元素
 * @param {Array<string>} classes - 元素的类名数组
 * @returns {HTMLElement} 创建的div元素
 */
function createGuideElement(classes = []) {
    const el = document.createElement('div');
    el.classList.add('dynamic-guide', ...classes);
    return el;
} 
