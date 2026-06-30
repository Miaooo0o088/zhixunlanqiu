/**
 * 训练页面逻辑
 */
document.addEventListener('DOMContentLoaded', () => {
    initTrainingStats();
    initTrainingHistory();
    initAnalysis();
});

/**
 * 初始化训练数据统计
 */
const initTrainingStats = () => {
    // 从API获取训练数据
    fetchTrainingStats();
    // 更新统计显示
    updateStatsDisplay();
};

/**
 * 初始化训练历史记录
 */
const initTrainingHistory = () => {
    fetchTrainingHistory();
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

// AI分析相关变量
let isAnalysisEnabled = false;
let analysisInterval = null;
const posePoints = [
    'head', 'neck', 'shoulder_r', 'elbow_r', 'wrist_r',
    'shoulder_l', 'elbow_l', 'wrist_l', 'hip_r', 'knee_r',
    'ankle_r', 'hip_l', 'knee_l', 'ankle_l'
];

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
            video: {
                width: { ideal: 1280 },
                height: { ideal: 720 },
                facingMode: currentCamera
            }
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
    // 设置按钮加载状态
    const card = document.querySelector(`.training-card[data-type="${type}"]`);
    const startBtn = card.querySelector('.start-btn');
    const originalHTML = startBtn.innerHTML;
    startBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 加载相机...';
    startBtn.disabled = true;
    
    try {
        // 请求相机权限
        cameraStream = await navigator.mediaDevices.getUserMedia({ 
            video: { 
                width: { ideal: 1280 },
                height: { ideal: 720 },
                facingMode: currentCamera
            } 
        });
        hasPermission = true;
        
        // 将相机流连接到视频元素
        const videoElement = document.getElementById('camera');
        videoElement.srcObject = cameraStream;
        
        // 等待视频加载完成
        await videoElement.play();
        // 确保视频元数据已加载
        if (videoElement.videoWidth === 0) {
            await new Promise(resolve => videoElement.onloadedmetadata = resolve);
        }
        
        // 开始训练会话
        startTrainingSession(type);
        
        // 关闭弹窗
        closeModal();
        
    } catch (err) {
        console.error('相机访问失败:', err);
        alert('无法访问相机，请确保已授予相机权限');
        closeModal();
    } finally {
        startBtn.innerHTML = originalHTML;
        startBtn.disabled = false;
    }
}

/**
 * 开始训练会话
 * @param {string} type - 训练类型
 */
function startTrainingSession(type) {
    isTraining = true;
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
    const card = document.querySelector(`.training-card[data-type="${type}"]`);
    const startBtn = card.querySelector('.start-btn');
    
    // 恢复按钮状态
    startBtn.innerHTML = `
        <span>
            <i class="fas fa-play"></i>
            开始训练
        </span>
    `;
    startBtn.classList.remove('training-active');
    startBtn.onclick = () => requestCamera(type);

    // 停止AI分析
    stopAnalysis();

    // 停止姿势检测
    if (detectionInterval) {
        clearInterval(detectionInterval);
        detectionInterval = null;
    }

    // 清理检测器资源
    if (detector) {
        detector = null;
        detectionModel = null;
    }

    // 隐藏相机视图
    const videoContainer = document.querySelector('.video-container');
    videoContainer.style.display = 'none';

    // 停止相机流
    if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
        cameraStream = null;
    }

    // 保存训练记录
    saveTrainingRecord(type);
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
    const statusEl = document.querySelector('.analysis-status');
    try {
        // 显示加载状态
        statusEl.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 加载模型中...';

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

        statusEl.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> AI实时分析中...';
        // 初始化姿势标记点
        initializePoseMarkers();

        // 确保视频元数据已加载
        if (video.videoWidth === 0) {
            await new Promise(resolve => video.onloadedmetadata = resolve);
        }

        // 开始实时检测
        detectionInterval = setInterval(async () => {
            try {
                // 使用MoveNet进行姿势检测
                const poses = await detector.estimatePoses(video);
                if (poses.length > 0) {
                    const pose = poses[0];
                    // 转换坐标（使用视频实际尺寸）
                    const convertedPose = convertMoveNetPose(pose, video.videoWidth, video.videoHeight);
                    updatePoseVisualization(convertedPose);
                    analyzeTrainingForm(convertedPose, type);
                }
            } catch (err) {
                console.warn('检测帧错误:', err);
            }
        }, 100);

    } catch (error) {
        console.error('姿势检测初始化失败:', error);
        statusEl.innerHTML = '<i class="fas fa-exclamation-triangle"></i> 模型加载失败，请检查网络';
        alert('AI模型加载失败，请检查网络连接');
    }
}

/**
 * 将MoveNet的姿势数据转换为与PoseNet兼容的格式
 * @param {Object} moveNetPose - MoveNet检测到的姿势数据
 * @param {number} imgWidth - 视频实际宽度
 * @param {number} imgHeight - 视频实际高度
 * @returns {Object} 转换后的姿势数据（坐标已转为百分比）
 */
function convertMoveNetPose(moveNetPose, imgWidth, imgHeight) {
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
    
    // 转换关键点数据 - 使用百分比坐标
    const keypoints = moveNetPose.keypoints.map(point => {
        const mapping = keyPointMap.find(m => m.movenet === point.name);
        const partName = mapping ? mapping.posenet : point.name;
        // 计算相对于视频尺寸的百分比
        const x = (point.x / imgWidth) * 100;
        const y = (point.y / imgHeight) * 100;
        return {
            part: partName,
            position: { x, y },
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
 * @param {Object} pose - 检测到的姿势数据（坐标已为百分比）
 */
function updatePoseVisualization(pose) {
    const poseMarkers = document.querySelector('.pose-markers');
    const keypoints = pose.keypoints;

    // 更新关键点位置
    keypoints.forEach(point => {
        const marker = poseMarkers.querySelector(`[data-point="${point.part}"]`);
        if (marker) {
            // 直接使用百分比坐标
            marker.style.left = `${point.position.x}%`;
            marker.style.top = `${point.position.y}%`;
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
 * 绘制骨架连接线（坐标已是百分比）
 */
function drawSkeletonLine(start, end) {
    const skeletonContainer = document.querySelector('.pose-skeleton');

    const startX = start.x;
    const startY = start.y;
    const endX = end.x;
    const endY = end.y;

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
    const keypoints = pose.keypoints;
    let accuracy = 0;
    let smoothness = 0;

    if (type === 'shooting') {
        accuracy = analyzeShootingForm(keypoints);
        smoothness = analyzeMovementSmoothness(keypoints);
    } else {
        accuracy = analyzeDribblingForm(keypoints);
        smoothness = analyzeMovementStability(keypoints);
    }

    // 更新分析指标
    updateMetrics({
        accuracy: accuracy.toFixed(1),
        smoothness: smoothness.toFixed(1)
    });
}

/**
 * 从关键点数组中获取指定部位的关键点
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
 */
function analyzeShootingForm(keypoints) {
    const shoulder = getKeypoint(keypoints, 'rightShoulder');
    const elbow = getKeypoint(keypoints, 'rightElbow');
    const wrist = getKeypoint(keypoints, 'rightWrist');
    
    const elbowAngle = calculateAngle(shoulder, elbow, wrist);
    
    let score = 100;
    if (Math.abs(elbowAngle - 90) > 15) {
        score -= 20;
    }
    return Math.max(0, score);
}

/**
 * 计算关键点之间的角度（坐标已是百分比，不影响角度计算）
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
 */
function analyzeMovementSmoothness(keypoints) {
    const wrist = getKeypoint(keypoints, 'rightWrist');
    const elbow = getKeypoint(keypoints, 'rightElbow');
    const confidenceScore = (wrist.score + elbow.score) * 50;
    let smoothnessScore = 85 + Math.random() * 10;
    if (confidenceScore < 80) {
        smoothnessScore *= (confidenceScore / 100);
    }
    return Math.min(100, smoothnessScore);
}

/**
 * 分析运球姿势
 */
function analyzeDribblingForm(keypoints) {
    const hip = getKeypoint(keypoints, 'leftHip');
    const knee = getKeypoint(keypoints, 'leftKnee');
    const ankle = getKeypoint(keypoints, 'leftAnkle');
    const shoulder = getKeypoint(keypoints, 'leftShoulder');
    
    const kneeAngle = calculateAngle(hip, knee, ankle);
    let score = 100;
    if (Math.abs(kneeAngle - 120) > 30) {
        score -= 15;
    }
    const bodyHeight = shoulder.position.y - knee.position.y;
    if (bodyHeight > 0.4) {
        score -= 10;
    }
    const balanceScore = checkBalance(keypoints);
    score -= (100 - balanceScore) * 0.2;
    return Math.max(0, score);
}

/**
 * 检查身体平衡性
 */
function checkBalance(keypoints) {
    const leftShoulder = getKeypoint(keypoints, 'leftShoulder');
    const rightShoulder = getKeypoint(keypoints, 'rightShoulder');
    const leftHip = getKeypoint(keypoints, 'leftHip');
    const rightHip = getKeypoint(keypoints, 'rightHip');
    
    const shoulder = {
        x: (leftShoulder.position.x + rightShoulder.position.x) / 2,
        y: (leftShoulder.position.y + rightShoulder.position.y) / 2
    };
    const hip = {
        x: (leftHip.position.x + rightHip.position.x) / 2,
        y: (leftHip.position.y + rightHip.position.y) / 2
    };
    const tiltAngle = Math.atan2(shoulder.x - hip.x, shoulder.y - hip.y) * 180 / Math.PI;
    return 100 - Math.min(100, Math.abs(tiltAngle) * 5);
}

/**
 * 分析动作稳定性
 */
function analyzeMovementStability(keypoints) {
    const balanceScore = checkBalance(keypoints);
    const confidenceScore = calculateConfidenceScore(keypoints);
    return (balanceScore * 0.7 + confidenceScore * 0.3);
}

/**
 * 计算关键点的置信度评分
 */
function calculateConfidenceScore(keypoints) {
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
 * 设置动作参考（保留原有功能，未修改）
 */
function setPoseReference(type) {
    const referenceData = standardPoses[type];
    if (!referenceData) return;
    createReferenceGuides(type);
    showKeyPointsGuide(referenceData);
}

function createReferenceGuides(type) {
    const container = document.querySelector('.pose-markers');
    const guideLayer = document.createElement('div');
    guideLayer.className = 'reference-guides';
    if (type === 'shooting') {
        guideLayer.innerHTML = `
            <div class="guide-line vertical"></div>
            <div class="guide-line angle-45"></div>
            <div class="guide-arc"></div>
        `;
    } else if (type === 'dribbling') {
        guideLayer.innerHTML = `
            <div class="guide-zone"></div>
            <div class="guide-line horizontal"></div>
        `;
    }
    container.appendChild(guideLayer);
}

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

// 初始化AI分析（保留原功能，未修改）
function initAnalysis() {
    const toggleAnalysis = document.getElementById('toggleAnalysis');
    const toggleGuide = document.getElementById('toggleGuide');
    
    toggleAnalysis.addEventListener('click', () => {
        isAnalysisEnabled = !isAnalysisEnabled;
        toggleAnalysis.classList.toggle('active');
        if (isAnalysisEnabled) {
            startAnalysis();
        } else {
            stopAnalysis();
        }
    });
    
    toggleGuide.addEventListener('click', () => {
        toggleGuide.classList.toggle('active');
        document.querySelector('.pose-markers').classList.toggle('show-guides');
    });
}

function startAnalysis() {
    createPoseMarkers();
    analysisInterval = setInterval(() => {
        updatePoseAnalysis();
    }, 100);
}

function stopAnalysis() {
    if (analysisInterval) {
        clearInterval(analysisInterval);
        analysisInterval = null;
    }
    const poseMarkers = document.querySelector('.pose-markers');
    poseMarkers.innerHTML = '';
}

function createPoseMarkers() {
    const poseMarkers = document.querySelector('.pose-markers');
    poseMarkers.innerHTML = '';
    const linesContainer = document.createElement('div');
    linesContainer.className = 'pose-lines';
    poseMarkers.appendChild(linesContainer);
    const trajectoryContainer = document.createElement('div');
    trajectoryContainer.className = 'pose-trajectory';
    poseMarkers.appendChild(trajectoryContainer);
    posePoints.forEach(point => {
        const marker = document.createElement('div');
        marker.className = 'pose-marker';
        marker.dataset.point = point;
        poseMarkers.appendChild(marker);
    });
}

function updatePoseAnalysis() {
    const poseData = simulatePoseDetection();
    const markers = document.querySelectorAll('.pose-marker');
    markers.forEach(marker => {
        const point = marker.dataset.point;
        const position = poseData[point];
        if (position) {
            marker.style.left = `${position.x}%`;
            marker.style.top = `${position.y}%`;
        }
    });
    updatePoseConnections(poseData);
    updateTrajectory(poseData);
    updateMetrics(poseData);
}

function simulatePoseDetection() {
    const poseData = {};
    posePoints.forEach(point => {
        poseData[point] = {
            x: 30 + Math.random() * 40,
            y: 30 + Math.random() * 40,
            confidence: 0.8 + Math.random() * 0.2
        };
    });
    return poseData;
}

function updatePoseConnections(poseData) {
    const linesContainer = document.querySelector('.pose-lines');
    linesContainer.innerHTML = '';
    poseConnections.forEach(([start, end]) => {
        const startPos = poseData[start];
        const endPos = poseData[end];
        if (startPos && endPos) {
            const line = document.createElement('div');
            line.className = 'pose-line';
            const dx = endPos.x - startPos.x;
            const dy = endPos.y - startPos.y;
            const length = Math.sqrt(dx * dx + dy * dy);
            const angle = Math.atan2(dy, dx) * 180 / Math.PI;
            line.style.width = `${length}%`;
            line.style.left = `${startPos.x}%`;
            line.style.top = `${startPos.y}%`;
            line.style.transform = `rotate(${angle}deg)`;
            linesContainer.appendChild(line);
        }
    });
}

function updateTrajectory(poseData) {
    const trajectoryContainer = document.querySelector('.pose-trajectory');
    posePoints.forEach(point => {
        if (!trajectoryHistory.has(point)) {
            trajectoryHistory.set(point, []);
        }
        const history = trajectoryHistory.get(point);
        history.push(poseData[point]);
        if (history.length > maxTrajectoryPoints) {
            history.shift();
        }
    });
    trajectoryContainer.innerHTML = '';
    trajectoryHistory.forEach((history, point) => {
        history.forEach((pos, index) => {
            const dot = document.createElement('div');
            dot.className = 'trajectory-dot';
            dot.style.left = `${pos.x}%`;
            dot.style.top = `${pos.y}%`;
            dot.style.opacity = index / history.length;
            trajectoryContainer.appendChild(dot);
        });
    });
}

function updateMetrics(poseData) {
    const accuracy = document.querySelector('.accuracy');
    const smoothness = document.querySelector('.smoothness');
    const newAccuracy = 85 + Math.random() * 10;
    const newSmoothness = 80 + Math.random() * 15;
    accuracy.textContent = `${newAccuracy.toFixed(1)}%`;
    smoothness.textContent = `${newSmoothness.toFixed(1)}%`;
}

/**
 * 保存训练记录
 */
function saveTrainingRecord(type) {
    const record = {
        type,
        date: new Date().toLocaleString(),
        duration: calculateTrainingDuration(),
        accuracy: document.querySelector('.accuracy').textContent,
        smoothness: document.querySelector('.smoothness').textContent
    };
    addRecordToHistory(record);
    updateTrainingStats(record);
}

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
            <span class="record-date">${record.date}</span>
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
    if (recordsList.firstChild) {
        recordsList.insertBefore(recordItem, recordsList.firstChild);
    } else {
        recordsList.appendChild(recordItem);
    }
}

function calculateTrainingDuration() {
    const minutes = Math.floor(Math.random() * 30) + 15;
    return `${minutes}分钟`;
}

function updateTrainingStats(record) {
    const card = document.querySelector(`.training-card[data-type="${record.type}"]`);
    const stats = card.querySelectorAll('.stat-item .value');
    if (record.type === 'shooting') {
        stats[0].textContent = record.accuracy;
        stats[1].textContent = record.smoothness;
    } else {
        stats[0].textContent = record.smoothness;
        stats[1].textContent = '92%';
    }
}

// 占位函数（防止未定义）
function fetchTrainingStats() {}
function updateStatsDisplay() {}
function fetchTrainingHistory() {}
