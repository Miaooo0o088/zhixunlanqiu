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
        
        // 开始训练会话
        startTrainingSession(type);
        
        // 关闭弹窗
        closeModal();
        
    } catch (err) {
        console.error('相机访问失败:', err);
        alert('无法访问相机，请确保已授予相机权限');
        closeModal();
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
        // MoveNet没有显式的dispose方法，但可以将检测器设为null以便垃圾回收
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
                // 打印原始姿势数据用于调试 
                
                // MoveNet返回的关键点格式与PoseNet不同，需要进行转换
                const convertedPose = convertMoveNetPose(pose,video.clientWidth);
                updatePoseVisualization(convertedPose);
                analyzeTrainingForm(convertedPose, type);
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
    console.log(currentCamera);
    
    // 转换关键点数据
    const keypoints = moveNetPose.keypoints.map(point => {
        // 根据名称查找对应的PoseNet名称
        const mapping = keyPointMap.find(m => m.movenet === point.name);
        const partName = mapping ? mapping.posenet : point.name;
        console.log(imgWidth);
        
        return {
            part: partName,
            position: {
                x: imgWidth - point.x + 380,
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
    
    const keypoints = pose.keypoints;
    let accuracy = 0;
    let smoothness = 0;

    if (type === 'shooting') {
        // 分析投篮姿势
        accuracy = analyzeShootingForm(keypoints);
        smoothness = analyzeMovementSmoothness(keypoints);
    } else {
        // 分析运球姿势
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
 * @returns {number} 准确度评分
 */
function analyzeShootingForm(keypoints) {
    
    // 获取关键点
    const shoulder = getKeypoint(keypoints, 'rightShoulder');
    const elbow = getKeypoint(keypoints, 'rightElbow');
    const wrist = getKeypoint(keypoints, 'rightWrist');
    
    // 计算手臂角度
    const elbowAngle = calculateAngle(shoulder, elbow, wrist);
    
    // 评估投篮姿势
    let score = 100;
    
    // 手肘角度应该接近90度
    if (Math.abs(elbowAngle - 90) > 15) {
        score -= 20;
    }
    
    // 其他评估标准...
    
    return Math.max(0, score);
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
 * @returns {number} 平滑度评分
 */
function analyzeMovementSmoothness(keypoints) {
    // 获取关键点
    const wrist = getKeypoint(keypoints, 'rightWrist');
    const elbow = getKeypoint(keypoints, 'rightElbow');
    
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
 * @returns {number} 准确度评分
 */
function analyzeDribblingForm(keypoints) {
    // 获取关键点
    const shoulder = getKeypoint(keypoints, 'leftShoulder');
    const hip = getKeypoint(keypoints, 'leftHip');
    const knee = getKeypoint(keypoints, 'leftKnee');
    
    // 计算身体姿势角度
    const kneeAngle = calculateAngle(hip, knee, getKeypoint(keypoints, 'leftAnkle'));
    
    // 评估运球姿势
    let score = 100;
    
    // 膝盖弯曲程度应适中（约120度）
    if (Math.abs(kneeAngle - 120) > 30) {
        score -= 15;
    }
    
    // 身体应保持低姿态
    const bodyHeight = shoulder.position.y - knee.position.y;
    if (bodyHeight > 0.4) { // 假设身体高度比例过高
        score -= 10;
    }
    
    // 检查平衡性
    const balanceScore = checkBalance(keypoints);
    score -= (100 - balanceScore) * 0.2;
    
    return Math.max(0, score);
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

// 开始AI分析
function startAnalysis() {
    // 创建姿势标记点
    createPoseMarkers();
    
    // 开始实时分析
    analysisInterval = setInterval(() => {
        updatePoseAnalysis();
    }, 100);
}

// 停止AI分析
function stopAnalysis() {
    if (analysisInterval) {
        clearInterval(analysisInterval);
        analysisInterval = null;
    }
    
    // 清除标记点
    const poseMarkers = document.querySelector('.pose-markers');
    poseMarkers.innerHTML = '';
}

// 创建姿势标记点
function createPoseMarkers() {
    const poseMarkers = document.querySelector('.pose-markers');
    poseMarkers.innerHTML = '';
    
    // 创建连接线容器
    const linesContainer = document.createElement('div');
    linesContainer.className = 'pose-lines';
    poseMarkers.appendChild(linesContainer);
    
    // 创建轨迹容器
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

// 更新姿势分析
function updatePoseAnalysis() {
    // 获取AI分析结果（这里使用模拟数据）
    const poseData = simulatePoseDetection();
    
    // 更新标记点位置
    const markers = document.querySelectorAll('.pose-marker');
    markers.forEach(marker => {
        const point = marker.dataset.point;
        const position = poseData[point];
        if (position) {
            marker.style.left = `${position.x}%`;
            marker.style.top = `${position.y}%`;
        }
    });
    
    // 更新连接线
    updatePoseConnections(poseData);
    
    // 更新动作轨迹
    updateTrajectory(poseData);
    
    // 更新分析指标
    updateMetrics(poseData);
}

// 模拟姿势检测数据
function simulatePoseDetection() {
    const poseData = {};
    posePoints.forEach(point => {
        poseData[point] = {
            x: 30 + Math.random() * 40, // 保持在画面中心区域
            y: 30 + Math.random() * 40,
            confidence: 0.8 + Math.random() * 0.2
        };
    });
    return poseData;
}

// 更新姿势连接线
function updatePoseConnections(poseData) {
    const linesContainer = document.querySelector('.pose-lines');
    linesContainer.innerHTML = '';
    
    poseConnections.forEach(([start, end]) => {
        const startPos = poseData[start];
        const endPos = poseData[end];
        
        if (startPos && endPos) {
            const line = document.createElement('div');
            line.className = 'pose-line';
            
            // 计算线段长度和角度
            const dx = endPos.x - startPos.x;
            const dy = endPos.y - startPos.y;
            const length = Math.sqrt(dx * dx + dy * dy);
            const angle = Math.atan2(dy, dx) * 180 / Math.PI;
            
            // 设置线段样式
            line.style.width = `${length}%`;
            line.style.left = `${startPos.x}%`;
            line.style.top = `${startPos.y}%`;
            line.style.transform = `rotate(${angle}deg)`;
            
            linesContainer.appendChild(line);
        }
    });
}

// 更新动作轨迹
function updateTrajectory(poseData) {
    const trajectoryContainer = document.querySelector('.pose-trajectory');
    
    // 更新关键点轨迹历史
    posePoints.forEach(point => {
        if (!trajectoryHistory.has(point)) {
            trajectoryHistory.set(point, []);
        }
        
        const history = trajectoryHistory.get(point);
        history.push(poseData[point]);
        
        // 限制历史点数量
        if (history.length > maxTrajectoryPoints) {
            history.shift();
        }
    });
    
    // 绘制轨迹
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

// 更新分析指标
function updateMetrics(poseData) {
    const accuracy = document.querySelector('.accuracy');
    const smoothness = document.querySelector('.smoothness');
    
    // 模拟数据更新
    const newAccuracy = 85 + Math.random() * 10;
    const newSmoothness = 80 + Math.random() * 15;
    
    accuracy.textContent = `${newAccuracy.toFixed(1)}%`;
    smoothness.textContent = `${newSmoothness.toFixed(1)}%`;
}

/**
 * 保存训练记录
 * @param {string} type - 训练类型
 */
function saveTrainingRecord(type) {
    const record = {
        type,
        date: new Date().toLocaleString(),
        duration: calculateTrainingDuration(),
        accuracy: document.querySelector('.accuracy').textContent,
        smoothness: document.querySelector('.smoothness').textContent
    };

    // 添加记录到历史列表
    addRecordToHistory(record);

    // 更新训练统计
    updateTrainingStats(record);
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
    // 这里可以添加实际的训练时长计算逻辑
    const minutes = Math.floor(Math.random() * 30) + 15; // 模拟15-45分钟的训练时长
    return `${minutes}分钟`;
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